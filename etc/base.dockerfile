FROM node:18-slim@sha256:a2598120308db34b12278f10a694ae0073e492cc9b98bae471543b90eeabee73 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest@sha256:7dd276a0b7852148fa4ba73ea78f91a222a5bd53f5c5dc894df543452c1ef68f

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "/nodejs/bin/node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
