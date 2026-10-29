import { defineConfig } from 'vitest/config'
import { testSuites } from './testSuites.ts'

export default defineConfig({
  test: {
    projects: Object.entries(testSuites).map(([name, include]) => ({
      test: { name, include: [...include], setupFiles: name === 'factory' || name === 'integration' ? ['./testSetup.ts'] : [] },
    })),
  },
})
