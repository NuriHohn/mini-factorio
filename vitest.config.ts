import { defineConfig } from 'vitest/config'
import { testSuites } from './testSuites.ts'
import { testTier } from './testTiers.ts'

export default defineConfig({
  test: {
    projects: Object.entries(testSuites).map(([name, include]) => ({
      test: { name, include: include.filter(path => !process.env.TEST_TIER || testTier(path) === process.env.TEST_TIER), setupFiles: name === 'factory' || name === 'integration' ? ['./testSetup.ts'] : [] },
    })),
  },
})
