package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Host                 string
	Port                 int
	RedisAddr            string
	RedisDB              int
	RedisUsername        string
	RedisPassword        string
	EnableRequestLogging bool
	MaxConcurrency       int
	BangumiBaseURL       string
}

func Load() Config {
	return Config{
		Host:                 getEnv("HOST", "0.0.0.0"),
		Port:                 mustInt(getEnv("PORT", "3000"), 3000),
		RedisAddr:            fmt.Sprintf("%s:%s", getEnv("REDIS_HOST", "127.0.0.1"), getEnv("REDIS_PORT", "6379")),
		RedisDB:              mustInt(getEnv("REDIS_DB", "0"), 0),
		RedisUsername:        getEnv("REDIS_USERNAME", ""),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		EnableRequestLogging: strings.EqualFold(getEnv("ENABLE_REQUEST_LOGGING", "false"), "true"),
		MaxConcurrency:       mustInt(getEnv("MAX_CONCURRENCY", "20"), 20),
		BangumiBaseURL:       getEnv("BANGUMI_BASE_URL", "https://api.bgm.tv"),
	}
}

func getEnv(key, def string) string {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	return val
}

func mustInt(val string, def int) int {
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return def
	}
	return parsed
}
