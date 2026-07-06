import { defineConfig } from '@playwright/test';

// Allow overriding where the dev server lives:
// `PW_BASE_URL=http://localhost:5199 npx playwright test`.
// Default 5183 (vite.config server.port) — NOT 5173, which another local
// project may occupy (reuseExistingServer would then test the wrong app).
const baseURL = process.env.PW_BASE_URL ?? 'http://localhost:5183';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce', // stable visual snapshots (also gates our fog/ember/flicker CSS)
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
    },
  ],
});
