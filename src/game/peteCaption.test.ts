import { describe, expect, it } from 'vitest'
import { peteCaption } from './peteCaption'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
it('uses quiet symbols for peaceful life and no label for routine walking, custody or sabotage', () => {
  const w = createBareWorld(() => .5)
  expect(peteCaption(w)).toBe('')
  for (const mode of ['WANDERING', 'FLEEING', 'ARRESTED', 'TRANSPORTED', 'IMPRISONED', 'SPRAYED', 'SLIPPING', 'WATER_FLEEING'] as const) { w.pete.mode = mode; expect(peteCaption(w)).toBe('') }
  w.nature.wood = 20; placeBuilding(w, 18, 23, 'treehouse', 'east')
  advanceWorld(w, 5000); expect(peteCaption(w)).toBe('Zzz')
  const before = structuredClone(w); peteCaption(w); expect(w).toEqual(before)
})
describe('arrest sound is retained without arrival/reaction/boarding sentences', () => {
  it.each([1, 2, 3])('keeps stage %i visuals and timing authoritative', stage => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 0, 1, 'prison', 'east')
    const prison = w.buildings[40]!
    if (prison.kind !== 'prison') throw Error('fixture')
    w.revenge.arrests = stage - 1
    w.police.car = { x: 17, y: 23, tile: 937, next: null, travelMs: 0, path: [], pathRevision: -1, target: 937, phase: 'ARRESTING', arrestElapsedMs: 0, arrestStartedAtMs: 0, arrestDurationMs: 3400, arrestFrom: { x: 17, y: 23 }, prison }
    Object.assign(w.pete, { mode: 'ARRESTED', prison })
    expect(peteCaption(w)).toBe('')
    advanceWorld(w, 1500); expect(peteCaption(w)).toBe(stage === 1 ? '' : 'CLICK!')
    advanceWorld(w, 700); expect(peteCaption(w)).toBe(stage === 1 ? '' : stage === 2 ? 'CLICK!' : 'CLICK! ZURR!')
    advanceWorld(w, 1200); expect(peteCaption(w)).toBe('')
    expect(w.revenge.arrests).toBe(stage)
  })
})
