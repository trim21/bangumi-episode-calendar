import { Inject, Injectable } from "@nestjs/common";
import { default as Redis } from "ioredis";

import { Config } from "./config";

@Injectable()
export class Cache {
  private redis: Redis;

  constructor(@Inject(Config) config: Config) {
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

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  }
}
