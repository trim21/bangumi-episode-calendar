package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Internal package imports using 'app' module name
	"app/internal/api"
	"app/internal/bangumi"
	"app/internal/cache"
	"app/internal/config"
	"app/pkg/logger"

	"github.com/rs/zerolog/log"
)

func main() {
	// --- Configuration ---
	cfg, err := config.Load()
	if err != nil {
		// Use standard logger before zerolog is initialized
		fmt.Fprintf(os.Stderr, "Error loading configuration: %v\n", err)
		os.Exit(1)
	}

	// --- Logger ---
	logger.Setup(cfg.LogLevel) // Initialize zerolog

	// --- Redis Client ---
	redisClient, err := cache.NewClient(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize Redis client")
	}
	defer redisClient.Close() // Ensure client is closed on exit
	log.Info().Msg("Redis client initialized")

	bangumiService := bangumi.NewService(cfg, redisClient, bangumi.NewClient(cfg))
	log.Info().Msg("Bangumi service initialized")

	// --- HTTP Router ---
	// Pass dependencies (redis, bangumi service) to the router/handler setup
	router := api.NewRouter(cfg, redisClient, bangumiService)
	log.Info().Msg("HTTP router initialized")

	// --- HTTP Server ---
	address := ":" + cfg.Port
	httpServer := &http.Server{
		Addr:         address,
		Handler:      router,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// --- Start Server Goroutine ---
	go func() {
		log.Info().Str("address", address).Msg("Starting HTTP server")
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("Failed to start HTTP server")
		}
		log.Info().Msg("HTTP server stopped")
	}()

	// --- Graceful Shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit // Block until a signal is received

	log.Warn().Msg("Shutdown signal received, starting graceful shutdown...")

	// --- Shutdown Context ---
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second) // 30-second shutdown timeout
	defer cancel()

	// --- Shutdown Server ---
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("HTTP server forced to shutdown")
	}

	log.Info().Msg("Server gracefully stopped")
}
