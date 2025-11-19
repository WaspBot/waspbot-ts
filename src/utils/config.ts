import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Logger } from '../core/logger';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

let dotenvInitialized = false;

function initializeDotenv(): void {
  if (!dotenvInitialized) {
    dotenv.config();
    dotenvInitialized = true;
  }
}

export interface AppConfig {
  [key: string]: any;
}

export function loadConfig(
  configPath: string = 'config.json',
  requiredKeys: string[] = []
): AppConfig {
  initializeDotenv(); // Ensure dotenv is loaded

  let config: AppConfig = { ...process.env };

  const absoluteConfigPath = path.resolve(process.cwd(), configPath);

  if (fs.existsSync(absoluteConfigPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(absoluteConfigPath, 'utf-8'));
      // Environment variables should override JSON values
      config = { ...overrides, ...config };
    } catch (error: any) {
      Logger.error(`Error reading or parsing config file at ${absoluteConfigPath}: ${error.message}`);
      throw new ConfigError(`Failed to load config file: ${error.message}`);
    }
  }

  validateConfig(config, requiredKeys);

  return config;
}

function validateConfig(config: AppConfig, requiredKeys: string[]): void {
  const missingKeys: string[] = [];
  for (const key of requiredKeys) {
    if (!(key in config) || config[key] === undefined || config[key] === null || config[key] === '') {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    Logger.error(`Missing required configuration keys: ${missingKeys.join(', ')}`);
    throw new ConfigError(`Missing required configuration keys: ${missingKeys.join(', ')}`);
  }
}
