import type { Config } from 'jest';

/**
 * Jest Configuration
 * 
 * Uses multi-project setup to support both:
 * - Backend tests (node environment)
 * - Frontend tests (jsdom environment for React components)
 */
const config: Config = {
    verbose: true,
    projects: [
        // Backend tests (API, services, lib)
        {
            displayName: 'backend',
            preset: 'ts-jest',
            testEnvironment: 'node',
            moduleNameMapper: {
                '^@/(.*)$': '<rootDir>/src/$1',
            },
            transform: {
                '^.+\\.[tj]sx?$': ['ts-jest', {
                    useESM: true,
                    tsconfig: 'tsconfig.json',
                }],
            },
            testMatch: ['**/__tests__/**/*.test.ts', '!**/__tests__/components/**'],
            setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
            testTimeout: 30000, // 30s timeout for CI environments
            transformIgnorePatterns: [
                'node_modules/(?!(@whiskeysockets|@boom|@hapi|p-queue|p-timeout|yocto-queue|eventemitter3)/)'
            ]
        },
        // Frontend tests (React components)
        {
            displayName: 'frontend',
            preset: 'ts-jest',
            testEnvironment: 'jsdom',
            moduleNameMapper: {
                '^@/(.*)$': '<rootDir>/src/$1',
                // Mock CSS modules
                '\\.module\\.css$': 'identity-obj-proxy',
                '\\.css$': '<rootDir>/__mocks__/styleMock.js',
            },
            transform: {
                '^.+\\.[tj]sx?$': ['ts-jest', {
                    useESM: true,
                    tsconfig: 'tsconfig.json',
                }],
            },
            testMatch: ['**/__tests__/components/**/*.test.tsx'],
            setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx'],
            transformIgnorePatterns: [
                'node_modules/(?!(@whiskeysockets|@boom|@hapi|p-queue|p-timeout|yocto-queue|eventemitter3)/)'
            ]
        },
    ],
};

export default config;
