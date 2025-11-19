import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export interface AppConfig {
  [key: string]: any;
}

export function loadConfig(
  configPath: string = 'config.json',
  requiredKeys: string[] = []
): AppConfig {
  let config: AppConfig = { ...process.env };

  const absoluteConfigPath = path.resolve(process.cwd(), configPath);

  if (fs.existsSync(absoluteConfigPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(absoluteConfigPath, 'utf-8'));
      config = { ...config, ...overrides };
    } catch (error) {
      console.error(`Error reading or parsing config file at ${absoluteConfigPath}:`, error);
      process.exit(1);
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
    console.error(`Missing required configuration keys: ${missingKeys.join(', ')}`);
    process.exit(1);
  }
}
