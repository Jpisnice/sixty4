import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so tests don't load the Start and Nitro plugins.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
