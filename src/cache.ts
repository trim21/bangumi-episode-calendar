import { Injectable } from "@nestjs/common";
import { default as Redis } from "ioredis";

import { Config } from "./config";

@Injectable()
export class Cache {
  private readonly redis: Redis;

  constructor(config: Config) {
    this.redis = new Redis({
      port: config.REDIS_PORT,
      host: config.REDIS_HOST,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DB,
    });
  }

  async set(key: string, value: any, ttlSeconds: number) {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) {
      return undefined;
    }

    return JSON.parse(raw);
  }
}
