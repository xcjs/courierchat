import { fileURLToPath } from 'node:url';
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    include: [
      'test/**/*.test.ts',
      'app/**/*.test.ts',
      'server/**/*.test.ts'
    ]
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url))
    }
  }
});
