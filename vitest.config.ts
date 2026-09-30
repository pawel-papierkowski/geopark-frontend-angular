import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

/**
 * Timezone the whole test suite runs in. Warsaw matches the timezone referenced in the
 * TimeUtils JSDoc examples and gives time-sensitive tests deterministic UTC+1/UTC+2 offsets.
 */
const TEST_TZ = 'Europe/Warsaw';

// Pin the timezone for the real `process.env`, because two things make `test.env` alone
// insufficient: test files run in worker threads, which resolve their timezone from the
// process environment when they are created and ignore later `process.env.TZ` mutations;
// and vitest only applies `test.env` on top of the ambient environment when no TZ is set
// already. This module is evaluated in the main vitest process before any worker starts,
// so the assignment always reaches them.
process.env['TZ'] = TEST_TZ;

export default defineConfig({
  plugins: [
    angular({
      tsconfig: './tsconfig.spec.json',
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    // Also declare the pin through the documented channel, so it shows up in `import.meta.env`
    // reads inside tests and in the worker spawn environment.
    env: { TZ: TEST_TZ },
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
