import { defineConfig } from "@playwright/test";
import mainConfig from "./playwright.config";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/pages.spec.ts",
  workers: 1,
  reporter: "list",
  projects: mainConfig.projects,
  use: {
    ...mainConfig.use,
    baseURL: "http://127.0.0.1:4174/TEST_JP/",
  },
  webServer: {
    command: "BUILD_BASE_PATH=/TEST_JP/ npm run preview -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/TEST_JP/",
    reuseExistingServer: false,
  },
});
