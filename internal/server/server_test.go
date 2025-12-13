package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	"github.com/trim21/bangumi-episode-calendar/internal/bangumi"
	"github.com/trim21/bangumi-episode-calendar/internal/cache"
	"github.com/trim21/bangumi-episode-calendar/internal/config"
	"github.com/trim21/bangumi-episode-calendar/internal/service"
)

func TestIndexPage(t *testing.T) {
	api := newStubAPI(t)
	defer api.Close()

	handler := buildHandler(t, api.URL)
	req := httptest.NewRequest(http.MethodGet, "/episode-calendar", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", recorder.Code)
	}
	if ct := recorder.Header().Get("Content-Type"); ct == "" || ct[:9] != "text/html" {
		t.Fatalf("unexpected content type %s", ct)
	}
}

func TestCalendarICS(t *testing.T) {
	api := newStubAPI(t)
	defer api.Close()

	handler := buildHandler(t, api.URL)
	req := httptest.NewRequest(http.MethodGet, "/episode-calendar/test-user.ics", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", recorder.Code)
	}
	body := recorder.Body.String()
	if body == "" || !contains(body, "Bangumi Episode Air Calendar") {
		t.Fatalf("ics body missing content: %s", body)
	}
	if ct := recorder.Header().Get("Content-Type"); ct == "" || ct[:13] != "text/calendar" {
		t.Fatalf("unexpected content type %s", ct)
	}
}

func TestUserNotFound(t *testing.T) {
	api := newStubAPI(t)
	defer api.Close()

	handler := buildHandler(t, api.URL)
	req := httptest.NewRequest(http.MethodGet, "/episode-calendar/missing.ics", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404 got %d", recorder.Code)
	}
}

func buildHandler(t *testing.T, baseURL string) http.Handler {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	cfg := config.Config{MaxConcurrency: 5, BangumiBaseURL: baseURL}
	logger := zerolog.New(io.Discard).Level(zerolog.WarnLevel)
	client := bangumi.NewClient(baseURL)
	svc := service.NewCalendarService(client, cache.New(rdb), logger, cfg)
	return NewRouter(svc, logger, false)
}

func newStubAPI(t *testing.T) *httptest.Server {
	t.Helper()
	now := time.Now().UTC()
	airdate := now.Add(24 * time.Hour).Format("2006-01-02")

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/v0/users/"):
			username := strings.TrimPrefix(r.URL.Path, "/v0/users/")
			username = strings.TrimSuffix(username, "/collections")
			if username == "missing" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			typeParam := r.URL.Query().Get("type")
			if typeParam == "3" {
				writeJSON(w, `{"data":[],"total":0,"limit":50,"offset":0}`)
				return
			}
			writeJSON(w, `{"data":[{"subject_id":1,"subject_type":2,"type":1,"tags":[]}],"total":1,"limit":50,"offset":0}`)
		case r.URL.Path == "/v0/subjects/1":
			writeJSON(w, `{"name":"Subject","name_cn":"主题","id":1,"total_episodes":2}`)
		case r.URL.Path == "/v0/episodes" && r.URL.Query().Get("subject_id") == "1":
			payload := `{"data":[{"airdate":"` + airdate + `","name":"E1","name_cn":"第1话","duration":"24m","sort":1,"id":11}],"total":1,"limit":200,"offset":0}`
			writeJSON(w, payload)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func writeJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(body))
}

func contains(s, sub string) bool {
	return strings.Index(s, sub) >= 0
}
