package bangumi

import (
	"context"
	"time"
	// "encoding/json" // No longer needed directly in methods if using SetResult
	"fmt"
	"net/http"
	"net/url"

	"github.com/go-resty/resty/v2"
	"github.com/rs/zerolog/log"

	"app/internal/config"
)

const (
	bangumiBaseURL = "https://api.bgm.tv"
	userAgent      = "app/bangumi-episode-calendar-go (https://github.com/trim21/bangumi-episode-calendar)"
)

// Client handles communication with the Bangumi API using Resty.
type Client struct {
	restyClient *resty.Client
	// apiKey is now handled by restyClient's Auth Token or Header
}

// NewClient creates a new Bangumi API client using Resty.
func NewClient(cfg *config.Config) *Client {
	client := resty.New().
		SetBaseURL(bangumiBaseURL).
		SetHeader("User-Agent", userAgent).
		SetHeader("Accept", "application/json").
		SetTimeout(10 * time.Second)

	return &Client{
		restyClient: client,
	}
}

// --- API Method Implementations ---

// GetCalendar fetches the general broadcast calendar.
func (c *Client) GetCalendar(ctx context.Context) ([]CalendarItem, error) {
	var calendarData []CalendarItem
	path := "/calendar" // Assuming this endpoint exists

	log.Debug().Str("method", http.MethodGet).Str("url", bangumiBaseURL+path).Msg("Making Bangumi API request (GetCalendar)")

	resp, err := c.restyClient.R().
		SetContext(ctx).
		SetResult(&calendarData). // Automatically unmarshal JSON into calendarData on success
		// SetError(&ErrorResponse{}). // Optional: Define a struct for API errors
		Get(path)

	// Handle transport errors
	if err != nil {
		// Log the raw response body if available for debugging transport errors
		logCtx := log.Error().Err(err).Str("url", bangumiBaseURL+path)
		if resp != nil {
			logCtx = logCtx.Str("responseBody", resp.String())
		}
		logCtx.Msg("GetCalendar request transport failed")
		return nil, fmt.Errorf("failed to execute GetCalendar request to %s: %w", path, err)
	}

	// Handle API errors (non-2xx status codes)
	if resp.IsError() {
		log.Error().
			Str("url", resp.Request.URL).
			Int("statusCode", resp.StatusCode()).
			Str("status", resp.Status()).
			Str("responseBody", resp.String()).
			Msg("GetCalendar API request failed")
		// if apiErr, ok := resp.Error().(*ErrorResponse); ok && apiErr != nil {
		//     return nil, fmt.Errorf("bangumi API error for GetCalendar: %s", apiErr.Message)
		// }
		return nil, fmt.Errorf("bangumi API request failed for GetCalendar with status %d. Body: %s", resp.StatusCode(), resp.String())
	}

	// On success, calendarData is populated by SetResult
	return calendarData, nil
}

// GetUserCollection fetches a user's collection.
func (c *Client) GetUserCollection(ctx context.Context, userID string /* add other params like type, ids */) ([]UserCollectionItem, error) {
	// Path for v0 API
	path := fmt.Sprintf("/v0/users/%s/collections", userID)
	params := url.Values{}
	// params.Add("subject_type", "2") // Example filter for anime
	// params.Add("type", "3")         // Example filter for "watching" status
	// params.Add("limit", "50")       // Consider adding limit/offset for pagination
	// params.Add("offset", "0")

	// The actual API returns a paginated structure: { "data": [...], "total": N, "limit": L, "offset": O }
	// Define a struct to match this response
	type UserCollectionResponse struct {
		Data   []UserCollectionItem `json:"data"`
		Total  int                  `json:"total"`
		Limit  int                  `json:"limit"`
		Offset int                  `json:"offset"`
	}
	var collectionResponse UserCollectionResponse

	log.Debug().Str("method", http.MethodGet).Str("url", bangumiBaseURL+path).Interface("params", params).Msg("Making Bangumi API request (GetUserCollection)")

	resp, err := c.restyClient.R().
		SetContext(ctx).
		SetQueryParamsFromValues(params). // Set query parameters
		SetResult(&collectionResponse).   // Automatically unmarshal JSON into collectionResponse
		// SetError(&ErrorResponse{}). // Optional: Define a struct for API errors
		Get(path)

	// Handle transport errors
	if err != nil {
		logCtx := log.Error().Err(err).Str("url", bangumiBaseURL+path).Interface("params", params)
		if resp != nil {
			logCtx = logCtx.Str("responseBody", resp.String())
		}
		logCtx.Msg("GetUserCollection request transport failed")
		return nil, fmt.Errorf("failed to execute GetUserCollection request for user %s: %w", userID, err)
	}

	// Handle API errors (non-2xx status codes)
	if resp.IsError() {
		log.Error().
			Str("url", resp.Request.URL).
			Int("statusCode", resp.StatusCode()).
			Str("status", resp.Status()).
			Str("responseBody", resp.String()).
			Msg("GetUserCollection API request failed")
		// if apiErr, ok := resp.Error().(*ErrorResponse); ok && apiErr != nil {
		//     return nil, fmt.Errorf("bangumi API error for GetUserCollection: %s", apiErr.Message)
		// }
		return nil, fmt.Errorf("bangumi API request failed for GetUserCollection (user: %s) with status %d. Body: %s", userID, resp.StatusCode(), resp.String())
	}

	// On success, collectionResponse is populated. Return the relevant part.
	return collectionResponse.Data, nil
}

// Add other methods corresponding to the Bangumi API endpoints used in the original app.
// e.g., GetSubjectDetails, GetEpisodeList etc. following the pattern above.

// Define your response structs (CalendarItem, UserCollectionItem) if not already defined elsewhere.
// Example:
// type CalendarItem struct { ... }
// type UserCollectionItem struct { ... }
// type SubjectInfo struct { ... }
// type ErrorResponse struct { ... } // For SetError
