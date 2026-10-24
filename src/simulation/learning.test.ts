import { describe, expect, it } from 'vitest'
import { createBareWorld, poweredWorld } from './testFixtures'
import { placeBuilding } from './world'
import type { Furnace } from './world'
import { changeFurnaceRecipe } from './smelting'
import { learningGoals, machineGuide, peteRoute, processGuides } from './learning'
import { createDevelopmentLife } from './peteDevelopments'
import { advanceWorld } from './step'
import { allocatePower } from './power'
import { decodeSave, encodeSave } from '../persistence/saveGame'
describe('learning from actual world state', () => {
  it('derives saved goal completion from actual production and once-only project history', () => {
    const w = createBareWorld(() => .5); w.mined.iron = 5; w.produced.ironPlate = 4
    const before = structuredClone(w), goals = learningGoals(w)
    expect(goals[0].complete).toBe(true); expect(goals[1].value).toBe(4); expect(goals[1].complete).toBe(false); expect(w).toEqual(before)
    const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
    expect(learningGoals(decodeSave(encodeSave(w, view)).world)).toEqual(goals)
    w.personality.rewardedProjects.push('workshop'); expect(learningGoals(w).at(-1)?.complete).toBe(true)
  })
  it('explains electricity, exact missing ingredients, processing and output pressure', () => {
    const w = poweredWorld(() => .5); placeBuilding(w, 20, 20, 'furnace', 'east'); changeFurnaceRecipe(w, 20, 20, 'ironSmelting')
    const b = w.buildings[820] as Furnace
    allocatePower(w)
    expect(machineGuide(w, 820)?.reason).toContain('Missing: 1 Iron ore'); expect(machineGuide(w, 820)?.tiles).not.toContain(821)
    b.input.iron = 1; advanceWorld(w, 50); expect(machineGuide(w, 820)?.reason).toContain('processed')
    b.job = null; b.output.ironPlate = 2; expect(machineGuide(w, 820)?.reason).toContain('output'); expect(machineGuide(w, 820)?.tiles).toEqual([820, 821])
    w.buildings[781] = null; w.topologyRevision++; w.power = null; expect(machineGuide(w, 820)?.reason).toContain('connection')
  })
  it('keeps input/output hints in bounds on the map edge and handles missing selections', () => {
    const w = createBareWorld(() => .5); placeBuilding(w, 0, 0, 'belt', 'west')
    expect(machineGuide(w, 0)?.tiles).toEqual([0]); expect(machineGuide(w, -1)).toBeNull()
  })
  it('shows committed process stages without changing materials, XP or task selection', () => {
    const w = createBareWorld(() => .5); w.developmentLife = createDevelopmentLife(); w.developmentLife.task = 'nursing'
    w.buildings[410] = { kind: 'peteDevelopment', development: 'nursery', x: 10, y: 10, gears: 0, modules: 0, fruit: 0, readyAtMs: 0 }
    const before = structuredClone(w), guides = processGuides(w, 410)
    expect(guides[0].steps[0]).toContain('2 supplied Wood'); expect(guides[0].active).toBe(1); expect(w).toEqual(before)
    w.developmentLife.task = 'mechanics'; expect(processGuides(w, 410)[0].active).toBeNull()
  })
  it('highlights only an actual current walking route, never a stale or airborne route', () => {
    const w = createBareWorld(() => .5); w.peace.home = 820; Object.assign(w.pete, { tile: 780, next: 781, path: [782], pathRevision: w.topologyRevision })
    expect(peteRoute(w)).toEqual([780, 781, 782]); w.topologyRevision++; expect(peteRoute(w)).toEqual([])
    w.pete.pathRevision = w.topologyRevision; w.peace.activity = 'flying'; expect(peteRoute(w)).toEqual([])
  })
})
