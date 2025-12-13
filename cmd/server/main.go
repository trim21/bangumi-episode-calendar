package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/trim21/bangumi-episode-calendar/internal/bangumi"
	"github.com/trim21/bangumi-episode-calendar/internal/cache"
	"github.com/trim21/bangumi-episode-calendar/internal/config"
	"github.com/trim21/bangumi-episode-calendar/internal/server"
	"github.com/trim21/bangumi-episode-calendar/internal/service"
)

func main() {
	if hasHelpFlag(os.Args) {
		fmt.Println("Bangumi Episode Calendar server")
		return
	}

	cfg := config.Load()
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	log.Logger = logger

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Username: cfg.RedisUsername,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	defer func() {
		_ = rdb.Close()
	}()

	svc := service.NewCalendarService(bangumi.NewClient(cfg.BangumiBaseURL), cache.New(rdb), logger, cfg)
	handler := server.NewRouter(svc, logger, cfg.EnableRequestLogging)

	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		logger.Info().Str("addr", srv.Addr).Msg("server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("listen")
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error().Err(err).Msg("server shutdown failed")
	}
}

func hasHelpFlag(args []string) bool {
	for _, a := range args {
		if a == "-h" || a == "--help" {
			return true
		}
	}
	return false
}
