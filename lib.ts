import pLimit from 'p-limit'
import { Collection, Episode, Paged, Subject } from './bangumi'
import * as pkg from './package.json'

const SubjectTypeAnime = 2
const SubjectTypeEpisode = 6

const defaultHeaders = { 'user-agent': `trim21/bangumi-episode-ics/cf-workers/${pkg.version}` }

async function fetchAllUserCollection (username: string, pageSize: number = 50): Promise<Array<Collection>> {
  const data: Array<Collection> = []
  let offset: number = 0
  let res: Paged<Collection>

  do {
    const r = await fetch(`https://api.bgm.tv/v0/users/${username}/collections` + '?' + qs({
      type: '3', offset: offset.toString(), limit: pageSize.toString(),
    }),
      {
        headers: defaultHeaders
      }
    )
    res = await r.json()

    data.push(...res.data)

    offset += pageSize
  } while (offset < res.total)

  return data
}

async function fetchAllEpisode (
  subjectID: number,
  pageSize: number = 200
): Promise<Array<Episode>> {
  const data: Array<Episode> = []
  let offset: number = 0
  let res: Paged<Episode>

  do {
    const r = await fetch(`https://api.bgm.tv/v0/episodes?` + qs({
      subject_id: subjectID,
      offset,
      limit: pageSize,
    }), {
      headers: defaultHeaders
    })
    res = await r.json()

    data.push(...res.data)

    offset += pageSize
  } while (offset < res.total)

  return data
}

export async function buildICS (username: string): Promise<string> {
  console.log('fetching episodes')
  const collections = (await fetchAllUserCollection(username)).filter(
    (value) =>
      value.subject_type == SubjectTypeAnime ||
      value.subject_id == SubjectTypeEpisode
  )

  const limit = pLimit(10)

  const subjects: Subject[] = await Promise.all(
    collections.map((s) =>
      limit(async (): Promise<Subject> => {
        const r = await fetch(
          `https://api.bgm.tv/v0/subjects/${s.subject_id}`, { headers: defaultHeaders }
        )
        return await r.json()
      })
    )
  )

  const result: Episode[][] = await Promise.all(
    collections.map((s) => limit(() => fetchAllEpisode(s.subject_id)))
  )

  const episodes = result.reduce((previousValue, currentValue) => {
    previousValue.push(...currentValue)
    return previousValue
  })

  return renderICS(
    episodes,
    subjects.reduce((previousValue, currentValue) => {
      previousValue[currentValue.id] = currentValue

      return previousValue
    }, {} as Record<number, Subject>)
  )
}

function renderICS (
  episodes: Episode[],
  subjects: Record<number, Subject>
): string {
  const today = new Date()

  // let events: Array<EventAttributes> = []
  const calendar = new ICalendar({ name: 'Bangumi Episode Air Calendar' })

  for (const episode of episodes) {
    const date: number[] = episode.airdate
      .split('-')
      .map((x) => parseInt(x, 10))
    if (!date.length) {
      continue
    }
    if (date.length != 3) {
      continue
    }

    const ts = new Date(date[0], date[1] - 1, date[2])
    if (ts.getTime() < today.getTime() - 24 * 60 * 60 * 1000) {
      continue
    }

    if (ts.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) {
      continue
    }

    calendar.createEvent({
      start: [date[0], date[1], date[2]],
      end: [date[0], date[1], date[2]],
      summary: `${subjects[episode.subject_id].name_cn} ${episode.sort}`,
    })
  }

  return calendar.toString()
}

function qs (params: Record<string, any>): string {
  return (new URLSearchParams(Object.entries(params).map(([key, value]) => [key, value.toString()])).toString())
}

interface Event {
  start: [number, number, number],
  end: [number, number, number],
  summary: string
}

class ICalendar {
  private name: string
  private readonly data: Event[]

  constructor (config: { name: string }) {
    this.name = config.name
    this.data = []
  }

  createEvent (data: Event): void {
    this.data.push(data)
  }

  toString (): string {
    const now = new Date()
    const lines = []
    lines.push(
      `BEGIN:VCALENDAR`,
      'VERSION:2.0',
      'PRODID:-//trim21//bangumi-icalendar//CN',
      'NAME:Bangumi Episode Air Calendar',
      `X-WR-CALNAME:${this.name}`,
    )

    for (const event of this.data) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${generateUID()}`,
        `DTSTAMP:${formatDateObject(now)}`,
        `DTSTART:${formatDate(event.start)}T160000Z`,
        `DTEND:${formatDate(event.end)}T160000Z`,
        `SUMMARY:${event.summary}`,
        `END:VEVENT`,
      )
    }

    lines.push('END:VCALENDAR')

    return lines.join('\n')
  }
}

function formatDateObject (d: Date): string {
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    'T',
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    'Z'
  ].join('')
}

function formatDate (d: [number, number, number]): string {
  return d[0].toString().padStart(4) + pad(d[1] + 1) + pad(d[2])
}

function pad (n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function generateUID (): string {
  return crypto.randomUUID()
}
