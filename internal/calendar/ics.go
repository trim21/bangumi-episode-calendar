package calendar

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type SlimSubject struct {
	Name           string          `json:"name"`
	ID             int             `json:"id"`
	FutureEpisodes []ParsedEpisode `json:"future_episodes"`
}

type ParsedEpisode struct {
	ID       int     `json:"id"`
	Sort     float64 `json:"sort"`
	Name     string  `json:"name"`
	AirDate  [3]int  `json:"air_date"`
	Duration string  `json:"duration"`
}

type Event struct {
	SubjectID   int
	EpisodeID   int
	Start       string
	End         string
	Summary     string
	Description string
}

const namespace = "ef2256c4-162e-446b-9ccf-81050809d0c9"

func RenderICS(subjects []SlimSubject) string {
	cal := newCalendar("Bangumi Episode Air Calendar", map[string]string{
		"X-PUBLISHED-TTL":                 "PT8H",
		"REFRESH-INTERVAL;VALUE=DURATION": "PT8H",
	})

	now := time.Now().UTC()
	for _, subject := range subjects {
		for _, ep := range subject.FutureEpisodes {
			startDate := time.Date(ep.AirDate[0], time.Month(ep.AirDate[1]), ep.AirDate[2], 0, 0, 0, 0, time.UTC)
			if startDate.Unix() > now.Unix()+30*24*60*60 {
				continue
			}

			end := startDate.AddDate(0, 0, 1)
			descriptionParts := []string{fmt.Sprintf("https://bgm.tv/ep/%d", ep.ID)}
			if ep.Name != "" {
				descriptionParts = append(descriptionParts, ep.Name)
			}
			if ep.Duration != "" {
				descriptionParts = append(descriptionParts, "\u65f6\u957f\uff1a"+ep.Duration)
			}

			description := strings.Join(descriptionParts, "\\n")
			cal.addEvent(Event{
				SubjectID:   subject.ID,
				EpisodeID:   ep.ID,
				Start:       formatDateArray(ep.AirDate),
				End:         formatDate(end),
				Summary:     fmt.Sprintf("%s %g", subject.Name, ep.Sort),
				Description: description,
			})
		}
	}

	return cal.String()
}

type iCalendar struct {
	name  string
	now   time.Time
	lines []string
}

func newCalendar(name string, meta map[string]string) *iCalendar {
	cal := &iCalendar{
		name:  name,
		now:   time.Now().UTC(),
		lines: []string{"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//trim21//bangumi-icalendar//CN", "NAME:" + name, "X-WR-CALNAME:" + name},
	}
	for k, v := range meta {
		cal.lines = append(cal.lines, fmt.Sprintf("%s:%s", k, v))
	}
	return cal
}

func (c *iCalendar) addEvent(e Event) {
	c.lines = append(c.lines,
		"BEGIN:VEVENT",
		"UID:"+generateUID(fmt.Sprintf("subject-%d-episode-%d", e.SubjectID, e.EpisodeID)),
		"DTSTAMP:"+formatDateTime(c.now),
		"DTSTART;VALUE=DATE:"+e.Start,
		"DTEND;VALUE=DATE:"+e.End,
		"SUMMARY:"+e.Summary,
	)
	if e.Description != "" {
		c.lines = append(c.lines, "DESCRIPTION:"+e.Description)
	}
	c.lines = append(c.lines, "END:VEVENT")
}

func (c *iCalendar) String() string {
	return strings.Join(c.lines, "\n") + "\nEND:VCALENDAR"
}

func formatDateArray(d [3]int) string {
	return fmt.Sprintf("%04d%s%s", d[0], pad(d[1]), pad(d[2]))
}

func formatDate(d time.Time) string {
	return fmt.Sprintf("%04d%s%s", d.Year(), pad(int(d.Month())), pad(d.Day()))
}

func formatDateTime(d time.Time) string {
	return fmt.Sprintf("%04d%s%sT%s%s%sZ", d.Year(), pad(int(d.Month())), pad(d.Day()), pad(d.Hour()), pad(d.Minute()), pad(d.Second()))
}

func pad(n int) string {
	if n < 10 {
		return fmt.Sprintf("0%d", n)
	}
	return fmt.Sprintf("%d", n)
}

func generateUID(summary string) string {
	ns := uuid.MustParse(namespace)
	return uuid.NewSHA1(ns, []byte(summary)).String()
}
