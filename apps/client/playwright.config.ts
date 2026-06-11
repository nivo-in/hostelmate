import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Auth state files written by auth.setup.ts and consumed by role spec projects.
 * These paths are .gitignored — never commit real session tokens.
 */
const STUDENT_STATE = path.resolve(__dirname, 'e2e/.auth/student.json');
const WARDEN_STATE  = path.resolve(__dirname, 'e2e/.auth/warden.json');
const PARENT_STATE  = path.resolve(__dirname, 'e2e/.auth/parent.json');

export default defineConfig({
  testDir: './e2e',

  /* Parallelise across files; each file runs serially by default */
  fullyParallel: true,

  /* Fail the build on test.only left in source in CI */
  forbidOnly: !!process.env.CI,

  /* Retry twice on CI to reduce flakiness from cold-start timing */
  retries: process.env.CI ? 2 : 0,

  /* Single worker in CI avoids port contention with the dev servers */
  workers: process.env.CI ? 1 : undefined,

  /* HTML report written to playwright-report/ */
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  use: {
    baseURL: 'http://localhost:3000',

    /* Capture trace on the first retry so failures are debuggable */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── Setup project: runs auth.setup.ts before any role spec ────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── Login page: no auth state required ────────────────────────────────
    {
      name: 'login',
      testMatch: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Student flows ─────────────────────────────────────────────────────
    {
      name: 'student',
      testMatch: /student\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STUDENT_STATE,
      },
    },

    // ── Warden flows ──────────────────────────────────────────────────────
    {
      name: 'warden',
      testMatch: /warden\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: WARDEN_STATE,
      },
    },

    // ── Parent flows ──────────────────────────────────────────────────────
    {
      name: 'parent',
      testMatch: /parent\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: PARENT_STATE,
      },
    },
  ],

  /* Auto-start both dev servers before the suite runs */
  webServer: [
    {
      command: 'pnpm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'cd ../server && pnpm run dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
