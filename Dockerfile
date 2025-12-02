FROM node:20.19.5-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3 AS base

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
