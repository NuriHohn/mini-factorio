import { beforeAll, describe, expect, it } from 'vitest'
import { createBareWorld, ecoProjectWood } from './testFixtures'
import { placeBuilding, placementError, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { enclosedYard, yardInterior } from './yard'
import { neighboringTiles, peteReachableTiles, tilePath, walkableTile } from './navigation'
import { gardenGate, GATE_HOLD_MS, GATE_OPEN_MS, preparePeteGate } from './gardenGate'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, ready: () => boolean, limit = 900000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 500
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east'); supplyWood(template, 824, 21)
  until(template, () => template.campfireProject?.phase === 'complete')
  supplyWood(template, 824, 100); until(template, () => template.yard?.phase === 'complete')
  // The yard's exact cost is covered separately; keep this fixture unfunded for gate decisions.
  const stock = template.buildings[824] as SupplyCrate; stock.wood = 0
})
const world = () => structuredClone(template)
const crate = (w: World) => w.buildings[824] as SupplyCrate
function gate() { const w = world(); supplyWood(w, 824, 3); until(w, () => w.gateProject?.phase === 'complete'); return w }
function route(w: World, target: number): void {
  const p = w.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE) })
  Object.assign(w.peace, { activity: 'walking', destination: target, sinceMs: w.timeMs, untilMs: w.timeMs })
  p.path = tilePath(peteReachableTiles(w, p.tile), target) ?? []; p.pathRevision = w.topologyRevision
}
function sides(w: World) {
  const y = w.yard!, neighbors = neighboringTiles(y.entrance).filter(i => !w.buildings[i] && !w.water[i])
  return { inside: neighbors.find(i => yardInterior(y, i))!, outside: neighbors.find(i => !yardInterior(y, i))! }
}
describe('Pete’s autonomous garden gate', () => {
  it('requires a completed yard and all three Wood, then constructs gradually without a duplicate debit', () => {
    const empty = createBareWorld(() => .5); advanceWorld(empty, 30000); expect(empty.gateProject).toBeNull()
    const w = world(); supplyWood(w, 824, 2); advanceWorld(w, 30000); expect(w.gateProject).toBeNull()
    supplyWood(w, 824, 3 - crate(w).wood); until(w, () => (w.gateProject?.elapsedMs ?? 0) >= 500)
    const p = w.gateProject!; expect(p.carried).toBe(3); expect(crate(w).wood).toBe(0); expect(gardenGate(w)).toBeNull()
    advanceWorld(w, 4000 - p.elapsedMs - 50); expect(gardenGate(w)).toBeNull()
    advanceWorld(w, 50); expect(p).toMatchObject({ phase: 'complete', built: 1, carried: 0, elapsedMs: 0 })
    expect(gardenGate(w)).toMatchObject({ kind: 'peteGate', openMs: 0, holdUntilMs: 0 })
    expect(placeBuilding(w, 1, 1, 'peteGate', 'east')).toBe(false)
    const ecoWood = ecoProjectWood(w)
    supplyWood(w, 824, 3); advanceWorld(w, 60000)
    expect(w.buildings.filter(b => b?.kind === 'peteGate')).toHaveLength(1); expect(crate(w).wood + ecoProjectWood(w) - ecoWood).toBe(3)
  })
  it('opens from either side, waits before entering, stays open during passage and closes after clearing', () => {
    const w = gate(), g = gardenGate(w)!, entry = w.yard!.entrance, s = sides(w)
    route(w, s.inside); until(w, () => w.pete.tile === s.inside && w.pete.next === null)
    until(w, () => g.openMs === 0, 10000)
    for (const target of [s.outside, s.inside]) {
      expect(walkableTile(w, entry)).toBe(false)
      route(w, target); advanceWorld(w, 50)
      expect(w.pete).toMatchObject({ next: entry, travelMs: 0 }); expect(g.openMs).toBe(50)
      advanceWorld(w, GATE_OPEN_MS - 100); expect(w.pete.travelMs).toBe(0)
      advanceWorld(w, 50); expect(g.openMs).toBe(GATE_OPEN_MS); expect(w.pete.travelMs).toBeGreaterThan(0)
      until(w, () => w.pete.tile === entry); expect(g.openMs).toBe(GATE_OPEN_MS)
      until(w, () => w.pete.tile === target && w.pete.next === null); expect(g.openMs).toBe(GATE_OPEN_MS)
      // Freeze the route at the arrival tile without queuing another crossing.
      Object.assign(w.peace, { activity: 'waving', destination: null, sinceMs: w.timeMs, untilMs: w.timeMs + 5000 }); w.pete.path = []; w.pete.pathRevision = -1
      advanceWorld(w, GATE_HOLD_MS - 50); expect(g.openMs).toBe(GATE_OPEN_MS)
      advanceWorld(w, GATE_OPEN_MS + 50); expect(g.openMs).toBe(0)
    }
  })
  it('keeps a closed gate in Pete’s planned routes to the house, coop, fire and supply crate', () => {
    const w = gate(), s = sides(w); route(w, s.outside); until(w, () => w.pete.tile === s.outside && w.pete.next === null)
    const paths = peteReachableTiles(w, w.pete.tile)
    for (const i of [820, 824, w.coopProject!.tiles[0], w.campfireProject!.tiles[0]]) expect(neighboringTiles(i).some(n => paths.has(n) && !w.buildings[n])).toBe(true)
  })
  it('collects Wood from outside the completed yard and returns through the future doorway to build', () => {
    const w = world(); until(w, () => w.peace.activity === 'resting')
    const s = sides(w), outsideCrate = s.outside - SIZE
    expect(placeBuilding(w, outsideCrate % SIZE, Math.floor(outsideCrate / SIZE), 'supplyCrate', 'east')).toBe(true)
    supplyWood(w, outsideCrate, 3)
    until(w, () => w.gateProject?.phase === 'complete')
    expect((w.buildings[outsideCrate] as SupplyCrate).wood).toBe(0); expect(crate(w).wood).toBe(0)
    expect(w.gateProject?.carried).toBe(0)
  })
  it('keeps adults and chicks inside even while the gate is open and Pete passes repeatedly', () => {
    const w = gate(), s = sides(w), y = w.yard!
    for (const target of [s.inside, s.outside, s.inside, s.outside]) {
      route(w, target)
      for (let t = 0; t < 15000 && w.pete.tile !== target; t += 50) {
        advanceWorld(w, 50); expect(enclosedYard(w)).toBe(y)
        for (const b of w.poultry!.birds) for (const i of [b.tile, b.next]) if (i !== null) expect(yardInterior(y, i)).toBe(true)
      }
      expect(w.pete.tile).toBe(target)
    }
    expect(w.poultry!.birds).toHaveLength(5)
  })
  it('retains carried Wood across blocked construction, missing source and peace interruptions', () => {
    const w = world(); supplyWood(w, 824, 3); until(w, () => w.gateProject?.phase === 'building')
    const p = w.gateProject!, spot = p.spots[0]
    // If already at work, interrupt via home; otherwise temporarily block the approach.
    if (w.pete.tile !== spot && w.pete.next !== spot) {
      expect(placeBuilding(w, spot % SIZE, Math.floor(spot / SIZE), 'storage', 'east')).toBe(true)
      advanceWorld(w, 5000); expect(p.carried).toBe(3); expect(() => load(w)).not.toThrow()
      removeBuilding(w, spot % SIZE, Math.floor(spot / SIZE))
    }
    expect(removeBuilding(w, 20, 20)).toBe(true); advanceWorld(w, 1000); expect(p.carried).toBe(3); expect(() => load(w)).not.toThrow()
    removeBuilding(w, 24, 20); until(w, () => placementError(w, 20, 20, 'treehouse', 'east') === null, 30000); expect(placeBuilding(w, 20, 20, 'treehouse', 'east')).toBe(true)
    until(w, () => p.phase === 'complete'); expect(p.carried).toBe(0)
  })
  it('restores collecting, carrying and partial build progress without spending twice', () => {
    const w = world(); supplyWood(w, 824, 3)
    for (const ready of [() => w.gateProject?.phase === 'collecting', () => w.gateProject?.phase === 'building', () => (w.gateProject?.elapsedMs ?? 0) >= 1000, () => w.gateProject?.phase === 'complete']) {
      until(w, ready); const restored = load(w); expect(snapshot(restored)).toEqual(snapshot(w))
      advanceWorld(w, 365); for (const ms of [17, 101, 247]) advanceWorld(restored, ms)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    expect(crate(w).wood).toBe(0)
  })
  it('preserves closed/opening/passing/closing timers deterministically across saves and time partitions', () => {
    const w = gate(), s = sides(w); route(w, s.inside); until(w, () => w.pete.tile === s.inside && w.pete.next === null)
    route(w, s.outside); advanceWorld(w, 50)
    for (const delta of [50, 200, 250, 800, 1000]) {
      const restored = load(w); advanceWorld(w, delta + 15); for (const ms of [17, delta - 2]) advanceWorld(restored, ms)
      expect(snapshot(restored)).toEqual(snapshot(w))
    }
    const before = snapshot(w); advanceWorld(w, 0); expect(snapshot(w)).toEqual(before)
  })
  it('closes safely after an interrupted approach and keeps the doorway usable after demolition', () => {
    const w = gate(), s = sides(w), g = gardenGate(w)!, entry = w.yard!.entrance
    route(w, s.inside); until(w, () => w.pete.tile === s.inside && w.pete.next === null)
    route(w, s.outside); advanceWorld(w, 100); expect(g.openMs).toBeGreaterThan(0)
    route(w, s.inside); Object.assign(w.peace, { activity: 'waving', destination: null, sinceMs: w.timeMs, untilMs: w.timeMs + 5000 })
    advanceWorld(w, 1000); expect(g.openMs).toBe(0); expect(() => load(w)).not.toThrow()
    route(w, s.outside); until(w, () => w.pete.tile === entry)
    expect(removeBuilding(w, entry % SIZE, Math.floor(entry / SIZE))).toBe(true); expect(enclosedYard(w)).toBe(w.yard)
    expect(() => load(w)).not.toThrow(); until(w, () => w.pete.tile !== entry, 15000)
    advanceWorld(w, 60000); expect(gardenGate(w)).toBeNull(); expect(w.gateProject?.phase).toBe('complete')
    expect(() => load(w)).not.toThrow()
  })
  it('migrates version-19 yard/flock state exactly and rejects malformed gate state or clocks', () => {
    const legacy = world(), old = snapshot(legacy); Object.assign(old, { version: 19 }); Reflect.deleteProperty(old.game, 'personality')
    Reflect.deleteProperty(old.game, 'plantProject')
    const loaded = decodeSave(JSON.stringify(old)).world
    expect(loaded.gateProject).toBeNull(); expect(loaded.yard).toEqual(legacy.yard); expect(loaded.poultry).toEqual(legacy.poultry)
    const w = gate(), entry = w.yard!.entrance
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'gateProject') },
      (d: SaveDocument) => { d.game.gateProject!.carried = 1 },
      (d: SaveDocument) => { d.game.gateProject!.tiles[0]++ },
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'yard') },
      (d: SaveDocument) => { Object.assign(d.game.buildings[entry]!, { openMs: 251 }) },
      (d: SaveDocument) => { Object.assign(d.game.buildings[entry]!, { openMs: 1 }) },
      (d: SaveDocument) => { Object.assign(d.game.buildings[entry]!, { holdUntilMs: w.timeMs + 650 }) },
      (d: SaveDocument) => { Object.assign(d, { version: 19 }); Reflect.deleteProperty(d.game, 'personality') },
    ]) { const d = snapshot(w); mutate(d); expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save') }
    expect(preparePeteGate(w, 1)).toBe(true)
  })
})
