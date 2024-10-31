import * as fs from "node:fs";
import * as path from "node:path";

import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type as t } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifyBaseLogger } from "fastify/types/logger";
import type { RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify/types/utils";

import { Cache } from "./cache";
import { buildICS } from "./calendar";
import { projectRoot } from "./config";
import redis from "./redis";

const cache = new Cache(redis);
const bangumiCalendarHTML = fs.readFileSync(path.join(projectRoot, "./src/bangumi-calendar.html"));

type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>;

async function handler(username: string | undefined, res: FastifyReply) {
  if (!username) {
    return res.type("text/html").send(bangumiCalendarHTML);
  }

  const cacheKey = `episode-calendar-v5.0-${username}`;

  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.send(cached);
  }

  const ics = await buildICS(username, cache);

  await cache.set(cacheKey, ics, 60 * 60 * 23);
  return res.send(ics);
}

export async function setup(app: App) {
  app.get(
    "/episode-calendar/:username.ics",
    {
      schema: {
        params: t.Object({
          username: t.String(),
        }),
      },
    },
    async (req, res) => {
      const { username } = req.params;

      return await handler(username, res);
    },
  );

  app.get("/episode-calendar", async (req, res) => {
    const username = (req.query as Record<string, string>).username;
    return await handler(username, res);
  });
}
