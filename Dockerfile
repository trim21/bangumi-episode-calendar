FROM rust:1-bookworm@sha256:9760830fa75bd0d8ddf2207d2dd066edaeea7b7c163a243e185c2d4366059e73 AS builder

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
