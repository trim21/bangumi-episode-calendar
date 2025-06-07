FROM node:20.19.2-slim@sha256:cb4abfbba7dfaa78e21ddf2a72a592e5f9ed36ccf98bdc8ad3ff945673d288c2 AS base

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
