import { beforeAll, describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawCampfire, drawCampfireEffects, drawCooking } from './campfireVisuals'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import type { World } from '../simulation/world'
import { supplyWood } from '../simulation/supplyCrate'
import { advanceWorld } from '../simulation/step'
import { inspectionSummary } from './inspectionSummary'
import { PLAYER_TOOLS } from '../state/toolMetadata'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 100
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east'); supplyWood(template, 824, 21)
  for (let t = 0; t < 500000 && template.peace.activity !== 'cooking'; t += 50) advanceWorld(template, 50)
  expect(template.peace.activity).toBe('cooking')
})
describe('cozy campfire and cooking visuals', () => {
  it('builds stones then crossed logs and offers inspection without a player construction tool', () => {
    const { g, calls } = graphics(), fire = { kind: 'peteCampfire' as const, x: 20, y: 23 }
    drawCampfire(g, fire, 32, .2); expect(calls.some(c => c[0] === 'lineBetween')).toBe(false)
    calls.length = 0; drawCampfire(g, fire, 32, .5); const midway = calls.length
    calls.length = 0; drawCampfire(g, fire, 32); expect(calls.length).toBeGreaterThan(midway)
    expect(PLAYER_TOOLS.some(t => t.tool === ('peteCampfire' as string))).toBe(false)
    expect(inspectionSummary({ kind: 'peteCampfire', cooking: true }).state).toContain('frying')
    expect(inspectionSummary({ kind: 'peteCoop', collected: 3, eaten: 1, eggs: 0, adults: 3, chicks: 2 }).state).toContain('2 available · 1 eaten')
  })
  it('animates the idle fire from simulation time, culls offscreen and never mutates gameplay', () => {
    const w = structuredClone(template), before = structuredClone(w), { g, calls } = graphics()
    drawCampfireEffects(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
    drawCampfireEffects(g, w, 32); const initial = [...calls]
    expect(calls.some(c => c[0] === 'fillTriangle')).toBe(true)
    calls.length = 0; drawCampfireEffects(g, w, 32); expect(calls).toEqual(initial); expect(w).toEqual(before)
    calls.length = 0; drawCampfireEffects(g, { ...w, timeMs: w.timeMs + 400 }, 32); expect(calls).not.toEqual(initial)
  })
  it('shows a fried egg in the pan, then eating and a happy heart, using copied seated poses', () => {
    const w = structuredClone(template), before = structuredClone(w), { g, calls } = graphics()
    drawCooking(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
    drawCooking(g, w, 32); expect(calls).toContainEqual(['fillStyle', [0xecc15d]])
    calls.length = 0; drawCooking(g, { ...w, timeMs: w.timeMs + 6000 }, 32)
    expect(calls).not.toContainEqual(['fillStyle', [0xecc15d]]); expect(calls).toContainEqual(['fillStyle', [0xffe6a5]])
    calls.length = 0; drawCooking(g, { ...w, peace: { ...w.peace, activity: 'campfireHappy' } }, 32)
    expect(calls).toContainEqual(['fillStyle', [0xe6a6a4]]); expect(w).toEqual(before)
  })
})
