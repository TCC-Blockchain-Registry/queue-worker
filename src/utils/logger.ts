import { config } from '../config';

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const LOG_LEVELS: Record<string, LogLevel> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
};

const currentLogLevel = LOG_LEVELS[config.logging.level] || LogLevel.INFO;

class Logger {
  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  error(message: string, ...args: any[]): void {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (currentLogLevel >= LogLevel.INFO) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }

  job(jobId: string, type: string, status: string, message?: string): void {
    const msg = message ? ` - ${message}` : '';
    this.info(`[Job ${jobId}] [${type}] ${status}${msg}`);
  }
}

export const logger = new Logger();
