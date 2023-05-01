FROM node:20-slim@sha256:2cd3fdd49eb8bc1b942be824030469beca57fb6723edaaa9041e593b79a56cd1 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
