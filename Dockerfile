FROM node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS base

WORKDIR /app

# build dist/index.mjs
FROM base AS builder

COPY package.json yarn.lock ./

RUN corepack enable && corepack prepare --activate \
  && yarn install --frozen-lockfile

COPY . ./

RUN yarn run build

FROM base AS prod-deps

COPY package.json yarn.lock ./

RUN corepack enable && corepack prepare --activate \
  && npm pkg delete scripts.prepare \
  && yarn install --prod --frozen-lockfile

FROM base AS final

ENTRYPOINT ["node", "--enable-source-maps", "./dist/index.mjs"]

ENV NODE_ENV=production

COPY --from=prod-deps /app/ /app/

ARG ARG_REF
ENV REF=$ARG_REF

COPY --from=builder /app/dist /app/dist
COPY . ./
