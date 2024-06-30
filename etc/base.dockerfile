FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs20

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "/nodejs/bin/node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
