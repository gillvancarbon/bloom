import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Domain logic runs in Node; component tests opt into jsdom by extension.
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**', 'src/components/**'],
    },
  },
})
