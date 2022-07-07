import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class Config {
  public readonly REDIS_HOST: string;
  public readonly REDIS_PORT: number;
  public readonly REDIS_DB: number;
  public readonly REDIS_PASSWORD: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.REDIS_HOST = configService.get<string>("REDIS_HOST") ?? "127.0.0.1";
    this.REDIS_PORT = configService.get<number>("REDIS_PORT") ?? 6379;
    this.REDIS_DB = configService.get<number>("REDIS_DB") ?? 0;
    this.REDIS_PASSWORD = configService.get<string>("REDIS_PASSWORD") ?? "";
  }
}
