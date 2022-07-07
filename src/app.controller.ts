import fs from "fs";
import path from "path";

import { FastifyReply } from "fastify";
import { Controller, Get, Inject, Query, Response } from "@nestjs/common";

import { Cache } from "./cache";
import { buildICS } from "./calendar";

const bangumiCalendarHTML = fs.readFileSync(path.join(__dirname, "./bangumi-calendar.html"));

@Controller()
export class AppController {
  constructor(@Inject(Cache) private readonly cache: Cache) {}

  @Get("/episode-calendar")
  async episodeCalendar(@Query("username") username: string, @Response() res: FastifyReply): Promise<any> {
    if (!username) {
      return res.header("content-type", "text/html").send(bangumiCalendarHTML);
    }
    const cacheKey = `episode-calendar-v0-${username}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return res.send(cached);
    }

    const ics = await buildICS(username, this.cache);
    await this.cache.set(cacheKey, ics, 60 * 60 * 24);
    return res.send(ics);
  }
}
