import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./controller";
import { Cache } from "./cache";
import { Config } from "./config";

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AppController],
  providers: [Config, Cache],
})
export class AppModule {}
