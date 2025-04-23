package cache

import (
	"context"
	"fmt"
	"time"

	"app/internal/config" // Use app module name

	"github.com/redis/rueidis"
)

// NewClient initializes and returns a rueidis client.
func NewClient(cfg *config.Config) (rueidis.Client, error) {
	client, err := rueidis.NewClient(rueidis.ClientOption{
		InitAddress: []string{cfg.RedisAddr},
		Password:    cfg.RedisPass,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create rueidis client: %w", err)
	}

	// Ping to verify connection during startup
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = client.Do(ctx, client.B().Ping().Build()).Error()
	if err != nil {
		client.Close() // Close the partially created client on error
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return client, nil
}

// --- Example Cache Helper Functions ---

// Get retrieves a value from Redis. Returns empty string and nil error if key not found.
func Get(ctx context.Context, client rueidis.Client, key string) (string, error) {
	val, err := client.Do(ctx, client.B().Get().Key(key).Build()).ToString()
	if err != nil {
		if rueidis.IsRedisNil(err) {
			return "", nil // Key not found is treated as empty, not an error
		}
		return "", fmt.Errorf("redis GET error for key '%s': %w", key, err)
	}
	return val, nil
}

// Set stores a value in Redis with a TTL.
func Set(ctx context.Context, client rueidis.Client, key string, value string, ttl time.Duration) error {
	err := client.Do(ctx, client.B().Set().Key(key).Value(value).Ex(ttl).Build()).Error()
	if err != nil {
		return fmt.Errorf("redis SET error for key '%s': %w", key, err)
	}
	return nil
}

// Delete removes a key from Redis.
func Delete(ctx context.Context, client rueidis.Client, key string) error {
	err := client.Do(ctx, client.B().Del().Key(key).Build()).Error()
	if err != nil {
		return fmt.Errorf("redis DEL error for key '%s': %w", key, err)
	}
	return nil
}
