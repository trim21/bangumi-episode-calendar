FROM node:lts-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY tsconfig*.json src ./

RUN yarn build

#####
FROM node:lts-slim

WORKDIR /usr/src/app

COPY --from=builder package.json yarn.lock node_modules dist ./

CMD [ "node", "dist/main.js" ]
