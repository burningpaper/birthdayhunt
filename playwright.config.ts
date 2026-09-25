import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * End-to-end tests in WebKit (the engine behind iPad Safari) at iPad landscape
 * size. The app runs against a throwaway local data directory.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "ipad-landscape",
      use: { ...devices["iPad Pro 11 landscape"], browserName: "webkit" },
    },
  ],
  webServer: {
    // A production build, not `next dev`: Next 16 allows one dev server per
    // project, and the developer usually has one running already.
    command: `rm -rf .data-e2e && next build && next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATA_DIR: ".data-e2e",
      SETUP_PIN: "2468",
      SESSION_SECRET: "e2e-secret-that-is-at-least-32-characters-long",
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      BLOB_READ_WRITE_TOKEN: "",
    },
  },
});
