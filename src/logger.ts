import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { pino } from "pino";
import caller from "pino-caller";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const baseLogger = pino({
  level: "info",
  base: { pid: process.pid },
  timestamp() {
    return `,"time":"${new Date().toISOString()}"`;
  },
  formatters: {
    level(level) {
      return { level };
    },
  },
});

const callerLogger = caller(baseLogger, {
  relativeTo: pathToFileURL(path.dirname(__dirname)).toString(),
});

export const logger = {
  info: baseLogger.info.bind(baseLogger) as pino.LogFn,
  warn: callerLogger.warn.bind(callerLogger) as pino.LogFn,
  error: baseLogger.error.bind(baseLogger) as pino.LogFn,
} as const;
