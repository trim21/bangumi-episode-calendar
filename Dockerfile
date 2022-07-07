FROM node:lts-bullseye-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY package.json yarn.lock src ./

RUN yarn build

#####
FROM node:lts-bullseye-slim

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY --from=builder package.json yarn.lock node_modules dist ./

CMD [ "node", "dist/main.js" ]
