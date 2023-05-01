FROM node:18-slim@sha256:b8a9ad50d8833a2aede22170a517e64c79776e9145811d7f6649bb123fb4e258 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest@sha256:1d068dbc7a400b506c96af7799ea5eac2abbf695c7142c0695c4b054c144abfb

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
