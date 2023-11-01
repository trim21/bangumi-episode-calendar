FROM node:18-slim@sha256:a2598120308db34b12278f10a694ae0073e492cc9b98bae471543b90eeabee73 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest@sha256:af46ad3a1c8b82e6c1dfbbbd175b4b455a35b846ffc4a8cda7cb5b7031113bff

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "/nodejs/bin/node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
