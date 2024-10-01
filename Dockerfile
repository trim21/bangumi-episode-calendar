FROM node:20.17.0-slim@sha256:2394e403d45a644e41ac2a15b6f843a7d4a99ad24be48c27982c5fdc61a1ef17 AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs20@sha256:2818fb8cdc25894d9c6b6e6bf72b4033d949f5d6d65173a6d7aeec0266f03037

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "/nodejs/bin/node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app

COPY . ./
