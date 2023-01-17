import pLimit from "p-limit";
import { createError } from "@fastify/error";
import dayjs from "dayjs";

import type { Collection, Episode, Paged, Subject } from "./bangumi";
import type { Cache } from "./cache";
import { get } from "./request";
import { notNull, unix, uuidByString } from "./util";
import { logger } from "./logger";

const NotFoundError = createError("NOT_FOUND", "%s", 404);

const limit = pLimit(20);

export async function buildICS(username: string, cache: Cache): Promise<string> {
  logger.info(`fetching collection of user ${username}`);
  let collections: Array<Collection> = await fetchAllUserCollection(username);

  const subjects: SlimSubject[] = (
    await Promise.all(collections.map((s) => limit(() => getSubjectInfo(s.subject_id, cache))))
  )
    .filter(notNull)
    .filter((s) => s.future_episodes.length !== 0);

  return renderICS(subjects);
}

async function fetchAllUserCollection(username: string, pageSize: number = 50): Promise<Array<Collection>> {
  const data: Array<Collection> = [];

  for (const collectionType of [1, 3]) {
    let offset: number = 0;
    let body: Paged<Collection>;
    do {
      const res = await get(`v0/users/${username}/collections`, {
        query: {
          type: collectionType,
          offset,
          limit: pageSize,
        },
      });

      if (!res.ok) {
        if (res.code === 404) {
          throw new NotFoundError(`user ${username} not found`);
        }

        throw new Error(`Unexpected HTTP ERROR ${res.body}`);
      }

      body = JSON.parse(res.body) as Paged<Collection>;

      data.push(
        ...body.data.filter((c) => c.subject_type === SubjectTypeAnime || c.subject_type === SubjectTypeEpisode),
      );

      offset += pageSize;
    } while (offset < body.total);
  }

  return data;
}

interface SlimSubject {
  name: string;
  id: number;
  future_episodes: Array<ParsedEpisode>;
}

async function getSubjectInfo(subjectID: number, cache: Cache): Promise<SlimSubject | null> {
  const cacheKey = `subject-v3-${subjectID}`;

  const cached = await cache.get<SlimSubject>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let data: SlimSubject;
  let total_episode = 0;

  logger.info(`fetching subject ${subjectID}`);
  const { body, code } = await get(`v0/subjects/${subjectID}`);
  if (code === 404) {
    await cache.set(cacheKey, null, 60 * 60 * 24);
    return null;
  }
  const s = JSON.parse(body) as Subject;
  total_episode = s.total_episodes;
  data = {
    id: s.id,
    name: s.name_cn || s.name,
    future_episodes: [],
  };

  if (total_episode) {
    const all_episodes = await fetchAllEpisode(subjectID);

    const today = unix() - 24 * 60 * 60 * 3;

    const future_episodes = all_episodes.filter((episode) => {
      const ts = dayjs(new Date(episode.air_date[0], episode.air_date[1] - 1, episode.air_date[2]));
      return ts.unix() > today;
    });

    if (all_episodes.length !== 0 && future_episodes.length === 0 && all_episodes.length <= 200) {
      // no future episodes, just cache it longer than normal episode
      await cache.set(cacheKey, data, 60 * 60 * 24 * 7);
      return data;
    }

    data.future_episodes.push(...future_episodes);
  }

  await cache.set(cacheKey, data, 60 * 60 * 24 * 3);

  return data;
}

interface ParsedEpisode {
  id: number;
  sort: number;
  name: string;
  air_date: readonly [number, number, number];
  duration: string;
}

async function fetchAllEpisode(subjectID: number): Promise<Array<ParsedEpisode>> {
  const res = await _fetchAllEpisode(subjectID);

  return res
    .map((episode): ParsedEpisode | null => {
      const date: number[] = episode.airdate
        .split("-")
        .map((x) => parseInt(x, 10))
        .filter((x) => !isNaN(x))
        .filter((x) => x !== null);
      if (date.length != 3) {
        return null;
      }

      const [year, month, day] = date;

      if (year === undefined || month === undefined || day === undefined) {
        return null;
      }

      return {
        id: episode.id,
        sort: episode.sort,
        name: episode.name_cn || episode.name,
        air_date: [year, month, day],
        duration: episode.duration,
      };
    })
    .filter(notNull);
}

async function _fetchAllEpisode(subjectID: number, pageSize: number = 200): Promise<Array<Episode>> {
  const data: Array<Episode> = [];
  let offset: number = 0;
  let res: Paged<Episode>;

  do {
    const { code, body } = await get("v0/episodes", {
      query: {
        subject_id: subjectID,
        offset,
        limit: pageSize,
      },
    });

    if (code !== 200) {
      throw new Error(`unexpected error ${code} ${JSON.stringify(body)}`);
    }

    res = JSON.parse(body) as Paged<Episode>;

    data.push(...res.data);

    offset += pageSize;
  } while (offset < res.total);

  return data;
}

const SubjectTypeAnime = 2;
const SubjectTypeEpisode = 6;

function renderICS(subjects: SlimSubject[]): string {
  const calendar = new ICalendar({
    name: "Bangumi Episode Air Calendar",
    "X-PUBLISHED-TTL": "P1D",
  });
  const today = unix();

  for (const subject of subjects) {
    for (const episode of subject.future_episodes) {
      const date = episode.air_date;
      const ts = dayjs(new Date(date[0], date[1] - 1, date[2]));

      // only show episode in 30 days.
      if (ts.unix() > today + 30 * 24 * 60 * 60) {
        continue;
      }

      const end = new Date(date[0], date[1] - 1, date[2]);
      end.setDate(end.getDate() + 1);

      calendar.createEvent({
        subjectID: subject.id,
        episodeID: episode.id,
        start: formatDate(date),
        end: formatDate([end.getFullYear(), end.getMonth() + 1, end.getDate()]),
        summary: `${subject.name} ${episode.sort}`,
        description: episode.name || undefined,
        duration: episode.duration,
      });
    }
  }

  return calendar.toString();
}

interface Event {
  subjectID: number;
  episodeID: number;
  start: string;
  end: string;
  summary: string;
  description?: string;
  duration: string;
}

class ICalendar {
  private readonly name: string;
  private readonly now: Date;
  private readonly lines: string[];

  constructor({ name, ...meta }: { name: string; [keys: string]: string }) {
    this.name = name;
    this.now = new Date();
    this.lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//trim21//bangumi-icalendar//CN",
      `NAME:${this.name}`,
      `X-WR-CALNAME:${this.name}`,
    ];

    this.lines.push(...Object.entries(meta).map(([key, value]) => `${key}:${value}`));
  }

  createEvent(event: Event): void {
    this.lines.push(
      "BEGIN:VEVENT",
      `UID:${generateUID(`subject-${event.subjectID}-episode-${event.episodeID}`)}`,
      `DTSTAMP:${formatDateObject(this.now)}`,
      `DTSTART;VALUE=DATE:${event.start}`,
      `DTEND;VALUE=DATE:${event.end}`,
      `SUMMARY:${event.summary}`,
    );

    let description: string[] = [];

    if (event.description) {
      description.push(event.description);
    }

    if (event.duration) {
      description.push("时长：" + event.duration);
    }

    if (description.length) {
      this.lines.push(`DESCRIPTION:${description.join("\\n\\n")}`);
    }

    this.lines.push("END:VEVENT");
  }

  toString(): string {
    return this.lines.join("\n") + "\nEND:VCALENDAR";
  }
}

function formatDateObject(d: Date): string {
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    "T",
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    "Z",
  ].join("");
}

function formatDate(d: readonly [number, number, number]): string {
  return d[0].toString().padStart(4) + pad(d[1]) + pad(d[2]);
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function generateUID(summary: string): string {
  return uuidByString(summary);
}
