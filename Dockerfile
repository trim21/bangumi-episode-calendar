# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./
# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# -ldflags="-w -s" strips debug information and symbols for smaller binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server ./cmd/server

# Final stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /server /app/server

# Copy potential templates or static files if needed
# COPY --from=builder /app/templates /app/templates

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["/app/server"]