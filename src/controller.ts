import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { FastifyReply } from "fastify";
import { Controller, Get, Query, Response } from "@nestjs/common";

import { Cache } from "@/cache";
import { buildICS } from "@/calendar";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const bangumiCalendarHTML = fs.readFileSync(path.join(__dirname, "./bangumi-calendar.html"));

@Controller()
export class AppController {
  constructor(private readonly cache: Cache) {
    if (this.cache === undefined) {
      throw new Error("no cache");
    }
  }

  @Get("/episode-calendar")
  async episodeCalendar(@Query("username") username: string, @Response() res: FastifyReply): Promise<any> {
    if (!username) {
      return res.type("text/html").send(bangumiCalendarHTML);
    }

    const cacheKey = `episode-calendar-v3-${username}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return res.send(cached);
    }

    const ics = await buildICS(username, this.cache);

    await this.cache.set(cacheKey, ics, 60 * 60 * 24);
    return res.send(ics);
  }
}
