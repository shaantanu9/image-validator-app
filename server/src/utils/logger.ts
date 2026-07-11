import { createLogger, format, transports, Logger } from 'winston';
import { appConfig } from '../config/app.config';

const { combine, timestamp, printf, colorize, errors, json } = format;

interface LogInfo {
  level: string;
  message: unknown;
  timestamp?: string;
  stack?: string;
  [key: string]: unknown;
}

const devFormat = printf((info: LogInfo) => {
  const { level, message, timestamp, stack, ...metadata } = info;
  let msg = `${timestamp} [${level}]: ${String(message)}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

const logger: Logger = createLogger({
  level: appConfig.logLevel,
  defaultMeta: { service: 'server' },
  transports: [
    new transports.Console({
      format: appConfig.isProduction
        ? combine(timestamp(), json())
        : combine(
            colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            errors({ stack: true }),
            devFormat,
          ),
    }),
  ],
  exitOnError: false,
});

export default logger;
