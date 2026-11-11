const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "e2e",
  timeout: 30 * 1000,
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:1314",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "hugo server --source dev --port 1314 --disableFastRender --baseURL http://127.0.0.1:1314",
    url: "http://127.0.0.1:1314",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
