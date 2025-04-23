package api

import (
	"app/internal/bangumi" // Use app module name
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/redis/rueidis"
	"github.com/rs/zerolog/log"
)

// CalendarHandler holds dependencies for calendar-related endpoints.
type CalendarHandler struct {
	redisClient    rueidis.Client
	bangumiService *bangumi.Service
}

// NewCalendarHandler creates a new handler instance.
func NewCalendarHandler(redis rueidis.Client, service *bangumi.Service) *CalendarHandler {
	return &CalendarHandler{
		redisClient:    redis,
		bangumiService: service,
	}
}

// --- Handler Functions ---

// GetUserCalendar handles requests for a specific user's calendar.
func (h *CalendarHandler) GetUserCalendar(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Add a timeout to the request context
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second) // Example timeout
	defer cancel()

	log.Info().Str("userID", username).Msg("Fetching calendar for user")

	// Call the service layer to get the processed data
	calendarData, err := h.bangumiService.GetProcessedCalendarForUser(ctx, username)
	if err != nil {
		log.Error().Err(err).Str("userID", username).Msg("Error getting user calendar data")
		// TODO: Distinguish between different error types (e.g., not found vs server error)
		http.Error(w, "Failed to retrieve calendar data", http.StatusInternalServerError)
		return
	}

	// Respond with JSON
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(calendarData); err != nil {
		log.Error().Err(err).Str("userID", username).Msg("Failed to encode response JSON")
		// Client already received 200 OK, hard to change now, just log.
	}
}

// Add other handler functions as needed (e.g., for a global calendar).
