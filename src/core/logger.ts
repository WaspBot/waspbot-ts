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

  static log(message: string): void {
    const timestamp = new Date().toISOString();
    const level = "[LOG]";
    const coloredLevel = Logger.enableColor ? `${Logger.colors.cyan}${level}${Logger.colors.reset}` : level;
    console.log(`${coloredLevel} ${timestamp}: ${message}`);
  }
  
  static error(message: string): void {
    const timestamp = new Date().toISOString();
    const level = "[ERROR]";
    const coloredLevel = Logger.enableColor ? `${Logger.colors.red}${level}${Logger.colors.reset}` : level;
    console.error(`${coloredLevel} ${timestamp}: ${message}`);
  }
  static warn(message: string): void {
    const timestamp = new Date().toISOString();
    const level = "[WARN]";
    const coloredLevel = Logger.enableColor ? `${Logger.colors.yellow}${level}${Logger.colors.reset}` : level;
    console.warn(`${coloredLevel} ${timestamp}: ${message}`);
  }
  static info(message: string): void {
    const timestamp = new Date().toISOString();
    const level = "[INFO]";
    const coloredLevel = Logger.enableColor ? `${Logger.colors.blue}${level}${Logger.colors.reset}` : level;
    console.info(`${coloredLevel} ${timestamp}: ${message}`);
  }
  static debug(message: string): void {
    const timestamp = new Date().toISOString();
    const level = "[DEBUG]";
    const coloredLevel = Logger.enableColor ? `${Logger.colors.green}${level}${Logger.colors.reset}` : level;
    console.debug(`${coloredLevel} ${timestamp}: ${message}`);
  }
}