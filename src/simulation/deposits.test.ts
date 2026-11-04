import { describe, expect, it } from 'vitest'
import { createPetesWorld, placeIron, placeCopper, placeCoal } from './petesWorld'
import { createDeposits, DEPOSIT_CAPACITY, extractOre, oreRemaining } from './deposits'
import { advancePetesWorld } from '../pete/simulation'
import { productionStep } from '../core/production'
import { advanceExpansion, expansionLayout, planChain } from './homesteadExpansion'
import { advanceMineRetirement, chooseMineReplacement } from './mineReplacement'
import { begin, finish, materialStore } from './homestead'
import { emptyInventory } from './items'
import { placeBuilding, SIZE } from './world'
import type { World } from './world'
import { poweredWorld } from './testFixtures'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import { workingDemand } from './power'
import { nextDevelopments } from './nextDevelopment'
import { serviceCrossing } from './navigation'
import { outputMachines } from './transport'
import { terrainRevision } from './waterTerrain'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-11-04T12:00:00.000Z'
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, stamp))

function miningWorld(ore: 'iron' | 'copper' | 'coal') {
  const w = createPetesWorld(), h = w.homestead!, e = h.expansion
  w.water.fill(false)
  w.nature.wood = 20
  const source = 18 * SIZE + 26, end = 18 * SIZE + 29
  w.tiles[source] = ore
  for (let y = 15; y <= 17; y++) for (let x = 24; x <= 26; x++) w.tiles[y * SIZE + x] = ore
  expect(placeBuilding(w, 23, 22, 'supplyCrate', 'east')).toBe(true)
  h.store = 22 * SIZE + 23
  const store = w.buildings[h.store]
  if (store?.kind !== 'supplyCrate') throw new Error('store')
  store.storeTier = 0
  store.inventory.ironPlate = 40
  store.inventory.copperPlate = 40
  store.inventory.coal = 40
  expect(placeBuilding(w, 26, 18, 'miner', 'east')).toBe(true)
  for (let x = 27; x <= (ore === 'coal' ? 28 : 29); x++) expect(placeBuilding(w, x, 18, 'belt', 'east')).toBe(true)
  if (ore === 'coal') {
    expect(placeBuilding(w, 29, 18, 'fuelDepot', 'east')).toBe(true)
    expect(placeBuilding(w, 31, 18, 'steamEngine', 'east')).toBe(true)
    w.research.unlocked.push('logistics1')
    expect(placeBuilding(w, 30, 18, 'inserter', 'east')).toBe(true)
    e.coalMiner = source; e.fuelStore = end; e.steamEngine = end + 2; e.coalInserter = end + 1
  } else {
    expect(placeBuilding(w, 30, 18, 'furnace', 'east')).toBe(true)
    if (ore === 'iron') { e.miner = source; e.furnace = end + 1 }
    else { e.copperMiner = source; e.copperFurnace = end + 1 }
  }
  w.deposits!.remaining[source] = 1
  return { w, source, end }
}

describe('finite Pete deposits and mine succession', () => {
  it.each([['iron', placeIron], ['copper', placeCopper], ['coal', placeCoal]] as const)('consumes exact %s reserves, clears terrain, and permits a fresh offer', (ore, place) => {
    const w = createPetesWorld(), tile = 18 * SIZE + 26
    expect(place(w, 26, 18)).toBeNull()
    expect(oreRemaining(w, tile)).toBe(DEPOSIT_CAPACITY)
    expect(extractOre(w, tile, ore, DEPOSIT_CAPACITY - 2)).toBe(DEPOSIT_CAPACITY - 2)
    const revision = terrainRevision(w)
    expect(extractOre(w, tile, ore, 3)).toBe(2)
    expect(w.tiles[tile]).toBeNull()
    expect(terrainRevision(w)).toBeGreaterThan(revision)
    expect(extractOre(w, tile, ore, 3)).toBe(0)
    expect(w.deposits!.remaining[tile]).toBeUndefined()
    expect(w.mined[ore]).toBe(0) // callers own the production ledger
  })

  it('hand mining carries the real final partial batch and cannot create extra ore', () => {
    const w = createPetesWorld(), tile = 21 * SIZE + 21
    w.tiles[tile] = 'iron'; w.deposits!.remaining[tile] = 1
    begin(w, 'mineIron', tile)
    for (let n = 0; n < 200 && w.tiles[tile]; n++) advancePetesWorld(w, 50)
    expect(w.tiles[tile]).toBeNull()
    expect(w.mined.iron).toBe(1)
    expect(w.homestead!.carried.iron).toBe(1)
    advancePetesWorld(w, 10000)
    expect(w.mined.iron).toBe(1)
    expect(w.homestead!.task).toBe('gather')
    expect(() => decodeSave(encodeSave(w, view, stamp))).not.toThrow()
    expect(placeIron(w, 26, 18)).toBeNull()
    for (let n = 0; n < 3000 && !materialStore(w); n++) advancePetesWorld(w, 50)
    expect(materialStore(w)).not.toBeNull()
  })

  it('powered mining drains its final buffer while Factory retains unlimited ore', () => {
    const w = poweredWorld(() => .42), tile = 20 * SIZE + 20
    w.tiles[tile] = 'iron'
    placeBuilding(w, 20, 20, 'miner', 'east')
    for (let n = 0; n < 25; n++) productionStep(w)
    expect(w.mined.iron).toBe(1)
    expect(w.tiles[tile]).toBe('iron')
    expect(oreRemaining(w, tile)).toBeNull()
  })

  it('consumes finite machine ore only for actual powered output and preserves the last blocked item', () => {
    const w = poweredWorld(() => .42), tile = 20 * SIZE + 20
    w.deposits = createDeposits()
    w.tiles[tile] = 'copper'; w.deposits.remaining[tile] = 1
    placeBuilding(w, 20, 20, 'miner', 'east')
    const generator = w.buildings[18 * SIZE + 21]!
    w.buildings[18 * SIZE + 21] = null; w.topologyRevision++
    for (let n = 0; n < 25; n++) productionStep(w)
    expect(oreRemaining(w, tile)).toBe(1)
    w.buildings[18 * SIZE + 21] = generator; w.topologyRevision++
    for (let n = 0; n < 25; n++) productionStep(w)
    expect(oreRemaining(w, tile)).toBe(0)
    expect(w.mined.copper).toBe(1)
    expect(w.buildings[tile]).toMatchObject({ kind: 'miner', item: 'copper' })
    for (let n = 0; n < 100; n++) productionStep(w)
    expect(w.mined.copper).toBe(1)
    expect(w.buildings[tile]).toMatchObject({ item: 'copper' })
    const miner = w.buildings[tile]!
    if (miner.kind !== 'miner') throw new Error('miner')
    miner.item = null
    expect(workingDemand(miner, w)).toBe(0)
  })

  it.each(['iron', 'copper', 'coal'] as const)('plans an early paid %s replacement reusing the destination and drains the retired branch', ore => {
    const { w, source, end } = miningWorld(ore), h = w.homestead!, e = h.expansion
    expect(chooseMineReplacement(w)).toBe(true)
    const plan = e.plan!
    expect(plan.anchor).not.toBe(source)
    expect(plan.reuse).toContain(end)
    expect(w.tiles[source]).toBe(ore) // replacement is planned before depletion
    const oldStock = materialStore(w)!.inventory[ore === 'iron' ? 'ironPlate' : ore === 'copper' ? 'copperPlate' : 'coal']
    for (let n = 0; n < 15000 && e.plan; n++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(e.plan, JSON.stringify(h)).toBeNull()
    expect(materialStore(w)!.inventory[ore === 'iron' ? 'ironPlate' : ore === 'copper' ? 'copperPlate' : 'coal']).toBe(oldStock - (ore === 'coal' ? 6 : 8))
    expect(w.deposits!.retiring).toContain(source)
    const old = w.buildings[source]
    if (old?.kind !== 'miner') throw new Error('old miner')
    const unmined = oreRemaining(w, source)
    for (let n = 0; n < 25; n++) productionStep(w)
    expect(oreRemaining(w, source)).toBe(unmined)
    expect(workingDemand(old, w)).toBe(0)
    old.item = ore
    h.task = null; h.target = null; h.carried = emptyInventory()
    chooseMineReplacement(w)
    expect(h.task).not.toBe('retireMine')
    old.item = null
    h.task = null; h.target = null
    expect(chooseMineReplacement(w)).toBe(true)
    expect(h.task).toBe('retireMine')
    const restored = decodeSave(encodeSave(w, view, stamp)).world
    for (let n = 0; n < 3000 && h.task; n++) { w.timeMs += 50; advanceMineRetirement(w, 50) }
    for (let n = 0; n < 3000 && restored.homestead!.task; n++) { restored.timeMs += 50; advanceMineRetirement(restored, 50) }
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(w.buildings[source]).toBeNull()
    expect(oreRemaining(w, source)).toBe(unmined)
    expect(w.rebuilding?.jobs ?? []).toHaveLength(0)
    expect(w.buildings[end]?.kind).toBe(ore === 'coal' ? 'fuelDepot' : 'belt')
  })

  it('does not suspend other work when no replacement source exists', () => {
    const { w, source } = miningWorld('iron')
    w.tiles.forEach((_, tile) => { if (tile !== source) w.tiles[tile] = null })
    extractOre(w, source, 'iron', 1)
    chooseMineReplacement(w)
    expect(w.homestead!.expansion.miner).toBeNull()
    expect(w.homestead!.expansion.plan).toBeNull()
  })

  it('recovers after an unfunded retirement, reuses drained parts and retains the original reward', () => {
    const { w, source } = miningWorld('iron'), h = w.homestead!, store = materialStore(w)!
    store.inventory.ironPlate = 0
    w.rebuilding = { jobs: [], active: null, rewarded: [] }
    const finished = nextDevelopments(w, []).find(p => p.path === 'craftsman')!.completion.finished
    extractOre(w, source, 'iron', 1)
    chooseMineReplacement(w)
    expect(h.expansion.miner).toBeNull()
    expect(nextDevelopments(w, []).find(p => p.path === 'craftsman')!.completion.finished).toBe(finished)
    finish(w)
    store.inventory.ironPlate = 40
    const plan = planChain(w, 'ironMining')!
    expect(plan.reuse!.length).toBeGreaterThan(0)
    h.expansion.plan = plan
    begin(w, 'buildChain', h.store)
    const xp = w.personality.paths.craftsman.xp
    for (let n = 0; n < 15000 && h.expansion.plan; n++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(h.expansion.plan).toBeNull()
    expect(w.personality.paths.craftsman.xp).toBe(xp)
    expect(w.deposits!.retiring.some(tile => expansionLayout(plan).some(p => p.tile === tile))).toBe(false)
    expect(() => decodeSave(encodeSave(w, view, stamp))).not.toThrow()
  })

  it('retains a return link merge and its walking access when its original coal source retires', () => {
    const { w, source, end } = miningWorld('coal'), h = w.homestead!
    materialStore(w)!.inventory.coal = 0
    const receiver = source + 2
    h.infrastructure.links.push({ kind: 'loadingReturn', source: end + 2 * SIZE, target: end, receiver, inlet: [source, source + 1, receiver, end], parts: [] })
    extractOre(w, source, 'coal', 1)
    chooseMineReplacement(w)
    expect(h.expansion.coalMiner).toBeNull()
    expect(h.infrastructure.links[0].inlet).toEqual([receiver, end])
    expect(w.deposits!.retiring).not.toContain(receiver)
    expect(w.buildings[receiver]?.kind).toBe('belt')
    expect(serviceCrossing(w, receiver)).toBe(true)
  })

  it('reserves depot room for queued raw coal instead of flooding the shared fuel return', () => {
    const { w, source, end } = miningWorld('coal'), h = w.homestead!
    h.infrastructure.links.push({ kind: 'stampFeed', source: end, target: 15 * SIZE + 24, parts: [] })
    const miner = w.buildings[source], queued = w.buildings[source + 2], depot = w.buildings[end]
    if (miner?.kind !== 'miner' || queued?.kind !== 'belt' || depot?.kind !== 'fuelDepot') throw new Error('coal route')
    miner.item = 'coal'; queued.item = 'coal'; queued.progress = 1
    depot.inventory.coal = 11
    outputMachines(w, new Set())
    expect(miner.item).toBe('coal')
    expect(w.buildings[source + 1]).toMatchObject({ item: null })
    depot.inventory.coal = 10
    outputMachines(w, new Set())
    expect(miner.item).toBeNull()
    expect(w.buildings[source + 1]).toMatchObject({ item: 'coal' })
    expect(queued.item).toBe('coal')
    const first = w.buildings[source + 1]
    if (first?.kind !== 'belt') throw new Error('inlet')
    first.item = null
    w.tiles[source + SIZE] = 'coal'
    expect(placeBuilding(w, 26, 19, 'miner', 'east')).toBe(true)
    expect(placeBuilding(w, 27, 19, 'belt', 'north')).toBe(true)
    const replacement = w.buildings[source + SIZE]
    if (replacement?.kind !== 'miner') throw new Error('replacement')
    h.expansion.coalMiner = source + SIZE
    w.deposits!.retiring.push(source)
    miner.item = 'coal'; replacement.item = 'coal'
    outputMachines(w, new Set())
    expect(miner.item).toBe('coal')
    expect(replacement.item).toBe('coal')
    depot.inventory.coal = 9
    outputMachines(w, new Set())
    expect(miner.item).toBeNull()
    expect(replacement.item).toBeNull()
  })

  it('round trips reserves and paid replacement work with deterministic continuation', () => {
    const { w } = miningWorld('iron')
    chooseMineReplacement(w)
    for (let n = 0; n < 100; n++) advancePetesWorld(w, 50)
    const loaded = decodeSave(encodeSave(w, view, stamp)).world
    expect(snapshot(loaded)).toEqual(snapshot(w))
    for (let n = 0; n < 200; n++) { advancePetesWorld(w, 50); advancePetesWorld(loaded, 50) }
    expect(snapshot(loaded)).toEqual(snapshot(w))
  })

  it('migrates old Pete terrain without changing stock and rejects corrupt quantities transactionally', () => {
    const w = createPetesWorld()
    placeIron(w, 26, 18)
    const old = snapshot(w); old.version = 55; delete old.game.deposits
    const loaded = decodeSave(JSON.stringify(old)).world
    expect(loaded.tiles).toEqual(w.tiles)
    expect(loaded.mined).toEqual(w.mined)
    expect(oreRemaining(loaded, 18 * SIZE + 26)).toBe(DEPOSIT_CAPACITY)
    const before = snapshot(w)
    for (const quantity of [-1, 0, 1.5, DEPOSIT_CAPACITY + 1]) {
      const bad = snapshot(w); bad.game.deposits.remaining[18 * SIZE + 26] = quantity
      expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    }
    expect(snapshot(w)).toEqual(before)
  })

  it('rejects forged reuse and retirement ownership and older schemas reject finite state', () => {
    const { w, source } = miningWorld('iron')
    chooseMineReplacement(w)
    const badReuse = snapshot(w)
    badReuse.game.homestead.expansion.plan.reuse.push(badReuse.game.homestead.expansion.plan.anchor)
    expect(() => decodeSave(JSON.stringify(badReuse))).toThrow('Invalid save')
    const badRetirement = snapshot(w)
    badRetirement.game.deposits.retiring = [source]
    expect(() => decodeSave(JSON.stringify(badRetirement))).toThrow('Invalid save')
    const old = snapshot(w); old.version = 55
    expect(() => decodeSave(JSON.stringify(old))).toThrow('unknown field')
    const missing = snapshot(w); delete missing.game.deposits
    expect(() => decodeSave(JSON.stringify(missing))).toThrow('requires finite reserves')
  })

  it('does not alter a deposit for invalid extraction requests', () => {
    const w = createPetesWorld()
    placeIron(w, 26, 18)
    const before = snapshot(w)
    for (const requested of [-1, 0, 1.5, NaN, Infinity]) expect(extractOre(w, 18 * SIZE + 26, 'iron', requested)).toBe(0)
    expect(snapshot(w)).toEqual(before)
  })
})
