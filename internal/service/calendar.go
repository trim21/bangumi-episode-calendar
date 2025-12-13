package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"

	"github.com/trim21/bangumi-episode-calendar/internal/bangumi"
	"github.com/trim21/bangumi-episode-calendar/internal/cache"
	"github.com/trim21/bangumi-episode-calendar/internal/calendar"
	"github.com/trim21/bangumi-episode-calendar/internal/config"
)

const (
	icsCachePrefix      = "episode-calendar-v5.0-"
	subjectCachePrefix  = "subject-v3-"
	epPageSize          = 200
	collectionPageSize  = 50
	icsCacheTTL         = 23 * time.Hour
	subjectShortTTL     = 3 * 24 * time.Hour
	subjectLongTTL      = 7 * 24 * time.Hour
	notFoundSubjectTTL  = 24 * time.Hour
	timeWindowDays      = 30
	nowBufferInPastDays = 3
)

var ErrUserNotFound = errors.New("user not found")

type CalendarService struct {
	client         *bangumi.Client
	cache          *cache.Cache
	log            zerolog.Logger
	maxConcurrency int
}

func NewCalendarService(client *bangumi.Client, cache *cache.Cache, log zerolog.Logger, cfg config.Config) *CalendarService {
	maxConc := cfg.MaxConcurrency
	if maxConc <= 0 {
		maxConc = 20
	}
	return &CalendarService{
		client:         client,
		cache:          cache,
		log:            log,
		maxConcurrency: maxConc,
	}
}

func (s *CalendarService) BuildICS(ctx context.Context, username string) (string, error) {
	cacheKey := icsCachePrefix + username
	if cached, found, err := s.cache.GetString(ctx, cacheKey); err == nil && found {
		return cached, nil
	}

	s.log.Info().Str("username", username).Str("req_id", middleware.GetReqID(ctx)).Msg("fetching collection")
	collections, err := s.fetchAllUserCollection(ctx, username)
	if err != nil {
		return "", err
	}

	subjects, err := s.fetchSubjects(ctx, collections)
	if err != nil {
		return "", err
	}

	ics := calendar.RenderICS(subjects)
	if err := s.cache.SetString(ctx, cacheKey, ics, icsCacheTTL); err != nil {
		s.log.Warn().Err(err).Msg("failed to set ics cache")
	}

	return ics, nil
}

func (s *CalendarService) fetchAllUserCollection(ctx context.Context, username string) ([]bangumi.Collection, error) {
	var data []bangumi.Collection
	for _, collectionType := range []int{1, 3} {
		offset := 0
		for {
			res, err := s.client.GetCollections(ctx, username, collectionType, offset, collectionPageSize)
			if err != nil {
				if errors.Is(err, bangumi.ErrNotFound) {
					return nil, fmt.Errorf("%w: %s", ErrUserNotFound, username)
				}
				return nil, err
			}

			for _, c := range res.Data {
				if c.SubjectType == bangumi.SubjectTypeAnime || c.SubjectType == bangumi.SubjectTypeEpisode {
					data = append(data, c)
				}
			}

			offset += collectionPageSize
			if offset >= res.Total {
				break
			}
		}
	}
	return data, nil
}

func (s *CalendarService) fetchSubjects(ctx context.Context, collections []bangumi.Collection) ([]calendar.SlimSubject, error) {
	ids := uniqueSubjectIDs(collections)
	out := make([]calendar.SlimSubject, 0, len(ids))
	mu := &sync.Mutex{}
	sem := make(chan struct{}, s.maxConcurrency)
	g, ctx := errgroup.WithContext(ctx)

	for id := range ids {
		id := id
		sem <- struct{}{}
		g.Go(func() error {
			defer func() { <-sem }()
			subject, err := s.getSubjectInfo(ctx, id)
			if err != nil {
				return err
			}
			if subject == nil || len(subject.FutureEpisodes) == 0 {
				return nil
			}
			mu.Lock()
			out = append(out, *subject)
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return out, nil
}

func (s *CalendarService) getSubjectInfo(ctx context.Context, subjectID int) (*calendar.SlimSubject, error) {
	cacheKey := fmt.Sprintf("%s%d", subjectCachePrefix, subjectID)
	if raw, found, err := s.cache.GetString(ctx, cacheKey); err == nil && found {
		if raw == "null" {
			return nil, nil
		}
		var cached calendar.SlimSubject
		if err := json.Unmarshal([]byte(raw), &cached); err == nil {
			return &cached, nil
		}
	}

	s.log.Info().Int("subject_id", subjectID).Str("req_id", middleware.GetReqID(ctx)).Msg("fetching subject")
	subject, _, err := s.client.GetSubject(ctx, subjectID)
	if err != nil {
		if errors.Is(err, bangumi.ErrNotFound) {
			_ = s.cache.SetString(ctx, cacheKey, "null", notFoundSubjectTTL)
			return nil, nil
		}
		return nil, err
	}

	data := &calendar.SlimSubject{ID: subject.ID, Name: fallbackName(subject.NameCN, subject.Name)}

	if subject.TotalEpisodes > 0 {
		allEpisodes, err := s.fetchAllEpisode(ctx, subjectID)
		if err != nil {
			return nil, err
		}

		future := filterFutureEpisodes(allEpisodes)
		if len(allEpisodes) > 0 && len(future) == 0 && len(allEpisodes) <= epPageSize {
			data.FutureEpisodes = future
			if err := s.cache.SetJSON(ctx, cacheKey, data, subjectLongTTL); err != nil {
				s.log.Warn().Err(err).Msg("failed to cache subject")
			}
			return data, nil
		}

		data.FutureEpisodes = future
	}

	if err := s.cache.SetJSON(ctx, cacheKey, data, subjectShortTTL); err != nil {
		s.log.Warn().Err(err).Msg("failed to cache subject")
	}

	return data, nil
}

func (s *CalendarService) fetchAllEpisode(ctx context.Context, subjectID int) ([]calendar.ParsedEpisode, error) {
	var data []calendar.ParsedEpisode
	offset := 0
	for {
		res, err := s.client.GetEpisodes(ctx, subjectID, offset, epPageSize)
		if err != nil {
			return nil, err
		}

		for _, ep := range res.Data {
			parsed, ok := parseEpisode(ep)
			if ok {
				data = append(data, parsed)
			}
		}

		offset += epPageSize
		if offset >= res.Total {
			break
		}
	}
	return data, nil
}

func parseEpisode(ep bangumi.Episode) (calendar.ParsedEpisode, bool) {
	parts := strings.Split(ep.Airdate, "-")
	if len(parts) != 3 {
		return calendar.ParsedEpisode{}, false
	}
	vals := make([]int, 3)
	for i, p := range parts {
		v, err := strconvAtoiSafe(p)
		if err != nil {
			return calendar.ParsedEpisode{}, false
		}
		vals[i] = v
	}

	return calendar.ParsedEpisode{
		ID:       ep.ID,
		Sort:     ep.Sort,
		Name:     htmlUnescape(ep.NameCN, ep.Name),
		AirDate:  [3]int{vals[0], vals[1], vals[2]},
		Duration: ep.Duration,
	}, true
}

func filterFutureEpisodes(episodes []calendar.ParsedEpisode) []calendar.ParsedEpisode {
	today := time.Now().Add(-nowBufferInPastDays * 24 * time.Hour).Unix()
	future := make([]calendar.ParsedEpisode, 0, len(episodes))
	for _, ep := range episodes {
		start := time.Date(ep.AirDate[0], time.Month(ep.AirDate[1]), ep.AirDate[2], 0, 0, 0, 0, time.UTC)
		if start.Unix() > today {
			future = append(future, ep)
		}
	}
	return future
}

func fallbackName(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func uniqueSubjectIDs(collections []bangumi.Collection) map[int]struct{} {
	ids := make(map[int]struct{})
	for _, c := range collections {
		ids[c.SubjectID] = struct{}{}
	}
	return ids
}

func htmlUnescape(values ...string) string {
	for _, v := range values {
		if v != "" {
			return htmlUnescapeSingle(v)
		}
	}
	return ""
}

func htmlUnescapeSingle(s string) string {
	replacer := strings.NewReplacer(
		"&amp;", "&",
		"&lt;", "<",
		"&gt;", ">",
		"&quot;", "\"",
		"&#39;", "'",
	)
	return replacer.Replace(s)
}

func strconvAtoiSafe(input string) (int, error) {
	if strings.TrimSpace(input) == "" {
		return 0, fmt.Errorf("empty string")
	}
	v, err := strconv.Atoi(input)
	if err != nil {
		return 0, err
	}
	return v, nil
}
