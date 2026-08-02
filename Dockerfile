FROM rust:1-bookworm@sha256:a339861ae23e9abb272cea45dfafde21760d2ce6577a70f8a926153677902663 AS builder

WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets

RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:d97bc0a941b8d4be647dc0ee75b264ddbb772f1ac5ba690a4309c00723b23775
WORKDIR /app

COPY --from=builder /src/target/release/bangumi-episode-calendar /app/server

EXPOSE 3000
ENTRYPOINT ["/app/server"]
