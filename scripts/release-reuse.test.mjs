import { test } from 'node:test'
import assert from 'node:assert/strict'
import testedRun from './release-reuse.cjs'
import needsLong from './check-scope.cjs'
import { BaseSequencer } from 'vitest/node'
import { testSuites } from '../testSuites.ts'
import { testTier } from '../testTiers.ts'
const repo = { owner: 'owner', repo: 'game' }
const valid = { id: 12, head_sha: 'head', event: 'pull_request', conclusion: 'success', head_repository: { full_name: 'owner/game' } }
function api(run = valid, tree = 'tree', artifact = { name: 'tested-game-tree', expired: false }) {
  return { rest: {
    actions: {
      listWorkflowRuns: async options => { assert.equal(options.workflow_id, 'pages.yml'); return { data: { workflow_runs: [run] } } },
      listWorkflowRunArtifacts: async () => ({ data: { artifacts: artifact ? [artifact] : [] } }),
    },
    git: { getCommit: async () => ({ data: { tree: { sha: tree } } }) },
  } }
}
test('reuses a successful PR artifact with identical complete source tree', async () => assert.equal(await testedRun(api(), repo, 'tree'), '12'))
test('changed source requires fresh checks', async () => assert.equal(await testedRun(api(valid, 'different'), repo, 'tree'), ''))
for (const [name, run] of [
  ['failed', { ...valid, conclusion: 'failure' }],
  ['fork', { ...valid, head_repository: { full_name: 'fork/game' } }],
  ['push', { ...valid, event: 'push' }],
]) test(`rejects ${name} evidence`, async () => assert.equal(await testedRun(api(run), repo, 'tree'), ''))
for (const [name, artifact] of [
  ['expired', { name: 'tested-game-tree', expired: true }], ['wrong artifact', { name: 'tested-game-other' }], ['missing', null],
]) test(`rejects ${name} build`, async () => assert.equal(await testedRun(api(valid, 'tree', artifact), repo, 'tree'), ''))
test('small known presentation changes need quick checks without all long simulations', () => {
  assert.equal(needsLong(['src/index.css', 'src/game/PeteInspection.tsx']), false)
  assert.equal(needsLong(['README.md', 'docs/DEVELOPMENT.md']), false)
})
for (const file of ['src/simulation/peace.ts', 'src/persistence/saveGame.ts', 'src/core/GameScene.ts', 'src/state/gameStore.ts', 'testSuites.ts', 'testTiers.ts', 'scripts/check-scope.cjs', '.github/workflows/pages.yml', 'unknown.ts']) {
  test(`${file} requires all long coverage`, () => assert.equal(needsLong(['src/index.css', file]), true))
}
test('unknown or empty scope fails closed', () => assert.equal(needsLong([]), true))
test('three native Vitest shards cover every long file once', async () => {
  const files = Object.values(testSuites).flat().filter(file => testTier(file) === 'long').map(moduleId => ({ moduleId }))
  const shards = await Promise.all([1, 2, 3].map(index => new BaseSequencer({ config: { root: process.cwd(), shard: { index, count: 3 } } }).shard(files)))
  const selected = shards.flat().map(spec => spec.moduleId)
  assert.deepEqual([...selected].sort(), files.map(spec => spec.moduleId).sort())
  assert.equal(new Set(selected).size, files.length)
  assert.ok(shards.every(shard => shard.length > 0))
})
