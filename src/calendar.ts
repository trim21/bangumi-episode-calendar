import pLimit from "p-limit";
import { NotFoundException } from "@nestjs/common";

import type { Collection, Episode, Paged, Subject } from "./bangumi";
import type { Cache } from "./cache";
import { get } from "./request";
import { uuidByString } from "./util";

export async function buildICS(username: string, cache: Cache): Promise<string> {
  console.log("fetching episodes for user", username);
  let collections: Array<Collection> = await fetchAllUserCollection(username);

  const limit = pLimit(10);

  const subjects: SlimSubject[] = (
    await Promise.all(collections.map((s) => limit(() => getSubjectInfo(s.subject_id, cache))))
  )
    .filter((x) => x !== null)
    .filter((s) => s.future_episodes.length !== 0);

  return renderICS(subjects);
}

async function fetchAllUserCollection(username: string, pageSize: number = 50): Promise<Array<Collection>> {
  const data: Array<Collection> = [];

  for (const collectionType of [1, 3]) {
    let offset: number = 0;
    let res: Paged<Collection>;
    do {
      const { body, statusCode } = await get(`/v0/users/${username}/collections`, {
        query: {
          type: collectionType,
          offset,
          limit: pageSize,
        },
      });

      if (statusCode === 404) {
        throw new NotFoundException("user not found");
      }

      res = await body.json();

      data.push(
        ...res.data.filter((c) => c.subject_type === SubjectTypeAnime || c.subject_type === SubjectTypeEpisode),
      );

      offset += pageSize;
    } while (offset < res.total);
  }

  return data;
}

interface SlimSubject {
  name: string;
  id: number;
  future_episodes: Array<ParsedEpisode>;
}

async function getSubjectInfo(subjectID: number, cache: Cache): Promise<SlimSubject | null> {
  const cacheKey = `subject-v2-${subjectID}`;

  const cached = await cache.get<SlimSubject>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let data: SlimSubject;
  let total_episode = 0;

  const { body, statusCode } = await get(`/v0/subjects/${subjectID}`);
  if (statusCode === 404) {
    await cache.set(cacheKey, null, 60 * 60 * 24);
    return null;
  }
  const s = (await body.json()) as Subject;
  total_episode = s.total_episodes;
  data = {
    id: s.id,
    name: s.name_cn || s.name,
    future_episodes: [],
  };

  if (total_episode) {
    const all_episodes = await fetchAllEpisode(subjectID);

    const future_episodes = all_episodes.filter((episode) => {
      const today = new Date();
      const ts = new Date(episode.air_date[0], episode.air_date[1] - 1, episode.air_date[2]);
      return ts.getTime() > today.getTime();
    });

    if (all_episodes.length !== 0 && future_episodes.length === 0 && all_episodes.length <= 200) {
      // no future episodes, just cache it longer than normal episode
      await cache.set(cacheKey, data, 60 * 60 * 24 * 30);
      return data;
    }

    data.future_episodes.push(...future_episodes);
  }

  await cache.set(cacheKey, data, 60 * 60 * 24 * 7);

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
    .map((episode) => {
      const date: number[] = episode.airdate
        .split("-")
        .map((x) => parseInt(x, 10))
        .filter((x) => !isNaN(x))
        .filter((x) => x !== null);
      if (date.length != 3) {
        return null;
      }

      if (date[0] === null || date[1] === null || date[2] === null) {
        return null;
      }

      return {
        id: episode.id,
        sort: episode.sort,
        name: episode.name_cn || episode.name,
        air_date: [date[0], date[1], date[2]] as const,
        duration: episode.duration,
      };
    })
    .filter((x) => x !== null);
}

async function _fetchAllEpisode(subjectID: number, pageSize: number = 200): Promise<Array<Episode>> {
  const data: Array<Episode> = [];
  let offset: number = 0;
  let res: Paged<Episode>;

  do {
    const { statusCode, body } = await get("/v0/episodes", {
      query: {
        subject_id: subjectID,
        offset,
        limit: pageSize,
      },
    });

    if (statusCode !== 200) {
      throw new Error(`unexpected error ${statusCode} ${await body.text()}`);
    }

    res = await body.json();

    data.push(...res.data);

    offset += pageSize;
  } while (offset < res.total);

  return data;
}

const SubjectTypeAnime = 2;
const SubjectTypeEpisode = 6;

function renderICS(subjects: SlimSubject[]): string {
  const calendar = new ICalendar({ name: "Bangumi Episode Air Calendar" });
  const today = new Date();

  for (const subject of subjects) {
    for (const episode of subject.future_episodes) {
      const date = episode.air_date;
      const ts = new Date(date[0], date[1] - 1, date[2]);

      // only show episode in 30 days.
      if (ts.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) {
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

  constructor(config: { name: string }) {
    this.name = config.name;
    this.now = new Date();
    this.lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//trim21//bangumi-icalendar//CN",
      `NAME:${this.name}`,
      `X-WR-CALNAME:${this.name}`,
    ];
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

    if (event.description) {
      this.lines.push(`DESCRIPTION:${event.description}${event.duration === "" ? "" : "\\n时长：" + event.duration}`);
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
