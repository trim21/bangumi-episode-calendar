FROM golang:1.22-bookworm AS builder

WORKDIR /src
ENV CGO_ENABLED=0

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -trimpath -o /out/server ./cmd/server

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=builder /out/server /app/server

EXPOSE 3000
ENTRYPOINT ["/app/server"]
