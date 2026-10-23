import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawVeranda, drawVerandaRest } from './verandaVisuals'
import { drawTreehouse } from './peaceVisuals'
import { createBareWorld } from '../simulation/testFixtures'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_t, n) => (...a: unknown[]) => { calls.push([String(n), a]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
function fixture() {
  const w = createBareWorld(() => .5), home = { kind: 'treehouse' as const, x: 20, y: 20, placedAtMs: 0 }
  w.buildings[820] = home; w.peace.home = 820
  w.verandaProject = { kind: 'veranda', home: 820, tiles: [820], spots: [780], direction: 'east', phase: 'building', built: 0, elapsedMs: 0, carried: 8, carriedIron: 12, crate: null }
  return { w, home }
}
it('adds staged metal supports, wooden deck and rails to the existing treehouse without changing state', () => {
  const { w, home } = fixture(), { g, calls } = graphics(), counts: number[] = []
  for (const elapsed of [0, 1000, 5000, 9000, 11500]) {
    w.verandaProject!.elapsedMs = elapsed; const before = structuredClone(w)
    calls.length = 0; drawTreehouse(g, w, home, 32); counts.push(calls.length)
    expect(w).toEqual(before)
  }
  for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1])
  w.verandaProject!.phase = 'complete'; w.verandaProject!.elapsedMs = 0
  calls.length = 0; drawVeranda(g, w, home, 32); const complete = [...calls]
  w.personality.dominant = 'eco'; calls.length = 0; drawVeranda(g, w, home, 32)
  expect(calls).toEqual(complete)
  calls.length = 0; drawVeranda(g, w, { ...home, x: 21 }, 32); expect(calls).toEqual([])
})
it('culls the seated veranda pose and keeps the authoritative actor at the dry entrance', () => {
  const { w } = fixture(), { g, calls } = graphics()
  w.verandaProject!.phase = 'complete'; w.peace.activity = 'verandaRest'
  Object.assign(w.pete, { tile: 780, x: 20, y: 19 })
  const before = structuredClone(w)
  drawVerandaRest(g, w, 32, { x: 3000, y: 3000, width: 10, height: 10 }); expect(calls).toEqual([])
  drawVerandaRest(g, w, 32); expect(calls.length).toBeGreaterThan(0)
  const pose = [...calls]; calls.length = 0; drawVerandaRest(g, w, 32)
  expect(calls).toEqual(pose); expect(w).toEqual(before)
})
