import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { planConnection, advanceInfrastructure, connectionComplete } from './infrastructure'
import { laterPickup } from './productionLogistics'
import { begin, materialStore } from './homestead'
import { emptyInventory } from './items'
import { refreshNatureSchedule } from './nature'
import { placeBuilding } from './world'
import { advanceTransport, outputMachines } from './transport'
import { advanceInserters, createInserterFrame } from './inserters'
import { advanceCrafting, changeCraftingRecipe } from './crafting'
import { allocatePower } from './power'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { Connection } from './infrastructureRules'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => encodeSave(w, view, '2026-11-06T00:00:00.000Z')
function setup() {
  const w = createPetesWorld(), h = w.homestead!
  for (let t = 0; t < w.buildings.length; t++) if (t !== w.peace.home) w.buildings[t] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  h.store = 900
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  expect(placeBuilding(w, 24, 20, 'assembler', 'east')).toBe(true); h.expansion.circuitAssembler = 824
  changeCraftingRecipe(w, 24, 20, 'peteCircuit')
  // The assembler needs its ordinary power coverage as well as powered pickup arms.
  expect(placeBuilding(w, 26, 21, 'powerPole', 'east')).toBe(true)
  expect(placeBuilding(w, 26, 22, 'generator', 'east')).toBe(true)
  expect(placeBuilding(w, 14, 24, 'assembler', 'east')).toBe(true); h.expansion.cableAssembler = 974
  changeCraftingRecipe(w, 14, 24, 'copperCable')
  expect(placeBuilding(w, 14, 23, 'powerPole', 'east')).toBe(true)
  expect(placeBuilding(w, 15, 23, 'generator', 'east')).toBe(true)
  materialStore(w)!.inventory.copperPlate = 80
  materialStore(w)!.inventory.copperCable = 30
  return w
}
function build(w: World, kind: 'circuitFeed' | 'circuitCableFeed' | 'circuitReturn' | 'cableReturn' | 'cableFeed'): Connection {
  if (kind === 'circuitCableFeed' && !w.homestead!.infrastructure.links.some(p => p.kind === 'cableReturn')) build(w, 'cableReturn')
  const h = w.homestead!, plan = planConnection(w, kind)
  expect(plan, kind).not.toBeNull(); h.infrastructure.plan = plan
  begin(w, 'buildConnection', h.store)
  for (let t = 0; t < 240000 && h.task; t += 50) { w.timeMs += 50; advanceInfrastructure(w, 50) }
  expect(h.task).toBeNull(); expect(connectionComplete(w, plan!)).toBe(true)
  return plan!
}
function step(w: World, ms: number) {
  for (let t = 0; t < ms; t += 50) {
    w.timeMs += 50
    const frame = createInserterFrame(w), vacated = advanceTransport(w, 50)
    outputMachines(w, vacated); allocatePower(w, frame); advanceInserters(w, 50, frame); advanceCrafting(w, 50)
  }
}
describe('separate circuit ingredient conveyors', () => {
  it('uses a direct powered handoff when a return belt is two tiles from the assembler', () => {
    const w = setup(), h = w.homestead!
    expect(placeBuilding(w, 22, 22, 'assembler', 'east')).toBe(true); h.expansion.cableAssembler = 902
    changeCraftingRecipe(w, 22, 22, 'copperCable')
    const parts: Connection['parts'] = [
      { tile: 905, kind: 'powerPole', direction: 'east' }, { tile: 945, kind: 'generator', direction: 'east' },
      { tile: 903, kind: 'inserter', direction: 'east' },
      ...[904, 944, 943, 942, 941, 940].map((tile, i) => ({ tile, kind: 'belt' as const, direction: (i === 0 ? 'south' : i === 5 ? 'north' : 'west') as 'south' | 'north' | 'west' })),
    ]
    if (!w.research.unlocked.includes('logistics1')) w.research.unlocked.push('logistics1')
    for (const p of parts) expect(placeBuilding(w, p.tile % 40, Math.floor(p.tile / 40), p.kind, p.direction)).toBe(true)
    h.infrastructure.links.push({ kind: 'cableReturn', source: 902, target: 900, parts })
    const lane = build(w, 'circuitCableFeed')
    expect(lane.source).toBe(904); expect(lane.parts).toHaveLength(3)
    const source = w.buildings[904]
    if (source?.kind !== 'belt') throw new Error('missing source belt')
    source.item = 'copperCable'; source.progress = .2
    step(w, 600)
    const target = w.buildings[824]
    expect(target?.kind === 'assembler' ? target.input.copperCable : 0).toBe(1)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('rejects receiver cycles while preserving valid shared return junctions', () => {
    const w = setup(), h = w.homestead!, store = materialStore(w)!
    w.buildings[900] = null; h.store = 454; w.buildings[454] = { ...store, x: 14, y: 11 }
    expect(placeBuilding(w, 10, 10, 'furnace', 'east')).toBe(true); h.expansion.copperFurnace = 410
    expect(placeBuilding(w, 10, 12, 'assembler', 'east')).toBe(true); h.expansion.cableAssembler = 490
    changeCraftingRecipe(w, 10, 12, 'copperCable')
    h.infrastructure.links = [
      { kind: 'copper', source: 410, target: 454, receiver: 492, parts: [
        { tile: 409, kind: 'powerPole', direction: 'east' }, { tile: 369, kind: 'generator', direction: 'east' },
        { tile: 411, kind: 'inserter', direction: 'east' }, { tile: 412, kind: 'belt', direction: 'south' }, { tile: 452, kind: 'belt', direction: 'south' },
      ] },
      { kind: 'cableReturn', source: 490, target: 454, parts: [
        { tile: 489, kind: 'powerPole', direction: 'east' }, { tile: 529, kind: 'generator', direction: 'east' },
        { tile: 491, kind: 'inserter', direction: 'east' }, { tile: 492, kind: 'belt', direction: 'east' }, { tile: 493, kind: 'belt', direction: 'north' }, { tile: 453, kind: 'belt', direction: 'east' },
      ] },
    ]
    const payload = JSON.parse(save(w))
    payload.game.homestead.infrastructure.links[1].receiver = 452
    payload.game.homestead.infrastructure.links[1].parts.at(-1).direction = 'west'
    expect(() => decodeSave(JSON.stringify(payload))).toThrow('Invalid save')
  })
  it('keeps the mixed feeder active until the paid cable lane is complete', () => {
    const w = setup(); build(w, 'circuitFeed')
    expect(laterPickup(w, 'circuitFeed', 'copperCable')).toBe(true)
    const old = JSON.parse(save(w)); old.version = 59
    expect(decodeSave(JSON.stringify(old)).world.homestead).toEqual(w.homestead)
    const cost = materialStore(w)!.inventory.copperPlate
    const lane = build(w, 'circuitCableFeed')
    expect(materialStore(w)!.inventory.copperPlate).toBe(cost - 16)
    expect(laterPickup(w, 'circuitFeed', 'copperCable')).toBe(false)
    expect(laterPickup(w, 'circuitCableFeed', 'copperPlate')).toBe(false)
    expect(laterPickup(w, 'circuitCableFeed', 'copperCable')).toBe(true)
    const first = w.homestead!.infrastructure.links[0]
    expect(lane.parts.at(-1)!.tile).not.toBe(first.parts.at(-1)!.tile)
    expect(() => decodeSave(save(w))).not.toThrow()
    const legacy = JSON.parse(save(w)); legacy.version = 59
    expect(() => decodeSave(JSON.stringify(legacy))).toThrow()
  })
  it('makes real circuits from both lanes, returns products to storage and resumes exactly', () => {
    const w = setup(); build(w, 'circuitFeed'); build(w, 'cableReturn'); build(w, 'circuitReturn'); build(w, 'circuitCableFeed')
    materialStore(w)!.inventory.copperPlate = 40
    const producer = w.buildings[w.homestead!.expansion.cableAssembler!]
    if (producer?.kind !== 'assembler') throw new Error('missing cable producer')
    producer.input.copperPlate = 2
    step(w, 7000)
    const loaded = decodeSave(save(w)).world
    step(w, 45000); step(loaded, 45000)
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    expect(w.produced.electronicCircuit).toBeGreaterThan(0)
    expect(materialStore(w)!.inventory.electronicCircuit).toBeGreaterThan(0)
    expect(w.produced.copperCable).toBeGreaterThan(0)
    expect(w.mined.copper).toBe(0)
    const machine = w.buildings[w.homestead!.expansion.circuitAssembler!]
    if (machine?.kind !== 'assembler') throw new Error('missing assembler')
    for (const item of ['copperPlate', 'copperCable'] as const) {
      const packets = w.buildings.reduce((n, b) => n + Number((b?.kind === 'belt' || b?.kind === 'inserter') && b.item === item), 0)
      expect(materialStore(w)!.inventory[item] + machine.input[item] + (machine.job?.inputs[item] ?? 0) + packets + (item === 'copperCable' ? producer.output.copperCable : producer.input.copperPlate + (producer.job?.inputs.copperPlate ?? 0) + w.produced.copperCable / 2) + w.produced.electronicCircuit * (item === 'copperPlate' ? 1 : 3)).toBe(item === 'copperPlate' ? 42 : 30 + w.produced.copperCable)
    }
  })
  it('retains a paid second lane through save/load before its first part is installed', () => {
    const w = setup(); build(w, 'circuitFeed'); build(w, 'cableReturn')
    allocatePower(w)
    const beforePower = structuredClone(w.power), beforePlan = JSON.parse(save(w))
    const h = w.homestead!, plan = planConnection(w, 'circuitCableFeed')
    expect(w.power).toEqual(beforePower)
    expect(JSON.parse(save(w))).toEqual(beforePlan)
    expect(plan).not.toBeNull(); h.infrastructure.plan = plan
    begin(w, 'buildConnection', h.store)
    for (let t = 0; t < 240000 && !h.carried.copperPlate; t += 50) { w.timeMs += 50; advanceInfrastructure(w, 50) }
    expect(h.carried.copperPlate).toBe(8)
    const loaded = decodeSave(save(w)).world
    for (let t = 0; t < 240000 && h.task; t += 50) { w.timeMs += 50; advanceInfrastructure(w, 50); loaded.timeMs += 50; advanceInfrastructure(loaded, 50) }
    expect(h.task).toBeNull()
    expect(JSON.parse(save(loaded))).toEqual(JSON.parse(save(w)))
    expect(h.infrastructure.links.some(p => p.kind === 'circuitCableFeed')).toBe(true)
  })
  it('pauses both ingredient arms at the real finished-product quota', () => {
    const w = setup(); build(w, 'circuitFeed'); build(w, 'circuitCableFeed')
    materialStore(w)!.inventory.electronicCircuit = 12
    expect(laterPickup(w, 'circuitFeed', 'copperPlate')).toBe(false)
    expect(laterPickup(w, 'circuitCableFeed', 'copperCable')).toBe(false)
    materialStore(w)!.inventory.electronicCircuit -= 2
    expect(laterPickup(w, 'circuitFeed', 'copperPlate')).toBe(true)
    expect(laterPickup(w, 'circuitCableFeed', 'copperCable')).toBe(true)
  })
  it('does not pick a replacement packet that arrived after the step snapshot', () => {
    const w = setup(); build(w, 'circuitFeed'); const lane = build(w, 'circuitCableFeed')
    const source = w.buildings[lane.source], arm = w.buildings[lane.parts[2].tile]
    if (source?.kind !== 'belt' || arm?.kind !== 'inserter') throw new Error('missing cable branch')
    source.item = 'copperCable'; source.progress = 1
    const frame = createInserterFrame(w)
    // Transport may move the old packet onward and admit another cable into its tile.
    source.progress = 0
    allocatePower(w, frame); advanceInserters(w, 50, frame)
    expect(source.item).toBe('copperCable'); expect(arm.item).toBeNull()
    const next = createInserterFrame(w)
    allocatePower(w, next); advanceInserters(w, 50, next)
    expect(source.item).toBeNull(); expect(arm.item).toBe('copperCable')
  })
  it('counts the ingredients reserved by a running recipe in both lane budgets', () => {
    const w = setup(); build(w, 'circuitFeed'); build(w, 'circuitCableFeed')
    const machine = w.buildings[w.homestead!.expansion.circuitAssembler!]
    if (machine?.kind !== 'assembler') throw new Error('missing assembler')
    machine.input.copperPlate = 1; machine.input.copperCable = 3
    step(w, 50)
    expect(machine.job?.inputs.copperCable).toBe(3)
    machine.input.copperPlate = 1; machine.input.copperCable = 3
    expect(laterPickup(w, 'circuitFeed', 'copperPlate')).toBe(false)
    expect(laterPickup(w, 'circuitCableFeed', 'copperCable')).toBe(false)
  })
  it('shares the two-batch cable budget with old mixed-lane packets', () => {
    const w = setup(), old = build(w, 'circuitFeed'); build(w, 'circuitCableFeed')
    const queued = old.parts.filter(p => p.kind === 'belt').slice(0, 6)
    for (const part of queued) {
      const b = w.buildings[part.tile]
      if (b?.kind === 'belt') b.item = 'copperCable'
    }
    const at = w.homestead!.expansion.circuitAssembler!, machine = w.buildings[at]
    if (machine?.kind !== 'assembler') throw new Error('missing assembler')
    machine.input.copperCable = 6 - queued.length
    expect(laterPickup(w, 'circuitCableFeed', 'copperCable')).toBe(false)
  })
})
