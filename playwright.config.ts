import { defineConfig, devices } from "@playwright/test";
const externalURL = process.env.PANG_E2E_URL;

// PLAYWRIGHT_CHROMIUM_EXECUTABLE can reuse an existing local browser installation.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 5000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalURL ?? "http://127.0.0.1:5177",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
        },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
        },
      },
    },
    ...(process.env.PANG_WEBKIT === '1' ? [{
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13'],
        launchOptions: {executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE},
      },
    }] : []),
  ],
  webServer: externalURL ? undefined : {
    command: "npm run preview",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: !process.env.CI,
  },
});
