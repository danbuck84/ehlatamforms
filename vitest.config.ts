import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0-test'),
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup-unit.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'emulator',
          include: ['firebase/tests/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
