import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import type { SupplyCrate, World } from './world'
import { createDevelopmentLife, developmentDecision, TASKS } from './peteDevelopments'
import type { DevelopmentKind } from './peteDevelopments'
import { developmentStatus } from './developmentStatus'
function fixture() {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  w.developmentLife = createDevelopmentLife()
  return w
}
function structure(w: World, kind: DevelopmentKind, tile: number) {
  w[`${kind}Project`] = { kind, home: 820, tiles: [tile], spots: [tile - 40], direction: 'east', phase: 'complete', built: 1, elapsedMs: 0, carried: 0, crate: null }
  const b = { kind: 'peteDevelopment' as const, development: kind, x: tile % 40, y: Math.floor(tile / 40), gears: 0, modules: 0, fruit: 0, readyAtMs: 0 }
  w.buildings[tile] = b
  return b
}
describe('development explanations and fair routines', () => {
  it('explains missing gears, full output, access and removed structures without mutating state', () => {
    const w = fixture(), b = structure(w, 'mechanic', 700), before = structuredClone(w)
    expect(developmentStatus(w).developments[0].reason).toContain('2 more iron gears'); expect(w).toEqual(before)
    b.gears = 2; b.modules = 4; expect(developmentStatus(w).developments[0].reason).toContain('Output full')
    b.modules = 0; for (const i of [660, 699, 701, 740]) w.water[i] = true
    expect(developmentStatus(w).developments[0].reason).toContain('cannot reach')
    w.buildings[700] = null; expect(developmentStatus(w).developments[0].reason).toContain('removed')
  })
  it('shows detached carrying, progress and the actual cooldown', () => {
    const w = fixture(); structure(w, 'nursery', 700)
    const s = w.developmentLife!; s.carriedWood = 2; s.task = 'nursing'; s.target = w.pete.tile
    Object.assign(w.peace, { activity: 'developmentWork', sinceMs: 0, untilMs: 6000 }); w.timeMs = 3000
    const status = developmentStatus(w)
    expect(status.carrying).toContain('2 Wood'); expect(status.progress).toBe(50); expect(status.developments[0].reason).toBe('Growing a nursery sapling')
    s.task = null; s.carriedWood = 0; s.saplings = 1; s.nextAt.takeSapling = 8000; s.nextAt.plantSapling = 10000
    expect(developmentStatus(w).developments[0].reason).toContain('7 more seconds')
  })
  it('chooses the oldest eligible deadline and leaves the seeded draw for ties', () => {
    const w = fixture(), b = structure(w, 'mechanic', 700); structure(w, 'winch', 703); b.gears = 2; w.timeMs = 10000
    w.developmentLife!.nextAt.mechanics = 0; w.developmentLife!.nextAt.winching = 5000
    for (const seed of [0, 123, 0xffffffff]) { w.developmentLife!.seed = seed; developmentDecision(w); expect(w.developmentLife!.task).toBe('mechanics') }
    w.developmentLife!.nextAt.mechanics = 20000; developmentDecision(w); expect(w.developmentLife!.task).toBe('winching')
  })
  it('does not start premature overdue work or advance its random seed', () => {
    const w = fixture(); structure(w, 'winch', 700); w.timeMs = 119950
    const before = structuredClone(w.developmentLife)
    expect(developmentDecision(w, true)).toBeNull(); expect(w.developmentLife).toEqual(before)
    w.timeMs = 120000; expect(developmentDecision(w, true)?.activity).toBe('developmentward')
  })
  it('cooks a full pantry while carrying fruit so the delivery can resume', () => {
    const w = fixture(); structure(w, 'orchard', 700)
    w.buildings[703] = { kind: 'peteCampfire', x: 23, y: 17 }
    w.campfireProject = { kind: 'campfire', home: 820, tiles: [703], spots: [663], direction: 'east', phase: 'complete', built: 1, elapsedMs: 0, carried: 0, crate: null }
    w.developmentLife!.fruit = 12; w.developmentLife!.carriedFruit = 2
    developmentDecision(w); expect(w.developmentLife!.task).toBe('cookFruit'); expect(w.developmentLife!.carriedFruit).toBe(2)
  })
  it('uses existing seedlings before collecting more Wood, and refuses blocked planting', () => {
    const w = fixture(); structure(w, 'nursery', 700); (w.buildings[824] as SupplyCrate).wood = 10
    w.developmentLife!.saplings = 1; developmentDecision(w); expect(w.developmentLife!.task).toBe('takeSapling')
    w.developmentLife!.task = null; w.developmentLife!.target = null; w.developmentLife!.saplings = 0
    for (let y = 14; y <= 26; y++) for (let x = 14; x <= 26; x++) if (Math.max(Math.abs(x - 20), Math.abs(y - 20)) >= 4) w.tiles[y * 40 + x] = 'iron'
    expect(developmentDecision(w)).toBeNull(); expect((w.buildings[824] as SupplyCrate).wood).toBe(10)
    for (const t of TASKS) expect(w.developmentLife!.nextAt[t]).toBe(0)
  })
  it('picks the closest reachable funded nursery crate rather than tile order', () => {
    const w = fixture(); structure(w, 'nursery', 700)
    placeBuilding(w, 2, 2, 'supplyCrate', 'east')
    ;(w.buildings[82] as SupplyCrate).wood = 2
    ;(w.buildings[824] as SupplyCrate).wood = 2
    Object.assign(w.pete, { tile: 823, x: 23, y: 20, next: null, travelMs: 0 })
    developmentDecision(w)
    expect(w.developmentLife!.task).toBe('collectNurseryWood'); expect(w.developmentLife!.target).toBe(823)
  })
  it('explains missing cooking access and does not count an unavailable cook task as ready', () => {
    const w = fixture(), b = structure(w, 'orchard', 700); b.fruit = 2
    w.developmentLife!.fruit = 1; w.developmentLife!.nextAt.pickFruit = 30000
    expect(developmentStatus(w).developments[0].reason).toContain('30 more seconds')
    w.developmentLife!.fruit = 12
    expect(developmentStatus(w).developments[0].reason).toContain('need a reachable campfire')
  })
})
