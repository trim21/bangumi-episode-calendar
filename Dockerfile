FROM node:lts-bullseye-slim

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY . .

RUN yarn build

CMD [ "node", "dist/main.js" ]
