import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 5'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // A fresh database for every run.
    command: `node -e "for (const f of ['','-wal','-shm']) require('fs').rmSync('data/e2e.db'+f,{force:true})" && node .output/server/index.mjs`,
    env: { PORT: String(PORT), DATABASE_URL: 'file:data/e2e.db' },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
