FROM rust:1-bookworm@sha256:5c836835420f12753291d480669627d300f92c51bcd65f98a7439d607e978c37 AS builder

WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets

RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:5c94e1d2e831f0fadfe4048427f6ff3a91481606da2841c5b26674220ac84d2d
WORKDIR /app

COPY --from=builder /src/target/release/bangumi-episode-calendar /app/server

EXPOSE 3000
ENTRYPOINT ["/app/server"]
