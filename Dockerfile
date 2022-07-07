FROM node:lts-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn

COPY tsconfig*.json nest-cli.json ./

COPY src src/

RUN yarn build && rm node_modules -rf

RUN yarn --prod

#####
FROM node:lts-slim

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules/
COPY --from=builder /usr/src/app/dist/ ./dist/

CMD [ "node", "dist/main.js" ]
