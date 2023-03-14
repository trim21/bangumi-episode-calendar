FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

ENV NODE_ENV=production

RUN npm pkg delete scripts.prepare && npm ci && rm package.json package-lock.json

FROM node:18-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

ENTRYPOINT [ "node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /usr/src/app/ /usr/src/app
