import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        '.venv/bin/python -m backend.seed_demo && .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8011',
      cwd: root,
      url: 'http://127.0.0.1:8011/api/v1/health',
      reuseExistingServer: false,
      env: {
        DATABASE_URL: 'sqlite:///./data/e2e.db',
        AI_PROVIDER: 'disabled',
        LOCAL_ORIGINS: 'http://127.0.0.1:5174',
      },
      timeout: 30000,
    },
    {
      command: `"${process.execPath}" "${process.env.npm_execpath}" run dev -- --port 5174`,
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: { OPD_API_TARGET: 'http://127.0.0.1:8011' },
      timeout: 30000,
    },
  ],
})
