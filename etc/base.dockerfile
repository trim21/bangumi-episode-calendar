FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY package.json .yarnrc.yml yarn.lock ./
COPY .yarn/ ./.yarn/

RUN npm pkg delete scripts.prepare &&\
    yarn workspaces focus --production app &&\
    rm -rf package.json yarn.lock .yarnrc.yml .yarn

FROM node:18-slim

ENV NODE_ENV=production

WORKDIR /usr/src/app

ENTRYPOINT [ "node", "--no-warnings", "--loader=@esbuild-kit/esm-loader", "--enable-source-maps", "./src/main.ts" ]

COPY --from=builder /usr/src/app/ /usr/src/app
