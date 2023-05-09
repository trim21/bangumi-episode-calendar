FROM node:18-slim@sha256:2ff9841de879f1a2d2d8ef83183c2d93435c451a36d6cfb37b3331d1386c00f8 as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --prod && \
    rm package.json yarn.lock

FROM gcr.io/distroless/nodejs18-debian11:latest@sha256:1d068dbc7a400b506c96af7799ea5eac2abbf695c7142c0695c4b054c144abfb

ENV NODE_ENV=production

WORKDIR /app

ENTRYPOINT [ "/nodejs/bin/node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /app/ /app
