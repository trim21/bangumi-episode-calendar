import { AxiosError } from "axios";
import pLimit from "p-limit";
import { NotFoundException } from "@nestjs/common";
import getUuid from "uuid-by-string";

import { Collection, Episode, Paged, Subject } from "./bangumi";
import { isNotNull } from "./util";
import { client } from "./request";
import { Cache } from "./cache";

export async function buildICS(username: string, cache: Cache): Promise<string> {
  console.log("fetching episodes for user", username);
  try {
    let collections = await fetchAllUserCollection(username);
    const limit = pLimit(10);

    const subjects: SlimSubject[] = (
      await Promise.all(collections.map((s) => limit(() => getSubjectInfo(s.subject_id, cache))))
    ).filter(isNotNull);

    return renderICS(subjects);
  } catch (e) {
    throw new NotFoundException();
  }
}

async function fetchAllUserCollection(username: string, pageSize: number = 50): Promise<Array<Collection>> {
  const data: Array<Collection> = [];

  for (const collectionType of [1, 3]) {
    let offset: number = 0;
    let res: Paged<Collection>;
    do {
      const req = await client.get<Paged<Collection>>(`users/${username}/collections`, {
        params: {
          type: collectionType,
          offset,
          limit: pageSize,
        },
      });

      res = req.data;

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
  name_cn: string;
  id: number;
  future_episodes: Array<ParsedEpisode>;
}

async function getSubjectInfo(subjectID: number, cache: Cache): Promise<SlimSubject | null> {
  const cacheKey = `subject-v0-${subjectID}`;

  const cached = await cache.get<SlimSubject>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  let data;
  try {
    const req = await client.get<Subject>(`subjects/${subjectID}`);
    data = req.data;
  } catch (e: any) {
    if (e instanceof AxiosError) {
      if (e.response?.status === 404) {
        await cache.set(cacheKey, null, 60 * 60 * 24);
        return null;
      }
    }
    throw e;
  }

  const episodes: Array<ParsedEpisode> = [];
  if (data.total_episodes) {
    episodes.push(...(await fetchAllEpisode(subjectID)));
  }

  const result = {
    id: data.id,
    name_cn: data.name_cn,
    name: data.name,
    future_episodes: episodes,
  };

  await cache.set(cacheKey, result, 60 * 60 * 24 * 7);

  return result;
}

interface ParsedEpisode {
  id: number;
  sort: number;
  name: string;
  air_date: readonly [number, number, number];
}

async function fetchAllEpisode(subjectID: number): Promise<Array<ParsedEpisode>> {
  const res = await _fetchAllEpisode(subjectID);

  const today = new Date();
  return res
    .map((episode) => {
      const date: number[] = episode.airdate
        .split("-")
        .map((x) => parseInt(x, 10))
        .filter((x) => !isNaN(x))
        .filter(isNotNull);
      if (date.length != 3) {
        return null;
      }

      const ts = new Date(date[0], date[1] - 1, date[2]);
      if (ts.getTime() < today.getTime() - 24 * 60 * 60 * 1000) {
        return null;
      }

      if (date[0] === null || date[1] === null || date[2] === null) {
        throw new Error(`failed to parse episode for ${subjectID} ${episode.id}, ${episode.airdate}`);
      }

      return {
        id: episode.id,
        sort: episode.sort,
        name: episode.name_cn || episode.name,
        air_date: [date[0], date[1], date[2]] as const,
      };
    })
    .filter(isNotNull);
}

async function _fetchAllEpisode(subjectID: number, pageSize: number = 200): Promise<Array<Episode>> {
  const data: Array<Episode> = [];
  let offset: number = 0;
  let res: Paged<Episode>;

  do {
    const req = await client.get<Paged<Episode>>("episodes", {
      params: { subject_id: subjectID, offset, limit: pageSize },
    });

    res = req.data;

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

      calendar.createEvent({
        subjectID: subject.id,
        episodeID: episode.id,
        start: formatDate(date),
        end: formatDate([date[0], date[1], date[2] + 1]),
        summary: `${subject.name_cn || subject.name} ${episode.sort}`,
        description: episode.name || undefined,
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
}

class ICalendar {
  private readonly name: string;
  private readonly now: Date;
  private readonly events: Event[];

  constructor(config: { name: string }) {
    this.name = config.name;
    this.now = new Date();
    this.events = [];
  }

  createEvent(event: Event): void {
    this.events.push(event);
  }

  toString(): string {
    this.events.sort((a, b): number => {
      return a.start.localeCompare(b.start);
    });

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//trim21//bangumi-icalendar//CN",
      `NAME:${this.name}`,
      `X-WR-CALNAME:${this.name}`,
    ];

    for (const event of this.events) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${generateUID(`subject-${event.subjectID}-episode-${event.episodeID}`)}`,
        `DTSTAMP:${formatDateObject(this.now)}`,
        `DTSTART;VALUE=DATE:${event.start}`,
        `DTEND;VALUE=DATE:${event.end}`,
        `SUMMARY:${event.summary}`,
      );
      if (event.description) {
        lines.push(`DESCRIPTION:${event.description}`);
      }
    }

    lines.push("END:VEVENT");
    return lines.join("\n") + "\nEND:VCALENDAR";
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
  return getUuid(summary);
}
