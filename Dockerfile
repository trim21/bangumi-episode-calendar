FROM rust:1-bookworm@sha256:adab7941580c74513aa3347f2d2a1f975498280743d29ec62978ba12e3540d3a AS builder

WORKDIR /src

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets

RUN cargo build --release --locked

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:e1fd250ce83d94603e9887ec991156a6c26905a6b0001039b7a43699018c0733
WORKDIR /app

COPY --from=builder /src/target/release/bangumi-episode-calendar /app/server

EXPOSE 3000
ENTRYPOINT ["/app/server"]
