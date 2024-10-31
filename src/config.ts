import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import * as url from "node:url";

import type { RedisOptions } from "ioredis";

const { NODE_ENV } = process.env;
export const production = NODE_ENV === "production";
export const projectRoot = url.fileURLToPath(new URL("..", import.meta.url));
export const pkg = JSON.parse(fs.readFileSync(path.resolve(projectRoot, "package.json"), "utf8")) as {
  version: string;
};

export const redisOption = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number.parseInt(process.env.REDIS_PORT ?? "6379"),
  db: Number.parseInt(process.env.REDIS_DB ?? "0"),
  username: "",
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
} satisfies RedisOptions;
