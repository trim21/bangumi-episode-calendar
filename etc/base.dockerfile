FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn --prod && rm package.json yarn.lock

FROM node:18-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

ENTRYPOINT [ "node", "--no-warnings", "--loader=ts-node/esm/transpile-only", "--experimental-specifier-resolution=node", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /usr/src/app/ /usr/src/app
