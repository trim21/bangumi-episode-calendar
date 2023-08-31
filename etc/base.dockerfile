FROM node:18-slim@sha256:fea6dbb8697baddc6c58f29337bbd3b4abaab97ae7e70d148fe21d558803da43 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest@sha256:117e714f608555028a18c8162db6246557ec667159d18714a4dd7a9ee5948be2

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "/nodejs/bin/node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
