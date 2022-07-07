FROM node:lts-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY tsconfig*.json nest-cli.json ./

COPY src src/

RUN yarn build

#####
FROM node:lts-slim

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json /usr/src/app/yarn.lock ./

RUN yarn --prod --cache-folder /tmp/.junk && rm -rf /tmp/.junk

COPY --from=builder /usr/src/app/dist/ ./dist/

CMD [ "node", "dist/main.js" ]
