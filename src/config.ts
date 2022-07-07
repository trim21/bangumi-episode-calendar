import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class Config {
  public readonly REDIS_URI: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.REDIS_URI = configService.get<string>("REDIS_URI") ?? "redis://:redis-pass@127.0.0.1:6379/3";
  }
}
