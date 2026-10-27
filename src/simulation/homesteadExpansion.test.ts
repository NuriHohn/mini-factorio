import { stripVersion48Homestead } from './testFixtures'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, ironError, placeGrove, placeIron } from './petesWorld'
import { advanceWorld } from './step'
import { advanceHomestead, begin, materialStore } from './homestead'
import { expansionLayout, IMPROVEMENTS } from './homesteadExpansion'
import { awardActivity } from './personality'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { supplyCapacity } from './supplyCrate'
import { emptyInventory, inventoryTotal } from './items'
import { deliverItem } from './transport'
import { terrainRevision } from './waterTerrain'
import type { World } from './world'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-10-24T15:00:00.000Z'
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, stamp))
function until(w: World, condition: () => boolean, limit = 600000) {
  for (let t = 0; t < limit && !condition(); t += 50) advanceWorld(w, 50)
  expect(condition(), JSON.stringify({ time: w.timeMs, h: w.homestead, stock: materialStore(w), activity: w.peace.activity, levels: w.personality.paths })).toBe(true)
}
function forest() {
  const w = createPetesWorld()
  for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(w, x, y)).toBeNull()
  return w
}
describe('gradual homestead products and iron development', () => {
  it('places only atomic free nearby ore, without items, XP or changing Factory resources', () => {
    const w = createPetesWorld(), before = snapshot(w)
    expect(placeIron(w, 20, 20)).not.toBeNull()
    expect(snapshot(w)).toEqual(before)
    expect(placeIron(w, 26, 18)).toBeNull()
    expect(w.tiles.filter(t => t === 'iron')).toHaveLength(9)
    expect(terrainRevision(w)).toBe(1)
    expect(ironError(w, 26, 18)).not.toBeNull()
    expect(placeGrove(w, 26, 18)).not.toBeNull()
    expect(w.mined.iron).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(0)
  })
  it('supports an iron-only start, real mining/delivery and a shared powered furnace', () => {
    const w = createPetesWorld()
    expect(placeIron(w, 26, 18)).toBeNull()
    until(w, () => materialStore(w) !== null)
    expect(w.mined.iron).toBe(6)
    expect(w.homestead?.carried.iron).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(5)
    expect(w.personality.paths.eco.xp).toBe(0)
    until(w, () => (materialStore(w)?.inventory.ironPlate ?? 0) >= 12, 1200000)
    expect(w.homestead?.expansion.furnace).not.toBeNull()
    expect(w.personality.paths.craftsman.level).toBeGreaterThanOrEqual(2)
    expect(w.produced.ironPlate).toBeGreaterThanOrEqual(12)
    const generators = w.buildings.flatMap((b, tile) => b?.kind === 'generator' ? [{ tile, b }] : [])
    for (const { tile } of generators) w.buildings[tile] = null
    w.topologyRevision++
    const produced = w.produced.ironPlate
    advanceWorld(w, 10000)
    expect(w.produced.ironPlate).toBe(produced)
    for (const { tile, b } of generators) w.buildings[tile] = b
    w.topologyRevision++
    expect(w.buildings.some(b => b?.kind === 'sawmill' || b?.kind === 'forester')).toBe(false)
    expect(() => snapshot(w)).not.toThrow()
    const store = materialStore(w)!
    const accounted = w.buildings.reduce((n, b) => n + (b?.kind === 'furnace' ? b.input.iron + b.output.ironPlate + (b.job?.inputs.iron ?? 0) : 0), 0) + store.inventory.iron + store.inventory.ironPlate + w.homestead!.carried.iron + w.homestead!.carried.ironPlate
    // Six ore paid for storage, six for the furnace/power build. Projects may
    // already have withdrawn plates, but nothing can create additional iron.
    expect(accounted).toBeLessThanOrEqual(w.mined.iron - 12)
    until(w, () => w.workshopProject?.phase === 'complete', 1200000)
    expect(w.personality.rewardedProjects).toContain('workshop')
  })
  it('preserves iron cargo at a full store and awards delivery XP exactly once', () => {
    const w = createPetesWorld(); placeIron(w, 26, 18)
    until(w, () => materialStore(w) !== null)
    const h = w.homestead!, s = materialStore(w)!
    h.task = 'returnStock'; h.target = h.store; h.carried.iron = 3; s.wood = 200
    const xp = w.personality.paths.craftsman.xp
    for (let i = 0; i < 200; i++) advanceHomestead(w, 50)
    expect(h.carried.iron).toBe(3); expect(w.personality.paths.craftsman.xp).toBe(xp)
    s.wood = 197
    for (let i = 0; i < 200 && h.task; i++) advanceHomestead(w, 50)
    expect(s.inventory.iron).toBe(3); expect(h.carried.iron).toBe(0)
    expect(w.personality.paths.craftsman.xp).toBe(xp + 3)
  })
  describe('Eco products from an independently copied, simulated homestead', () => {
    let fixture: World
    beforeAll(() => {
      fixture = forest()
      until(fixture, () => fixture.gardenProject?.phase === 'complete' && fixture.coopProject?.phase === 'complete', 1200000)
    }, 60000)
    beforeAll(() => {
      const store = materialStore(fixture)!
      store.wood = 60; awardActivity(fixture.personality, { path: 'eco', xp: 200 })
      until(fixture, () => store.storeTier === 1 && fixture.homestead!.expansion.improvements.coopAwning !== undefined && fixture.homestead!.expansion.improvements.gardenBench !== undefined, 1800000)
    }, 60000)
    it('pays real panels for the roof, coop awning and garden bench', () => {
      const w = structuredClone(fixture), store = materialStore(w)!, e = w.homestead!.expansion
      expect(store.storeTier).toBe(1)
      expect(e.improvements.coopAwning).toBeDefined()
      expect(e.improvements.gardenBench).toBeDefined()
      expect(w.produced.woodPanel).toBeGreaterThanOrEqual(20)
    })
    describe('with a genuinely completed shared production line', () => {
      let chainFixture: World
      let productFixture: World
      beforeAll(() => {
        chainFixture = structuredClone(fixture)
        until(chainFixture, () => chainFixture.homestead!.expansion.forestry !== null, 1800000)
      }, 60000)
      beforeAll(() => {
        until(chainFixture, () => chainFixture.homestead!.expansion.assembler !== null, 1800000)
      }, 60000)
      beforeAll(() => {
        productFixture = structuredClone(chainFixture)
        until(productFixture, () => productFixture.produced.woodenCrate >= 7, 1800000)
      }, 60000)
      it('builds the real connected forestry and crate production machines', () => {
        const w = structuredClone(chainFixture), e = w.homestead!.expansion
        expect(w.buildings[e.forestry!]?.kind).toBe('forester')
        expect(w.buildings[e.assembler!]?.kind).toBe('assembler')
      })
      it('spends actual crates on all improvements and preserves bounded production after saves', () => {
        const w = structuredClone(productFixture), store = materialStore(w)!, e = w.homestead!.expansion
        until(w, () => store.storeTier === 2 && e.improvements.gardenBoxes !== undefined, 1800000)
        expect(IMPROVEMENTS.every(id => e.improvements[id] !== undefined)).toBe(true)
        expect(w.produced.woodenCrate).toBeGreaterThanOrEqual(7)
        expect(supplyCapacity(store)).toBe(600)
        const restored = decodeSave(encodeSave(w, view, stamp)).world
        advanceWorld(w, 10000); advanceWorld(restored, 10000)
        expect(snapshot(restored)).toEqual(snapshot(w))
        // Bounded machine buffers stop the shared line once Pete stops collecting.
        store.inventory.woodenCrate = 8
        advanceWorld(w, 60000)
        expect(store.inventory.woodenCrate).toBe(8)
        const assembler = w.buildings[e.assembler!]
        expect(assembler?.kind === 'assembler' && inventoryTotal(assembler.output)).toBeLessThanOrEqual(4)
      })
    })
  })
  it('continues active iron mining/build/input/output exactly across saves', () => {
    const w = createPetesWorld(); placeIron(w, 26, 18)
    const checked = new Set<string>()
    for (let t = 0; t < 1200000 && checked.size < 5; t += 50) {
      const h = w.homestead!
      if (h.task && ['mineIron', 'buildStore', 'buildChain', 'feedIron', 'takeIron', 'returnStock'].includes(h.task) && (h.elapsedMs > 0 || inventoryTotal(h.carried)) && !checked.has(h.task)) {
        checked.add(h.task)
        const loaded = decodeSave(encodeSave(w, view, stamp)).world
        advanceWorld(w, 2000); advanceWorld(loaded, 2000)
        expect(snapshot(loaded)).toEqual(snapshot(w))
      } else advanceWorld(w, 50)
    }
    expect(checked).toEqual(new Set(['mineIron', 'buildStore', 'buildChain', 'feedIron', 'returnStock']))
  })
  it('migrates version 40 without changing paid work and rejects malformed expansion state', () => {
    const w = forest(); advanceWorld(w, 15000)
    const old = snapshot(w); old.version = 40; stripVersion48Homestead(old.game); delete old.game.homestead.nextRestAtMs; delete old.game.homestead.expansion
    const restored = decodeSave(JSON.stringify(old)).world
    expect(restored.homestead?.carried).toEqual(w.homestead?.carried)
    expect(restored.homestead?.expansion).toEqual(w.homestead?.expansion)
    const bad = snapshot(w)
    bad.game.homestead.expansion.plan = { kind: 'iron', anchor: 1599, direction: 'east', built: 0 }
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    bad.game.homestead.expansion.plan = null
    bad.game.homestead.carried.copper = 1
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    const current = snapshot(w), migrated = snapshot(restored)
    delete current.game.homestead.nextRestAtMs; delete migrated.game.homestead.nextRestAtMs
    expect(current).toEqual(migrated)
  })
  it('continues mixed paid forestry work and crate improvement work without repeating costs', () => {
    const w = forest(); until(w, () => materialStore(w) !== null)
    const h = w.homestead!
    h.expansion.plan = { kind: 'forestry', anchor: 410, direction: 'east', built: 1 }
    begin(w, 'buildChain', 411); h.carried.woodPanel = 8; h.carried.wood = 1; h.elapsedMs = 2000
    let restored = decodeSave(encodeSave(w, view, stamp)).world
    advanceWorld(w, 50); advanceWorld(restored, 50)
    expect(snapshot(restored)).toEqual(snapshot(w))
    h.expansion.plan = null; h.expansion.improvement = 'storeShelves'
    begin(w, 'improve', h.store); h.carried = emptyInventory(); h.carried.woodenCrate = 4; h.elapsedMs = 2000
    materialStore(w)!.storeTier = 1
    restored = decodeSave(encodeSave(w, view, stamp)).world
    advanceWorld(w, 50); advanceWorld(restored, 50)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('uses the shared 600-item capacity for shelved mixed storage and rejects overflow', () => {
    const w = createPetesWorld(); placeIron(w, 26, 18); until(w, () => materialStore(w) !== null)
    const store = materialStore(w)!
    store.storeTier = 2; store.wood = 599
    expect(deliverItem(store, 'iron', 'east')).toBe(true)
    expect(deliverItem(store, 'iron', 'east')).toBe(false)
    expect(() => snapshot(w)).not.toThrow()
    const bad = snapshot(w); bad.game.buildings[w.homestead!.store!].wood++
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  })
  it('preserves paid partial construction if a remaining site becomes blocked', () => {
    const w = createPetesWorld(); placeIron(w, 26, 18)
    until(w, () => w.homestead?.task === 'buildChain' && (w.homestead.expansion.plan?.built ?? 0) === 1)
    const h = w.homestead!, plan = h.expansion.plan!, tile = expansionLayout(plan)[1].tile
    w.water[tile] = true
    const carried = structuredClone(h.carried), built = plan.built
    advanceWorld(w, 10000)
    expect(plan.built).toBe(built); expect(h.carried).toEqual(carried)
    w.water[tile] = false
    until(w, () => h.expansion.furnace !== null)
    expect(h.carried.iron).toBe(0)
  })
})
