import fs from "fs";
import path from "path";

import axios, { AxiosError } from "axios";
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

  @Get("/")
  async getHello(): Promise<any> {
    const subjectID = 8;
    const key = `subject-v1-${subjectID}`;
    const cached = await this.cache.get(key);
    if (cached !== null) {
      return cached;
    }
    try {
      const res = await axios.get(`https://api.bgm.tv/v0/subjects/${subjectID}`, {
        headers: {
          "user-agent": "bangumi/contrib",
        },
      });
      const data = res.data;

      await this.cache.set(key, data, 60 * 60 * 24);

      return data;
    } catch (e) {
      if (e instanceof AxiosError) {
        return e.toJSON();
      }

      throw e;
    }
  }
}
