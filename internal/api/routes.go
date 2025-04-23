package api

import (
	"app/internal/bangumi" // Use app module name
	"app/internal/config"
	_ "embed"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/redis/rueidis"
	"github.com/rs/zerolog/log"
)

//go:embed index.html
var indexHtml []byte

// NewRouter creates and configures the main Chi router.
func NewRouter(cfg *config.Config, redisClient rueidis.Client, bangumiService *bangumi.Service) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Recoverer)                 // Recover from panics, log stack trace
	r.Use(middleware.Timeout(60 * time.Second)) // Set a request timeout

	// Add CORS middleware if the API needs to be accessed from browsers on different origins
	// r.Use(cors.Handler(cors.Options{...}))

	// --- Handlers ---
	// Initialize handlers, injecting dependencies
	calendarHandler := NewCalendarHandler(redisClient, bangumiService)

	// --- Routes ---
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write(indexHtml)
	})

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		// Simple health check - potentially check Redis ping here too
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	r.Get("/episode-calendar", calendarHandler.GetUserCalendar)

	// Add other top-level routes (e.g., maybe a global calendar view if applicable)
	// r.Get("/calendar/global", ...)

	log.Info().Msg("Routes configured")
	return r
}
