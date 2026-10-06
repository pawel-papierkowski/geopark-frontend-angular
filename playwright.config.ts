import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel. */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env['CI'],
  /* Retry once locally to keep a single flake from failing the whole run, twice on CI. */
  retries: process.env['CI'] ? 2 : 1,
  /* Opt out of parallel tests on CI. Use fewer workers locally to avoid dev-server contention. */
  workers: process.env['CI'] ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters. */
  reporter: 'html',
  /* Generous expect timeout: the full suite runs many browsers against one dev server, so a
     cold Angular boot or a translation fetch can take noticeably longer than the 5 s default. */
  expect: {
    timeout: 10_000, // 10 seconds
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. Reminder that /geopark-frontend-angular is applied only to production build. */
    baseURL: 'http://localhost:4200',

    /* Keep traces of failed tests - with local retries the old `on-first-retry` never produced
       any artifact for a one-shot failure. See https://playwright.dev/docs/trace-viewer. */
    trace: 'retain-on-failure',
  },

  /* Configure projects for major browsers. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests. */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000, /* First cold build of `ng start` can take a while on a loaded machine. */
  },
});
