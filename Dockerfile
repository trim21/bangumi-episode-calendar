FROM node:lts-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY tsconfig*.json nest-cli.json ./

COPY src src/

RUN yarn build && rm -rf node_modules tsconfig*.json nest-cli.json

RUN yarn --prod && ls -ahl && rm -rf yarn.lock package.json .husky

#####
FROM node:lts-slim

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/ ./

CMD [ "node", "dist/main.js" ]
