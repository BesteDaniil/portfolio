// E2E: Playwright на установленном Chrome (channel: "chrome") — браузеры не скачиваются.
// Запуск: npm run e2e   (живой сайт: BASE_URL=https://bestedaniil.github.io/portfolio/ npm run e2e)
import { defineConfig } from "@playwright/test";

const externalUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: externalUrl || "http://127.0.0.1:8151/",
    channel: "chrome",
    viewport: { width: 1280, height: 860 },
    screenshot: "only-on-failure"
  },
  webServer: externalUrl ? undefined : {
    command: "python -m http.server 8151 --bind 127.0.0.1",
    url: "http://127.0.0.1:8151/",
    reuseExistingServer: true,
    timeout: 20000,
    stdout: "ignore",
    stderr: "ignore"
  }
});
