package server

import (
	"context"
	_ "embed"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"

	"github.com/trim21/bangumi-episode-calendar/internal/service"
)

//go:embed static/bangumi-calendar.html
var indexHTML []byte

//go:embed static/home.html
var homeHTML []byte

type Handler struct {
	svc *service.CalendarService
	log zerolog.Logger
}

func NewRouter(svc *service.CalendarService, log zerolog.Logger, enableLogging bool) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	if enableLogging {
		r.Use(middleware.Logger)
	}

	h := &Handler{svc: svc, log: log}

	r.Get("/", h.home)
	r.Get("/episode-calendar", h.index)
	r.Get("/episode-calendar/{username}.ics", h.episodeCalendar)

	return r
}

func (h *Handler) home(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(homeHTML)
}

func (h *Handler) index(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(indexHTML)
		return
	}
	ctx := r.Context()
	h.writeICS(ctx, w, username)
}

func (h *Handler) episodeCalendar(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if username == "" {
		http.Error(w, "username is required", http.StatusBadRequest)
		return
	}
	h.writeICS(r.Context(), w, username)
}

func (h *Handler) writeICS(ctx context.Context, w http.ResponseWriter, username string) {
	ics, err := h.svc.BuildICS(ctx, username)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrUserNotFound) {
			status = http.StatusNotFound
		}
		h.log.Error().Str("username", username).Err(err).Msg("failed to build ics")
		http.Error(w, http.StatusText(status), status)
		return
	}

	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	_, _ = w.Write([]byte(ics))
}
