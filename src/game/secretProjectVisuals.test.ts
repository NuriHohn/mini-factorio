import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawPeteFence, drawSecretProject } from './secretProjectVisuals'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import { supplyWood } from '../simulation/supplyCrate'
import { advanceWorld } from '../simulation/step'
import type { PeteFence } from '../simulation/world'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('secret project visuals and Wood intent', () => {
  it.each(['east', 'south'] as const)('draws %s fence construction stages with a balanced graphics stack', direction => {
    const { g, calls } = graphics(), fence: PeteFence = { kind: 'peteFence', x: 10, y: 10, direction }
    drawPeteFence(g, fence, 32, .2); const posts = calls.filter(c => c[0] === 'lineBetween').length
    calls.length = 0; drawPeteFence(g, fence, 32, .5); expect(calls.filter(c => c[0] === 'lineBetween').length).toBeGreaterThan(posts)
    calls.length = 0; drawPeteFence(g, fence, 32)
    expect(calls.filter(c => c[0] === 'save')).toHaveLength(0); expect(calls.filter(c => c[0] === 'restore')).toHaveLength(0)
    expect(calls.some(c => c[0] === 'rotateCanvas')).toBe(false)
    const uprights = calls.filter(c => c[0] === 'fillRect')
    expect(uprights).toHaveLength(2)
    expect(uprights.every(([, args]) => args[2] === 4 && args[3] === 20)).toBe(true)
  })
  it('culls offscreen effects, freezes the hammer pose with simulation time and never mutates state', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 100
    placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); supplyWood(w, 824, 6)
    for (let t = 0; t < 100000 && !w.project?.elapsedMs; t += 50) advanceWorld(w, 50)
    expect(w.project?.elapsedMs).toBeGreaterThan(0)
    const before = structuredClone(w), { g, calls } = graphics()
    drawSecretProject(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 }); expect(calls).toEqual([])
    drawSecretProject(g, w, 32); const pose = [...calls]
    expect(pose.length).toBeGreaterThan(0)
    calls.length = 0; drawSecretProject(g, w, 32); expect(calls).toEqual(pose); expect(w).toEqual(before)
  })
  it('draws paid mulch instead of construction, with read-only paused and culled effects', () => {
    const w = createBareWorld(() => .5)
    w.buildings[700] = { kind: 'peteGarden', x: 20, y: 17 }
    w.careProject = { kind: 'care', completedCycles: 0, selected: true, home: 820, direction: 'east', tiles: [700], spots: [740], phase: 'building', crate: null, built: 0, carried: 2, elapsedMs: 500 }
    Object.assign(w.pete, { tile: 740, x: 20, y: 18, next: null })
    w.peace.activity = 'project'
    const before = structuredClone(w), { g, calls } = graphics()
    drawSecretProject(g, w, 32)
    expect(calls.filter(c => c[0] === 'fillCircle')).toHaveLength(4)
    expect(calls.some(c => c[0] === 'rotateCanvas')).toBe(false)
    const pose = [...calls]; calls.length = 0
    drawSecretProject(g, w, 32); expect(calls).toEqual(pose)
    calls.length = 0; drawSecretProject(g, w, 32, { x: 3000, y: 3000, width: 50, height: 50 })
    expect(calls).toEqual([]); expect(w).toEqual(before)
    w.buildings[700] = null; w.peace.activity = 'homeward'
    drawSecretProject(g, w, 32); expect(calls).toEqual([])
  })

})
