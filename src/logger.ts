import * as winston from "winston";

export const logger = winston.createLogger({
  level: "info",
});

if (process.env.NODE_ENV === "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize({
          colors: {
            info: "blue",
            warn: "yellow",
            error: "red",
          },
        }),
        winston.format.simple(),
      ),
    }),
  );
}
