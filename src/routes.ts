import * as fs from "fs";
import * as path from "path";

import type { FastifyInstance } from "fastify";

import { Cache } from "./cache";
import redis from "./redis";
import { projectRoot } from "./config";
import { buildICS } from "./calendar";

const cache = new Cache(redis);
const bangumiCalendarHTML = fs.readFileSync(path.join(projectRoot, "./src/bangumi-calendar.html"));

export async function setup(app: FastifyInstance) {
  app.get("/episode-calendar", async (req, res) => {
    const username = (req.query as Record<string, string>).username;
    if (!username) {
      return res.type("text/html").send(bangumiCalendarHTML);
    }

    const cacheKey = `episode-calendar-v5-${username}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.send(cached);
    }

    const ics = await buildICS(username, cache);

    await cache.set(cacheKey, ics, 60 * 60 * 24);
    return res.send(ics);
  });
}
