import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { advanceExpansion, chooseExpansion, expansionLayout } from './homesteadExpansion'
import { begin, materialStore } from './homestead'
import { emptyInventory, inventoryTotal } from './items'
import { awardActivity } from './personality'
import { createPetesWorld, placeCoal, placeCopper, placeIron } from './petesWorld'
import { changeCraftingRecipe } from './crafting'
import { advanceWorld } from './step'
import { placeBuilding, removeBuilding } from './world'
import { advanceRebuilding, chooseRebuild, rebuildCost } from './rebuilding'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-26T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, test: () => boolean, limit = 300000) {
  for (let t = 0; t < limit && !test(); t += 50) advanceWorld(w, 50)
  expect(test(), JSON.stringify({ time: w.timeMs, h: w.homestead, store: materialStore(w), levels: w.personality.paths, peace: w.peace, pete: w.pete, mined: w.mined, machines: w.buildings.filter(b => b && !['treehouse', 'supplyCrate'].includes(b.kind)) })).toBe(true)
}
function stored() {
  const w = createPetesWorld()
  // Keep a legal, reachable store close to home.
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  w.homestead!.store = 900
  return w
}
describe('resource-led copper automation, circuits and coal', () => {
  it('bootstraps the same general store and reaches Industrial 2 from coal alone', () => {
    const w = createPetesWorld(); expect(placeCoal(w, 26, 18)).toBeNull()
    until(w, () => materialStore(w) !== null)
    expect(w.mined.coal).toBe(6); expect(w.homestead!.carried.coal).toBe(0)
    expect(w.personality.paths.industrial.xp).toBe(5)
    until(w, () => w.personality.paths.industrial.level >= 2)
    expect(materialStore(w)!.inventory.coal).toBeGreaterThan(0)
    expect(w.mined.iron + w.mined.copper + w.mined.wood).toBe(0)
    expect(load(w).homestead).toEqual(w.homestead)
  })
  it('builds a material-paid copper miner and route to the existing furnace, retaining paid saves', () => {
    const w = stored(), h = w.homestead!, e = h.expansion
    placeCopper(w, 26, 15)
    placeBuilding(w, 24, 18, 'furnace', 'east'); e.copperFurnace = 744
    placeBuilding(w, 24, 19, 'powerPole', 'east'); placeBuilding(w, 25, 19, 'generator', 'east')
    placeBuilding(w, 14, 18, 'assembler', 'east'); e.cableAssembler = 734; changeCraftingRecipe(w, 14, 18, 'copperCable')
    awardActivity(w.personality, { path: 'inventor', xp: 80 }); materialStore(w)!.inventory.copperPlate = 8
    expect(chooseExpansion(w, 'inventor')).toBe(true)
    expect(e.plan?.kind).toBe('copperMining')
    const parts = expansionLayout(e.plan!)
    expect(e.plan!.route!.at(-1)).toBe(e.copperFurnace - 1)
    for (let i = 0; i < 3000 && e.plan; i++) { w.timeMs += 50; advanceExpansion(w, 50); if (e.plan?.built === 1) expect(load(w).homestead!.carried).toEqual(h.carried) }
    expect(e.copperMiner).not.toBeNull(); expect(materialStore(w)!.inventory.copperPlate).toBe(0)
    expect(parts.every(p => w.buildings[p.tile]?.kind === p.kind)).toBe(true)
    advanceWorld(w, 15000)
    const furnace = w.buildings[e.copperFurnace!]
    expect(w.produced.copperPlate).toBeGreaterThan(0)
    expect(furnace?.kind).toBe('furnace')
    expect(w.mined.copper).toBeGreaterThan(0)
  })
  it('physically feeds the existing circuit recipe, consumes actual mixed inputs and resumes exactly', () => {
    const w = stored(), h = w.homestead!, e = h.expansion, store = materialStore(w)!
    placeBuilding(w, 24, 20, 'assembler', 'east'); e.circuitAssembler = 824
    changeCraftingRecipe(w, 24, 20, 'electronicCircuit')
    placeBuilding(w, 24, 21, 'powerPole', 'east'); placeBuilding(w, 25, 21, 'generator', 'east')
    store.inventory.ironPlate = 1; store.inventory.copperCable = 3
    begin(w, 'fetchCircuits', h.store)
    for (let i = 0; i < 1000 && h.task !== 'feedCircuits'; i++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(h.carried.ironPlate).toBe(1); expect(h.carried.copperCable).toBe(3)
    const restored = load(w)
    advanceWorld(w, 30000); advanceWorld(restored, 30000)
    expect(snapshot(restored)).toEqual(snapshot(w))
    const machine = w.buildings[824]
    expect(w.produced.electronicCircuit).toBe(1)
    expect((machine?.kind === 'assembler' ? machine.output.electronicCircuit : 0) + store.inventory.electronicCircuit + h.carried.electronicCircuit).toBe(1)
    expect(store.inventory.ironPlate + store.inventory.copperCable).toBe(0)
    expect(inventoryTotal(h.carried)).toBe(0)
  })
  it('reaches practice flights and safe scenic flights from offered raw copper and iron alone', () => {
    const w = createPetesWorld()
    expect(placeCopper(w, 24, 20)).toBeNull()
    expect(placeIron(w, 16, 20)).toBeNull()
    until(w, () => (w.leisure?.practices ?? 0) > 0, 7200000)
    expect(w.produced.electronicCircuit).toBeGreaterThan(0)
    expect(w.homestead!.expansion.copperMiner).not.toBeNull()
    expect(w.homestead!.expansion.circuitAssembler).not.toBeNull()
    until(w, () => w.leisure?.flight?.practice === false, 7200000)
    expect(w.personality.paths.inventor.level).toBe(5)
    expect(load(w).leisure).toEqual(w.leisure)
  }, 60000)
  it('builds and personally fuels a steam engine from coal alone and resumes a real burn exactly', () => {
    const w = createPetesWorld()
    expect(placeCoal(w, 26, 18)).toBeNull()
    until(w, () => w.homestead!.expansion.steamEngine !== null, 600000)
    const index = w.homestead!.expansion.steamEngine!
    until(w, () => { const e = w.buildings[index]; return e?.kind === 'steamEngine' && e.cycles >= 2 }, 600000)
    const e = w.buildings[index]
    expect(e?.kind).toBe('steamEngine')
    expect(w.personality.paths.industrial.level).toBeGreaterThanOrEqual(2)
    expect(w.mined.iron + w.mined.copper + w.mined.wood).toBe(0)
    const restored = load(w)
    advanceWorld(w, 30000); advanceWorld(restored, 30000)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })

  it('tops up partial circuit ingredients without withdrawing or manufacturing another full batch', () => {
    const w = stored(), e = w.homestead!.expansion, store = materialStore(w)!
    placeBuilding(w, 24, 20, 'assembler', 'east'); e.circuitAssembler = 824
    changeCraftingRecipe(w, 24, 20, 'electronicCircuit')
    const machine = w.buildings[824]
    if (machine?.kind !== 'assembler') throw new Error('missing assembler')
    machine.input.ironPlate = 1; machine.input.copperCable = 1
    store.inventory.copperCable = 2
    expect(chooseExpansion(w, 'inventor')).toBe(true)
    expect(w.homestead!.task).toBe('fetchCircuits')
    for (let i = 0; i < 1000 && w.homestead!.task !== 'feedCircuits'; i++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(w.homestead!.carried.ironPlate).toBe(0)
    expect(w.homestead!.carried.copperCable).toBe(2)
    expect(load(w).homestead).toEqual(w.homestead)
    for (let i = 0; i < 1000 && w.homestead!.task; i++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(machine.input).toMatchObject({ ironPlate: 1, copperCable: 3 })
    expect(store.inventory.ironPlate + store.inventory.copperCable).toBe(0)
  })
  it('upgrades a genuine version-45 routine without adding fuel, stock or completed projects', () => {
    const w = stored(), old = snapshot(w)
    old.version = 45
    for (const key of ['copperMiner', 'circuitAssembler', 'steamEngine', 'coalMiner', 'fuelStore', 'coalInserter', 'briquetteAssembler', 'steamWorkshop', 'steamHoist']) delete old.game.homestead.expansion[key]
    const strip = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      if (!Array.isArray(value)) delete (value as Record<string, unknown>).coal
      Object.values(value).forEach(strip)
    }
    strip(old.game)
    const restored = decodeSave(JSON.stringify(old)).world
    expect(snapshot(restored)).toEqual(snapshot(w))
    old.game.homestead.task = 'mineCoal'; old.game.homestead.target = 824
    expect(() => decodeSave(JSON.stringify(old))).toThrow()
  })

  it('repairs the steam engine with real fuel, preserves paid work and grants no repeated building reward', () => {
    const w = stored(), e = w.homestead!.expansion, store = materialStore(w)!
    placeBuilding(w, 24, 20, 'steamEngine', 'east'); e.steamEngine = 824
    placeBuilding(w, 24, 19, 'powerPole', 'east')
    store.inventory.coal = 6
    removeBuilding(w, 24, 20)
    const job = w.rebuilding!.jobs.find(j => j.tile === 824)!
    expect(rebuildCost(w, job).coal).toBe(6)
    const xp = w.personality.paths.industrial.xp
    for (let i = 0; i < 1000 && !job.funded; i++) { chooseRebuild(w); w.timeMs += 50; advanceRebuilding(w, 50) }
    expect(job.funded).toBe(true); expect(store.inventory.coal).toBe(0)
    expect(load(w).rebuilding).toEqual(w.rebuilding)
    for (let i = 0; i < 1000 && !w.buildings[824]; i++) { w.timeMs += 50; advanceRebuilding(w, 50) }
    expect(w.buildings[824]).toMatchObject({ kind: 'steamEngine', fuel: 6, cycles: 0 })
    expect(w.personality.paths.industrial.xp).toBe(xp)
  })

})
