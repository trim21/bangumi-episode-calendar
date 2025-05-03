FROM node:20.19.1-slim@sha256:83e53269616ca1b22cf7533e5db4e2f1a0c24a8e818b21691d6d4a69ec9e2c6d AS base

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
