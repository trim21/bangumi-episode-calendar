import type { default as Redis } from "ioredis";

export class Cache {
  constructor(private readonly redis: Redis) {}

  async set(key: string, value: unknown, ttlSeconds: number) {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) {
      return undefined;
    }

    return JSON.parse(raw) as T;
  }
}
