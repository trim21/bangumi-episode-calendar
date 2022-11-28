import { FastifyAdapter } from "@nestjs/platform-fastify";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "@/module";
import { logger } from "@/logger";

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
  logger: {
    log(message: any, ...optionalParams): any {
      logger.info(message, ...optionalParams);
    },
    error(message: any, ...optionalParams): any {
      logger.error(message, ...optionalParams);
    },
    debug(message: any, ...optionalParams): any {
      logger.debug(message, ...optionalParams);
    },
    warn(message: any, ...optionalParams): any {
      logger.warn(message, ...optionalParams);
    },
    verbose(message: any, ...optionalParams): any {
      logger.verbose(message, ...optionalParams);
    },
  },
});
await app.listen(3000, "0.0.0.0");

logger.info("server started");
