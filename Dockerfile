FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY . ./

RUN yarn --prod

##############

FROM node:18-slim

WORKDIR /usr/src/app
ENV NODE_ENV=production
ENTRYPOINT [ "node", "--no-warnings", "--loader=ts-node/esm/transpile-only", "--experimental-specifier-resolution=node", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /usr/src/app/ ./
