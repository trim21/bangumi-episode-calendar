package bangumi

import (
	"app/internal/config" // Use app module name
	"context"
	"encoding/json"
	"fmt"

	"app/internal/cache" // Use app module name

	"github.com/redis/rueidis"
	"github.com/rs/zerolog/log"
)

// Service encapsulates the business logic for Bangumi calendar operations.
type Service struct {
	cfg         *config.Config
	redisClient rueidis.Client
	apiClient   *Client // Bangumi API client
}

// NewService creates a new Bangumi service instance.
func NewService(cfg *config.Config, redisClient rueidis.Client, apiClient *Client) *Service {
	return &Service{
		cfg:         cfg,
		redisClient: redisClient,
		apiClient:   apiClient,
	}
}

// GetProcessedCalendarForUser fetches, processes, and potentially caches calendar data for a user.
// This is where the core logic translating the original `calendar.ts` would go.
func (s *Service) GetProcessedCalendarForUser(ctx context.Context, userID string) (interface{}, error) {
	// 1. Define Cache Key
	cacheKey := fmt.Sprintf("calendar:user:%s", userID)

	// 2. Try fetching from Cache
	cachedData, err := cache.Get(ctx, s.redisClient, cacheKey)
	if err != nil {
		log.Warn().Err(err).Str("key", cacheKey).Msg("Failed to get data from cache, proceeding to fetch")
		// Don't return error yet, just log and try fetching
	}

	if cachedData != "" {
		log.Debug().Str("key", cacheKey).Msg("Cache hit")
		var result interface{} // Define the structure of your final processed data
		if err := json.Unmarshal([]byte(cachedData), &result); err == nil {
			return result, nil
		}
		log.Warn().Err(err).Str("key", cacheKey).Msg("Failed to unmarshal cached data, fetching fresh")
	}

	log.Debug().Str("key", cacheKey).Msg("Cache miss, fetching from API")

	// 3. Fetch data from Bangumi API (using methods in apiClient)
	// Example: Fetch user's collection and maybe general calendar or specific subject details
	userCollection, err := s.apiClient.GetUserCollection(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user collection from API: %w", err)
	}

	// Potentially fetch general calendar or details for subjects in collection
	// calendarItems, err := s.apiClient.GetCalendar(ctx)
	// ... fetch episode details for items in userCollection ...

	// 4. Process the fetched data
	// This is the complex part: replicate the filtering, sorting, grouping,
	// and date/time logic from the original TypeScript `calendar.ts`.
	// You'll likely need Go's `time` package extensively.
	processedResult := s.processRawData(userCollection)

	// 5. Cache the processed result
	resultBytes, err := json.Marshal(processedResult)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal processed data for caching")
		// Return the processed data anyway, even if caching fails
		return processedResult, nil
	}

	err = cache.Set(ctx, s.redisClient, cacheKey, string(resultBytes), s.cfg.CacheTTL)
	if err != nil {
		log.Error().Err(err).Str("key", cacheKey).Msg("Failed to set data in cache")
		// Log error but don't fail the request because of cache write failure
	} else {
		log.Debug().Str("key", cacheKey).Msg("Successfully cached processed data")
	}

	return processedResult, nil
}

func (s *Service) processRawData(collection []UserCollectionItem) interface{} {
	log.Warn().Msg("processRawData logic is not fully implemented")

	return map[string]interface{}{
		"message":    "Processing logic not fully implemented",
		"collection": collection,
	}
}
