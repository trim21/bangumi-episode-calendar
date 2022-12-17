import { pino } from "pino";

import { pkg, production } from "./config";

export const logger = pino({
  level: "info",
  base: production ? { pid: process.pid, version: pkg.version } : undefined,
  timestamp() {
    return `,"time":"${new Date().toISOString()}"`;
  },
  transport: production ? undefined : { target: "pino-pretty", options: { colorize: true } },
  formatters: {
    level(level) {
      return { level };
    },
  },
});
