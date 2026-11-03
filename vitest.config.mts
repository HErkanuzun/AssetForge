import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { electron: resolve(import.meta.dirname, 'tests/stubs/electron.ts') }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/main/**', 'src/shared/**'] }
  }
})
