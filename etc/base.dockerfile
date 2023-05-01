FROM node:19-slim@sha256:602626a95fde52072639a61a3bb6dad86aea5d6776687788f707d6bc2c6e0b87 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
