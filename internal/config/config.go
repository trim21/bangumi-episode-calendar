package config

import (
	"fmt"
	"time"

	"go-simpler.org/env"
)

type Config struct {
	LogLevel     string        `env:"LOG_LEVEL" default:"info"`
	Port         string        `env:"PORT" default:"4157"`
	RedisAddr    string        `env:"REDIS_ADDR"`
	RedisPass    string        `env:"REDIS_PASSWORD"`
	CacheTTL     time.Duration `env:"CACHE_TTL" default:"1h"`
	BangumiToken string        `env:"BANGUMI_TOKEN"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := env.Load(&cfg, nil); err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}
	return &cfg, nil
}
