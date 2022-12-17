FROM node:18-slim as builder

WORKDIR /usr/src/app

COPY . ./

RUN yarn --prod

ENV NODE_ENV=production
