import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Individual test timeout — MMS startup needs up to 60s on first download
    testTimeout: 60_000,
    // Run test files sequentially to avoid MMS port conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
