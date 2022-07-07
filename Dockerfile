FROM node:lts-bullseye-slim as builder


#####
FROM node:lts-bullseye-slim

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY --from=builder package.json yarn.lock node_modules dist ./

RUN yarn build

CMD [ "node", "dist/main.js" ]
