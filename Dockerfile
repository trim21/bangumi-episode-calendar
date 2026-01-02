FROM rust:1-bookworm@sha256:3d0d1a335e1d1220d416a1f38f29925d40ec9929d3c83e07a263adf30a7e4aa3 AS builder

WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets

RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:6ecf048c4622b32291b92266c6618c9ca34989bbfa8ae6dcb82216dce082aabe
WORKDIR /app

COPY --from=builder /src/target/release/bangumi-episode-calendar /app/server

EXPOSE 3000
ENTRYPOINT ["/app/server"]
