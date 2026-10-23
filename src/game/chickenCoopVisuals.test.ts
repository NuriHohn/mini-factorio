import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawChickenCoop } from './chickenCoopVisuals'
import { drawSecretProject } from './secretProjectVisuals'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import { supplyWood } from '../simulation/supplyCrate'
import { advanceWorld } from '../simulation/step'
import { inspectionSummary } from './inspectionSummary'
import { PLAYER_TOOLS } from '../state/toolMetadata'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('cozy staged chicken coop visuals', () => {
  it('shows foundations, wooden walls, roof and finished ramp/door without adding a player tool', () => {
    const { g, calls } = graphics(), coop = { kind: 'peteCoop' as const, x: 10, y: 10 }
    drawChickenCoop(g, coop, 32, .1); expect(calls.some(c => c[0] === 'fillRoundedRect')).toBe(false)
    calls.length = 0; drawChickenCoop(g, coop, 32, .4)
    expect(calls.some(c => c[0] === 'fillRoundedRect')).toBe(true); expect(calls.some(c => c[0] === 'fillTriangle')).toBe(false)
    calls.length = 0; drawChickenCoop(g, coop, 32, .8); expect(calls.some(c => c[0] === 'fillTriangle')).toBe(true)
    const roof = calls.length; calls.length = 0; drawChickenCoop(g, coop, 32); expect(calls.length).toBeGreaterThan(roof)
    expect(PLAYER_TOOLS.some(t => t.tool === ('peteCoop' as string))).toBe(false)
    expect(inspectionSummary({ kind: 'peteCoop', inside: 0, bedtime: false, eaten: 0, collected: 0, eggs: 0, adults: 0, chicks: 0 })).toMatchObject({ name: 'Pete’s Chicken Coop', state: '0 eggs collected · 0 waiting.' })
  })
  it('uses the shared hammer pose and saved simulation progress, with culling and no gameplay mutation', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 80
    placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); supplyWood(w, 824, 16)
    for (let t = 0; t < 180000 && (w.coopProject?.elapsedMs ?? 0) < 4000; t += 50) advanceWorld(w, 50)
    expect(w.coopProject?.elapsedMs).toBeGreaterThanOrEqual(4000)
    const before = structuredClone(w), { g, calls } = graphics()
    drawSecretProject(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
    drawSecretProject(g, w, 32); const pose = [...calls]
    expect(calls.some(c => c[0] === 'rotateCanvas')).toBe(true)
    calls.length = 0; drawSecretProject(g, w, 32); expect(calls).toEqual(pose); expect(w).toEqual(before)
  })
})
