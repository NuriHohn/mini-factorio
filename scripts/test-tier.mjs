import { spawnSync } from 'node:child_process'

const tier = process.argv[2]
if (!['quick', 'long'].includes(tier)) throw new Error('Expected quick or long')
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(3)], {
  stdio: 'inherit', env: { ...process.env, TEST_TIER: tier },
})
process.exit(result.status ?? 1)
