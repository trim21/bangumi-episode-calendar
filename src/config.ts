import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class Config {
  public readonly REDIS_HOST: string;
  public readonly REDIS_PORT: number;
  public readonly REDIS_DB: number;
  public readonly REDIS_PASSWORD: string;

  constructor(configService: ConfigService<Record<string, string>, true>) {
    this.REDIS_HOST = configService.get("REDIS_HOST", "127.0.0.1");
    this.REDIS_PORT = parseInt(configService.get("REDIS_PORT", "6379"));
    this.REDIS_DB = parseInt(configService.get("REDIS_DB", "2"));
    this.REDIS_PASSWORD = configService.get("REDIS_PASSWORD", "");
  }
}
