import { describe, expect, it } from 'vitest'
import { createUnlockedWorld } from './testFixtures'
import { advanceWorld } from './step'
import { createPetesWorld, groveError, miniLayout, placeGrove } from './petesWorld'
import { createDevelopmentLife } from './peteDevelopments'
import { advanceForestry, forestryOutput } from './forestryStation'
import { plantTree, MATURE_TREE_MS } from './nature'
import { placeBuilding, SIZE } from './world'
import { allocatePower } from './power'
import { changeCraftingRecipe } from './crafting'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { canReceive, deliverItem, outputMachines } from './transport'
import { emptyInventory, ITEMS, inventoryTotal } from './items'
import { SaveSession } from '../persistence/storage'
import { useGameStore } from '../state/gameStore'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const date = '2026-10-24T12:00:00.000Z'
function forestryWorld() {
  const w = createUnlockedWorld(() => .42)
  placeBuilding(w, 20, 20, 'forester', 'east')
  placeBuilding(w, 21, 21, 'powerPole', 'east')
  placeBuilding(w, 22, 21, 'generator', 'east')
  plantTree(w, 20, 18, 'oak')
  const tree = w.buildings[18 * SIZE + 20]
  if (tree?.kind === 'tree') tree.bornAtMs = -MATURE_TREE_MS
  return w
}
describe('shared Eco production and Petes Welt', () => {
  it('harvests only mature in-range trees, reserves replant Wood and preserves global stock', () => {
    const w = forestryWorld(), station = w.buildings[820]
    if (station?.kind !== 'forester') throw new Error('missing station')
    plantTree(w, 20, 17, 'pine')
    plantTree(w, 20, 16, 'oak')
    const far = w.buildings[660]
    if (far?.kind === 'tree') far.bornAtMs = -MATURE_TREE_MS
    allocatePower(w); advanceForestry(w, 6000)
    expect(station.output.wood).toBe(3)
    expect(forestryOutput(station, w)).toBe(2)
    expect(w.nature.wood).toBe(0)
    expect(w.mined.wood).toBe(3)
    expect(w.buildings[700]?.kind).toBe('tree')
    expect(w.buildings[660]?.kind).toBe('tree')
    advanceForestry(w, 3000)
    expect(station.output.wood).toBe(2)
    expect(w.buildings[740]).toMatchObject({ kind: 'tree', bornAtMs: 0 })
    expect(station.plots).toEqual([])
  })
  it('stops without power or with full output and never overwrites a harvested plot', () => {
    const w = forestryWorld(), station = w.buildings[820]
    if (station?.kind !== 'forester') throw new Error('missing station')
    advanceForestry(w, 6000); expect(w.mined.wood).toBe(0)
    allocatePower(w); advanceForestry(w, 6000)
    placeBuilding(w, 20, 18, 'storage', 'east')
    advanceForestry(w, 3000)
    expect(w.buildings[740]?.kind).toBe('storage')
    expect(station.output.wood).toBe(3)
  })
  it('uses a nearby existing nursery seedling once instead of consuming reserved Wood', () => {
    const w = forestryWorld(), station = w.buildings[820]
    if (station?.kind !== 'forester') throw new Error('missing station')
    w.nurseryProject = { kind: 'nursery', home: 800, direction: 'east', tiles: [819], spots: [859], phase: 'complete', crate: null, built: 1, carried: 0, elapsedMs: 0 }
    w.buildings[819] = { kind: 'peteDevelopment', development: 'nursery', x: 19, y: 20, gears: 0, modules: 0, fruit: 0, readyAtMs: 0 }
    w.developmentLife = createDevelopmentLife(); w.developmentLife.saplings = 1
    allocatePower(w); advanceForestry(w, 6000); advanceForestry(w, 3000)
    expect(w.developmentLife.saplings).toBe(0)
    expect(station.output.wood).toBe(3)
    expect(w.buildings[740]?.kind).toBe('tree')
    advanceForestry(w, 3000); expect(station.output.wood).toBe(3)
  })
  it('retains partial work while a mini-factory site is obstructed', () => {
    const w = createPetesWorld(); placeGrove(w, 26, 15)
    w.miniFactory!.anchor = 17 * SIZE + 24 // Already committed prototype work remains resumable.
    advanceWorld(w, 50)
    const s = w.miniFactory!, step = miniLayout(s.anchor!)[0]
    placeBuilding(w, step.tile % SIZE, Math.floor(step.tile / SIZE), 'storage', 'east')
    const before = { built: s.built, elapsed: s.elapsedMs, xp: w.personality.paths.eco.xp }
    advanceWorld(w, 10000)
    expect({ built: s.built, elapsed: s.elapsedMs, xp: w.personality.paths.eco.xp }).toEqual(before)
    expect(w.buildings[step.tile]?.kind).toBe('storage')
    w.buildings[step.tile] = null; w.water[step.tile] = true
    advanceWorld(w, 10000)
    expect(s.elapsedMs).toBe(before.elapsed)
    expect(s.built).toBe(before.built)
  })
  it('shares input ports, capacity and real assembler recipes', () => {
    const w = createUnlockedWorld(() => .42)
    placeBuilding(w, 20, 20, 'sawmill', 'east')
    placeBuilding(w, 23, 20, 'assembler', 'east')
    const mill = w.buildings[820], assembler = w.buildings[823]
    if (mill?.kind !== 'sawmill' || assembler?.kind !== 'assembler') throw new Error('machines missing')
    expect(canReceive(mill, 'iron', 'east')).toBe(false)
    expect(canReceive(mill, 'wood', 'west')).toBe(false)
    expect(deliverItem(mill, 'wood', 'east')).toBe(true)
    expect(deliverItem(mill, 'wood', 'east')).toBe(true)
    expect(deliverItem(mill, 'wood', 'east')).toBe(false)
    expect(changeCraftingRecipe(w, 23, 20, 'woodenCrate')).toBeNull()
    expect(canReceive(assembler, 'woodPanel', 'east')).toBe(true)
    expect(canReceive(assembler, 'ironPlate', 'east')).toBe(false)
  })
  it('keeps a replant reserve when a belt exports wood', () => {
    const w = forestryWorld(), station = w.buildings[820]
    if (station?.kind !== 'forester') throw new Error('missing station')
    allocatePower(w); advanceForestry(w, 6000)
    placeBuilding(w, 21, 20, 'belt', 'east')
    const belt = w.buildings[821]
    outputMachines(w, new Set())
    if (belt?.kind !== 'belt') throw new Error('missing belt')
    belt.item = null; outputMachines(w, new Set())
    belt.item = null; outputMachines(w, new Set())
    expect(station.output.wood).toBe(1)
    expect(belt.item).toBeNull()
  })
  it('validates whole groves atomically and restricts them to the home surroundings', () => {
    const w = createPetesWorld()
    expect(groveError(w, 20, 20)).not.toBeNull()
    expect(groveError(w, 2, 2)).not.toBeNull()
    placeBuilding(w, 27, 20, 'storage', 'east')
    const count = w.buildings.filter(Boolean).length
    expect(placeGrove(w, 26, 20)).not.toBeNull()
    expect(w.buildings.filter(Boolean)).toHaveLength(count)
    expect(placeGrove(w, 26, 15)).toBeNull()
    expect(w.buildings.filter(b => b?.kind === 'tree')).toHaveLength(9)
  })
  it('finishes an already committed prototype chain and preserves its real products', () => {
    const w = createPetesWorld()
    expect(placeGrove(w, 26, 15)).toBeNull()
    w.miniFactory!.anchor = 17 * SIZE + 24
    advanceWorld(w, 180000)
    expect(w.miniFactory?.built).toBe(11)
    expect(w.pete.tile).not.toBe(860)
    expect(w.mined.wood).toBeGreaterThan(0)
    expect(w.produced.woodPanel).toBeGreaterThan(0)
    expect(w.produced.woodenCrate).toBeGreaterThan(0)
    const storage = w.buildings[miniLayout(w.miniFactory!.anchor!)[10].tile]
    expect(storage?.kind === 'storage' && storage.inventory.woodenCrate).toBeGreaterThan(0)
    const mills = w.buildings.filter(b => b?.kind === 'sawmill' || b?.kind === 'assembler')
    expect(mills).toHaveLength(2)
    expect(w.personality.paths.eco.xp).toBeGreaterThanOrEqual(11 + w.produced.woodenCrate)
    expect(w.personality.paths.craftsman.xp).toBe(0)
    expect(() => decodeSave(encodeSave(w, view, date))).not.toThrow()
  })
  it.each([5000, 17550, 120000, 400000])('continues exactly through a save at %i ms', checkpoint => {
    const initial = createPetesWorld(); placeGrove(initial, 26, 15)
    advanceWorld(initial, checkpoint)
    const restored = decodeSave(encodeSave(initial, view, date)).world
    advanceWorld(initial, 120000); advanceWorld(restored, 120000)
    expect(JSON.parse(encodeSave(restored, view, date))).toEqual(JSON.parse(encodeSave(initial, view, date)))
  })
  it('upgrades version-38 inventories and rejects invalid new work without mutating source', () => {
    const w = createUnlockedWorld(() => .42), doc = JSON.parse(encodeSave(w, view, date))
    doc.version = 38
    const strip = (v: unknown): void => {
      if (!v || typeof v !== 'object') return
      const r = v as Record<string, unknown>
      if ('iron' in r && 'ironPlate' in r) for (const key of ['wood', 'woodPanel', 'woodenCrate']) delete r[key]
      Object.values(r).forEach(strip)
    }
    strip(doc.game)
    const upgraded = decodeSave(JSON.stringify(doc)).world
    expect(upgraded.produced).toEqual(emptyInventory())
    const mini = createPetesWorld(), bad = JSON.parse(encodeSave(mini, view, date))
    bad.game.miniFactory.elapsedMs = 1
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    expect(mini.miniFactory?.elapsedMs).toBe(0)
  })
  it('keeps mode saves separate and rejects machine hotkeys in Petes Welt', () => {
    const slots = new Map<string, string>(), session = new SaveSession({ getItem: k => slots.get(k) ?? null, setItem: (k, v) => { slots.set(k, v) } }, () => date)
    session.save(createUnlockedWorld(() => .42), view, 'manual')
    session.setMode('petesWorld'); session.save(createPetesWorld(), view, 'manual')
    expect(session.load('manual').world.miniFactory).toBeDefined()
    session.setMode('factory'); expect(session.load('manual').world.miniFactory).toBeUndefined()
    expect(slots.size).toBe(2)
    const prior = useGameStore.getState()
    useGameStore.setState({ playMode: 'petesWorld', tool: null })
    useGameStore.getState().select('miner'); expect(useGameStore.getState().tool).toBeNull()
    useGameStore.getState().select('placeGrove'); expect(useGameStore.getState().tool).toBe('placeGrove')
    useGameStore.setState(prior, true)
  })
  it('counts no new wood outside the harvest/recipe boundaries', () => {
    const w = createUnlockedWorld(() => .42)
    for (const step of miniLayout(20 * SIZE + 18)) placeBuilding(w, step.tile % SIZE, Math.floor(step.tile / SIZE), step.kind, 'east')
    changeCraftingRecipe(w, 22, 20, 'woodenCrate')
    for (const x of [17, 18, 19]) { plantTree(w, x, 18, 'oak'); const tree = w.buildings[18 * SIZE + x]; if (tree?.kind === 'tree') { tree.bornAtMs = -MATURE_TREE_MS; tree.origin = 'natural' } }
    advanceWorld(w, 180000)
    let timber = 0
    for (const b of w.buildings) {
      if (!b) continue
      const inv = 'inventory' in b ? b.inventory : 'output' in b ? b.output : null
      if (inv) timber += inv.wood + inv.woodPanel / 2 + inv.woodenCrate * 2
      if ('input' in b && b.kind !== 'splitter') timber += b.input.wood + b.input.woodPanel / 2
      if ('job' in b && b.job) timber += b.job.inputs.wood + b.job.inputs.woodPanel / 2
      if (b.kind === 'belt' && b.item) timber += b.item === 'wood' ? 1 : b.item === 'woodPanel' ? .5 : b.item === 'woodenCrate' ? 2 : 0
    }
    const consumedForPlants = w.analytics.buckets.reduce((n, b) => n + b.consumed.wood, 0) - w.produced.woodPanel / 2 - w.buildings.reduce((n, b) => n + (b?.kind === 'sawmill' && b.job ? b.job.inputs.wood : 0), 0)
    expect(timber + consumedForPlants).toBe(w.mined.wood)
    expect(ITEMS.every(i => w.produced[i] >= 0)).toBe(true)
    expect(inventoryTotal(w.produced)).toBeGreaterThan(0)
  })
})
