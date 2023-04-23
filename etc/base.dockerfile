FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm pkg delete scripts.prepare &&\
    npm ci --omit=dev &&\
    rm -rf package.json package-lock.json

FROM node:18-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

ENTRYPOINT [ "node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /usr/src/app/ /usr/src/app
