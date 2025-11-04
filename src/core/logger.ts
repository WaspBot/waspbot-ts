/**
 * @fileoverview Logging utility for WaspBot-TS
 */

// TODO: Implement logging
export class Logger {
  private static enableColor: boolean = true;

  private static readonly colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
  };

  static setEnableColor(enable: boolean): void {
    Logger.enableColor = enable;
  }

  private static enableJsonOutput: boolean = false;

  static setJsonOutput(enable: boolean): void {
    Logger.enableJsonOutput = enable;
  }

  private static _log(level: string, message: string, color: string, outputFn: (...args: any[]) => void): void {
    const timestamp = new Date().toISOString();
    if (Logger.enableJsonOutput) {
      outputFn(JSON.stringify({ timestamp, level, message }));
    } else {
      const coloredLevel = Logger.enableColor ? `${color}[${level}]${Logger.colors.reset}` : `[${level}]`;
      outputFn(`${coloredLevel} ${timestamp}: ${message}`);
    }
  }

  static log(message: string): void {
    Logger._log("LOG", message, Logger.colors.cyan, console.log);
  }

  static error(message: string): void {
    Logger._log("ERROR", message, Logger.colors.red, console.error);
  }

  static warn(message: string): void {
    Logger._log("WARN", message, Logger.colors.yellow, console.warn);
  }

  static info(message: string): void {
    Logger._log("INFO", message, Logger.colors.blue, console.info);
  }

  static debug(message: string): void {
    Logger._log("DEBUG", message, Logger.colors.green, console.debug);
  }
}