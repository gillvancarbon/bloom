import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The suite covers the pure domain logic (schedules, insights, streaks),
    // so a DOM environment isn't needed.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**'],
    },
  },
})
