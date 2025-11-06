/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ["**/tests/**/*.test.ts"],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleDirectories: ['node_modules'],
  rootDir: '.',
  transform: {
    '^.+\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@connectors/(.*)$': '<rootDir>/src/connectors/$1',
    '^@strategies/(.*)$': '<rootDir>/src/strategies/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^\.\./src/(.*)\.js$': '<rootDir>/src/$1.ts',
  },
  modulePaths: ['<rootDir>/src'],
};