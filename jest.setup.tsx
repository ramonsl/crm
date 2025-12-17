/**
 * Jest Setup for Frontend Tests
 * 
 * Sets up React Testing Library matchers and global mocks for component tests.
 */

import '@testing-library/jest-dom';

// Suppress console output during tests (matches backend setup)
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
};

beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
});

// Mock next/navigation (commonly used in Next.js components)
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));
