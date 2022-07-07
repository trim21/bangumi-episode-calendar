import { Inject, Injectable } from "@nestjs/common";
import { default as Redis } from "ioredis";

import { Config } from "./config";

@Injectable()
export class Cache {
  private redis: Redis;
  private readonly config: Config;

  constructor(@Inject(Config) config: Config) {
    this.config = config;
    const url = new URL(config.REDIS_URI);
    this.redis = new Redis({
      port: parseInt(url.port, 10),
      host: url.host.split(":")[0],
      username: url.username,
      password: url.password,
      db: parseInt(url.pathname.slice(1), 10),
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
