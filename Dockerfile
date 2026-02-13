FROM rust:1-bookworm@sha256:c38b1b917cb749e50aea7dd6e87f6e315d62a4bc84e38d63f5eb8b1908db1b9a AS builder

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
