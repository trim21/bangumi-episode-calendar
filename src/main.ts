import { nanoid } from "nanoid";

import { production } from "./config";
import { logger } from "./logger";
import { createServer } from "./server";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}

const server = await createServer({
  logger: logger.child({ name: "fastify" }, { level: production ? "warn" : "info" }),
  disableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== "true",
  genReqId: (): string => {
    return `dummy-ray-${nanoid()}`;
  },
});

const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 3000;
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ port, host });
