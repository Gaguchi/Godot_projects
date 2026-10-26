import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PW_BASE_URL ?? 'http://localhost:5184'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001 } },
  use: { baseURL, viewport: { width: 1280, height: 720 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
