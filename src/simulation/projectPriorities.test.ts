import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import type { SupplyCrate } from './world'
import { advanceWorld } from './step'
import { awardActivity } from './personality'
import { projectCandidates } from './secretProject'
import { planYard, yardSummary } from './yard'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function world() { const w = createBareWorld(() => .5); w.nature.wood = 500; placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east'); return w }
describe('project priority and expanded yard', () => {
  it('favours a costly rewarding garden over repeated planting while retaining every small project chance', () => {
    const w = world(); awardActivity(w.personality, { path: 'eco', xp: 20 }); (w.buildings[824] as SupplyCrate).wood = 120
    const before = structuredClone(w), candidates = projectCandidates(w)
    const garden = candidates.find(c => c.definition.id === 'garden')!, plant = candidates.find(c => c.definition.id === 'reforestation')!
    expect(garden.priorityWeight).toBeGreaterThan(plant.priorityWeight)
    expect(candidates.every(c => c.priorityWeight > 0 && c.priorityWeight <= 12)).toBe(true)
    expect(w).toEqual(before)
  })
  it('encloses expanded coop/campfire layouts and preserves version-specific geometry validation', () => {
    const w = world(); (w.buildings[824] as SupplyCrate).wood = 21
    for (let n = 0; n < 12000 && !(w.coopProject?.phase === 'complete' && w.campfireProject?.phase === 'complete'); n++) advanceWorld(w, 50)
    expect(w.coopProject?.phase).toBe('complete'); expect(w.campfireProject?.phase).toBe('complete')
    for (const [project, tile, spot] of [[w.coopProject!, 574, 575], [w.campfireProject!, 1066, 1065]] as const) {
      const building = w.buildings[project.tiles[0]]!
      w.buildings[project.tiles[0]] = null; w.buildings[tile] = { ...building, x: tile % 40, y: Math.floor(tile / 40) }
      project.tiles = [tile]; project.spots = [spot]
    }
    w.poultry = null; w.yard = planYard(w)
    expect(w.yard).not.toBeNull(); expect(w.yard!.right - w.yard!.left).toBe(14); expect(w.yard!.bottom - w.yard!.top).toBe(14)
    const doc = JSON.parse(encodeSave(w, view))
    expect(decodeSave(JSON.stringify(doc)).world.yard).toEqual(w.yard)
    doc.version = 31; expect(() => decodeSave(JSON.stringify(doc))).toThrow('Invalid save')
    expect(yardSummary(w)).toContain('fence sections')
  })
  it('explains that three starter rails are not yet an enclosed yard', () => { expect(yardSummary(world())).toContain('only three fence sections') })
})
