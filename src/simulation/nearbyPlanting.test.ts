import { describe, expect, it } from 'vitest'
import { planPlanting } from './ecoProjects'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import type { SupplyCrate } from './world'
import { awardActivity } from './personality'
import { advanceSecretProject, trySecretProject } from './secretProject'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function world() {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  Object.assign(w.pete, { tile: 860, x: 20, y: 21, next: null, path: [], travelMs: 0 })
  awardActivity(w.personality, { path: 'eco', xp: 20 })
  return w
}
describe('nearby reforestation', () => {
  it('takes a short local walk before a more distant forest edge and leaves home clear', () => {
    const w = world(); w.buildings[420] = { kind: 'tree', x: 20, y: 10, species: 'oak', origin: 'manual', bornAtMs: 0, nextReproductionAtMs: 600000 }
    const before = structuredClone(w), plan = planPlanting(w)!
    expect(plan.tiles).toEqual([980]); expect(plan.spots).toEqual([940])
    expect(w).toEqual(before)
  })
  it('uses actual walking distance around barriers rather than straight-line distance', () => {
    const w = world(); w.tiles.fill('iron'); w.tiles[980] = null; w.tiles[816] = null
    for (const tile of [899, 900, 901]) w.water[tile] = true
    expect(planPlanting(w)?.tiles).toEqual([816])
    w.tiles[816] = 'iron'; w.tiles[980] = 'iron'
    expect(planPlanting(w)).toBeNull()
  })
  it('replans unpaid distant legacy work but retains paid distant work across saves', () => {
    for (const paid of [false, true]) {
      const w = world(); (w.buildings[824] as SupplyCrate).wood = paid ? 0 : 2
      w.plantProject = { kind: 'plant', home: 820, direction: 'east', tiles: [812], spots: [813], phase: paid ? 'building' : 'collecting', crate: null, built: 0, carried: paid ? 2 : 0, elapsedMs: 0, selected: true }
      Object.assign(w.pete, { tile: 813, x: 13, y: 20 })
      Object.assign(w.peace, { activity: 'project', destination: paid ? 813 : null, sinceMs: 0, untilMs: 0 })
      const restored = decodeSave(encodeSave(w, view)).world
      expect(trySecretProject(restored)).toBe(true)
      if (paid) {
        expect(restored.plantProject?.tiles).toEqual([812])
        advanceSecretProject(restored, 5000)
        expect(restored.buildings[812]?.kind).toBe('tree')
        expect(restored.personality.paths.eco.xp).toBe(25)
      } else expect(restored.plantProject?.tiles).not.toEqual([812])
      expect(() => decodeSave(encodeSave(restored, view))).not.toThrow()
    }
  })
})
