import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testDir: './tests/demo',
  testMatch: 'playbook.demo.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    ...config.use,
    baseURL: 'http://127.0.0.1:44331',
    headless: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-demo',
      use: { ...config.projects?.[0]?.use, viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    ...config.webServer,
    command: 'npm run build && npx astro preview --host 127.0.0.1 --port 44331',
    url: 'http://127.0.0.1:44331/playbook/',
    reuseExistingServer: false,
  },
});
