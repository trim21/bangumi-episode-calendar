import * as fs from "fs";
import * as path from "path";

import type { FastifyInstance, FastifyReply } from "fastify";
import { Type as t } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify/types/utils";
import type { FastifyBaseLogger } from "fastify/types/logger";

import { Cache } from "./cache";
import redis from "./redis";
import { projectRoot } from "./config";
import { buildICS } from "./calendar";

const cache = new Cache(redis);
const bangumiCalendarHTML = fs.readFileSync(path.join(projectRoot, "./src/bangumi-calendar.html"));

type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>;

export async function setup(app: App) {
  async function handler(username: string | undefined, res: FastifyReply) {
    if (!username) {
      return res.type("text/html").send(bangumiCalendarHTML);
    }

    const cacheKey = `episode-calendar-v5-${username}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.send(cached);
    }

    const ics = await buildICS(username, cache);

    await cache.set(cacheKey, ics, 60 * 60 * 23);
    return res.send(ics);
  }

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
