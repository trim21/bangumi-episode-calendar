FROM rust:1-bookworm@sha256:9676d0547a259997add8f5924eb6b959c589ed39055338e23b99aba7958d6d31 AS builder

WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets

RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app

COPY --from=builder /src/target/release/bangumi-episode-calendar /app/server

EXPOSE 3000
ENTRYPOINT ["/app/server"]
