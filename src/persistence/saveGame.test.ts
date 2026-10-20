import { describe, expect, it } from 'vitest'
import { createWorld, placeBuilding, removeBuilding, SIZE } from '../simulation/world'
import type { Assembler, Belt, Furnace, Inserter, Splitter, Storage, World } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { poweredWorld } from '../simulation/testFixtures'
import { clickPete } from '../simulation/pete'
import { releasePete } from '../simulation/police'
import { decodeSave, encodeSave, MAX_SAVE_BYTES } from './saveGame'
import type { SaveDocument } from './saveGame'

export const view = { scrollX: 123, scrollY: 456, zoom: 1.25, direction: 'west' as const, powerOverlay: true }
export const date = '2026-10-20T12:00:00.000Z'
const snapshot = (world: World): SaveDocument => JSON.parse(encodeSave(world, view, date))
const restored = (world: World) => decodeSave(JSON.stringify(snapshot(world))).world
const document = () => snapshot(createWorld(() => .5))
function line() {
  const world = poweredWorld(() => .5)
  for (const [x, y, kind, direction] of [[20, 20, 'miner', 'east'], [21, 20, 'belt', 'east'], [22, 20, 'furnace', 'south'], [22, 21, 'splitter', 'south'], [22, 22, 'belt', 'east'], [23, 22, 'storage', 'east']] as const) expect(placeBuilding(world, x, y, kind, direction)).toBe(true)
  return world
}
function policeWorld() {
  const world = createWorld(() => .5)
  Object.assign(world.pete, { x: 8, y: 8, tile: 328, mode: 'CRYING', cryingMs: 10000, cooldownMs: 12345 })
  placeBuilding(world, 9, 8, 'radar', 'east'); placeBuilding(world, 9, 7, 'powerPole', 'east'); placeBuilding(world, 9, 6, 'generator', 'east')
  return world
}
describe('versioned offline snapshots', () => {
  it('round trips terrain, view, counters, clock, random state, and detached inventories', () => {
    const world = line(); advanceWorld(world, 3475.5)
    const encoded = snapshot(world), loaded = decodeSave(JSON.stringify(encoded))
    expect(snapshot(loaded.world)).toEqual(encoded)
    expect(loaded.view).toEqual(view); expect(loaded.savedAt).toBe(date)
    expect(loaded.world).not.toBe(world)
    expect(loaded.world.buildings[820]).not.toBe(world.buildings[820])
    expect(loaded.world.power).not.toBeNull()
    expect(loaded.world.police.radars).toEqual([])
    expect(loaded.world.remainder).toBe(25.5)
  })
  it.each([50, 725, 2025, 6375, 11999])('continues identically across a save at %i ms', ms => {
    const world = line(); advanceWorld(world, ms)
    const loaded = restored(world)
    for (const delta of [17, 83, 500, 2399, 1, 11000]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(snapshot(loaded)).toEqual(snapshot(world))
    }
  })
  it('preserves partial jobs, committed inputs, reservations and outage progress', () => {
    const world = line(); advanceWorld(world, 2350)
    const furnace = world.buildings[822] as Furnace
    expect(furnace.job).not.toBeNull()
    removeBuilding(world, 21, 18)
    const loaded = restored(world), job = structuredClone(furnace.job)
    advanceWorld(loaded, 2000)
    expect((loaded.buildings[822] as Furnace).job).toEqual(job)
    advanceWorld(world, 2000)
    placeBuilding(world, 21, 18, 'generator', 'east'); placeBuilding(loaded, 21, 18, 'generator', 'east')
    advanceWorld(world, 5000); advanceWorld(loaded, 5000)
    expect(snapshot(loaded)).toEqual(snapshot(world))
  })
  it('preserves all transport packets, carried items, stock and a legacy assembler detection wait', () => {
    const world = createWorld(() => .5)
    for (const [x, kind] of [[1, 'belt'], [2, 'splitter'], [3, 'storage'], [4, 'inserter'], [5, 'assembler']] as const) placeBuilding(world, x, 1, kind, 'east')
    Object.assign(world.buildings[41] as Belt, { item: 'copperPlate', progress: .6 })
    Object.assign(world.buildings[42] as Splitter, { input: { item: 'iron', progress: .4 }, outputs: [{ item: 'ironPlate', progress: .8 }, { item: 'copperCable', progress: 1 }], delivered: [12, 13], nextOutput: 1 })
    ;(world.buildings[43] as Storage).inventory.electronicCircuit = 21
    Object.assign(world.buildings[44] as Inserter, { phase: 'carrying', item: 'ironGear', elapsedMs: 350 })
    const assembler = world.buildings[45] as Assembler
    assembler.recipeMode = 'auto'
    assembler.input.ironPlate = 2; assembler.input.copperPlate = 1; assembler.autoWaitElapsedMs = 950
    expect(snapshot(restored(world))).toEqual(snapshot(world))
  })
  it('preserves fleeing movement, web timer and RNG without restarting them', () => {
    const world = createWorld(() => .5); advanceWorld(world, 350)
    clickPete(world, world.pete); advanceWorld(world, 150)
    expect(world.pete.mode).toBe('FLEEING')
    const loaded = restored(world)
    for (let i = 0; i < 300; i++) { advanceWorld(world, 50); advanceWorld(loaded, 50) }
    expect(snapshot(loaded)).toEqual(snapshot(world))
  })
  it('rebuilds projectile identity, preserves sabotage duration and safely omits already deleted targets', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 18, 23, 'furnace', 'east')
    world.pete.pumpkin = { from: { x: 17, y: 23 }, target: world.buildings[938]!, index: 938, elapsedMs: 150 }
    const loaded = restored(world)
    expect(loaded.pete.pumpkin!.target).toBe(loaded.buildings[938])
    advanceWorld(world, 250); advanceWorld(loaded, 250)
    expect(snapshot(loaded)).toEqual(snapshot(world))
    expect(loaded.buildings[938]!.sabotageUntilMs).toBe(10250)
    world.pete.pumpkin = { from: { x: 17, y: 23 }, target: world.buildings[938]!, index: 938, elapsedMs: 150 }
    removeBuilding(world, 18, 23)
    expect(restored(world).pete.pumpkin).toBeNull()
    expect(world.pete.pumpkin).not.toBeNull()
  })
  it('conserves material across repeated loads and subsequent smelting/transport', () => {
    let world = line()
    for (let n = 0; n < 12; n++) {
      advanceWorld(world, 725)
      let iron = 0
      for (const b of world.buildings) {
        if (!b) continue
        if (b.kind === 'miner' || b.kind === 'belt' || b.kind === 'inserter') iron += Number(b.item === 'iron' || b.item === 'ironPlate')
        if (b.kind === 'storage') iron += b.inventory.iron + b.inventory.ironPlate
        if (b.kind === 'furnace') iron += b.input.iron + b.output.ironPlate + (b.job?.inputs.iron ?? 0)
        if (b.kind === 'splitter') iron += [b.input, ...b.outputs].filter(p => p && (p.item === 'iron' || p.item === 'ironPlate')).length
      }
      expect(iron).toBe(world.mined.iron)
      const before = snapshot(world)
      world = restored(world)
      expect(snapshot(world)).toEqual(before)
    }
  })
  it('preserves locked Auto assemblers with previously buffered unrelated ingredients', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 4, 4, 'assembler', 'east')
    const machine = world.buildings[164] as Assembler
    Object.assign(machine, { recipeMode: 'auto', recipeId: 'ironGear', recipeLocked: true })
    machine.input.ironPlate = 2; machine.input.copperPlate = 1; machine.input.copperCable = 3
    const loaded = restored(world)
    expect(loaded.buildings[164]).toEqual(machine)
    advanceWorld(world, 2000); advanceWorld(loaded, 2000)
    expect(snapshot(loaded)).toEqual(snapshot(world))
  })
  it('preserves a flee path left behind when Pete is arrested mid-escape', () => {
    const world = policeWorld()
    Object.assign(world.pete, { mode: 'WANDERING', cryingMs: 0 })
    advanceWorld(world, 50)
    clickPete(world, world.pete)
    let captured = false
    for (let n = 0; n < 1000 && !captured; n++) {
      advanceWorld(world, 50)
      if (world.pete.mode === 'ARRESTED') {
        captured = true
        const loaded = restored(world)
        advanceWorld(loaded, 3000); advanceWorld(world, 3000)
        expect(snapshot(loaded)).toEqual(snapshot(world))
      }
    }
    expect(captured).toBe(true)
  })
  it('round trips every police phase with reference identity and identical future behavior', () => {
    const world = policeWorld(), seen = new Set<string>()
    for (let i = 0; i < 600 && world.pete.mode !== 'IMPRISONED'; i++) {
      advanceWorld(world, 50)
      const phase = world.police.car?.phase
      if (!phase || seen.has(phase)) continue
      seen.add(phase)
      const loaded = restored(world)
      expect(loaded.police.car!.prison).toBe(loaded.buildings[loaded.police.car!.prison.y * SIZE + loaded.police.car!.prison.x])
      advanceWorld(loaded, 1000)
      const control = restored(world); advanceWorld(control, 1000)
      expect(snapshot(loaded)).toEqual(snapshot(control))
    }
    expect([...seen].sort()).toEqual(['ARRESTING', 'RESPONDING', 'TRANSPORTING'])
    expect(world.pete.mode).toBe('IMPRISONED')
    const loaded = restored(world), at = world.pete.imprisonedAtMs!
    advanceWorld(loaded, at + 59950 - loaded.timeMs)
    expect(loaded.pete.mode).toBe('IMPRISONED')
    const almost = restored(loaded); advanceWorld(almost, 50)
    expect(almost.pete.mode).toBe('WANDERING'); expect(almost.pete.jailbreak).not.toBeNull()
    expect(snapshot(restored(almost))).toEqual(snapshot(almost))
    expect(releasePete(loaded, loaded.pete.prison!.y * SIZE + loaded.pete.prison!.x, loaded.pete.imprisonedAtMs!)).toBe(true)
    expect(snapshot(restored(loaded))).toEqual(snapshot(loaded))
  })
})
describe('strict detached validation', () => {
  const bad: [string, (data: SaveDocument) => void][] = [
    ['future version', d => { Object.assign(d, { version: 99 }) }],
    ['wrong dimensions', d => { d.map.width = 2 }],
    ['unknown field', d => { Object.assign(d.game, { surprise: true }) }],
    ['missing field', d => { Reflect.deleteProperty(d.game, 'produced') }],
    ['unknown item', d => { Object.assign(d.game.mined, { uranium: 1 }) }],
    ['negative inventory', d => { d.game.mined.iron = -1 }],
    ['fractional inventory', d => { d.game.mined.iron = .5 }],
    ['invalid time', d => { d.game.timeMs = 1 }],
    ['invalid remainder', d => { d.game.remainder = 50 }],
    ['bad terrain', d => { Object.assign(d.game.tiles, { 0: 'water' }) }],
    ['missing buildings', d => { d.game.buildings.pop() }],
    ['bad actor reference', d => { d.game.pete.prison = 12 }],
    ['bad mode', d => { Object.assign(d.game.pete, { mode: 'DANCING' }) }],
    ['teleporting actor', d => { d.game.pete.x += 1 }],
    ['teleporting path', d => { d.game.pete.path = [1200] }],
    ['invalid zoom', d => { d.view.zoom = 99 }],
    ['bad timestamp', d => { d.savedAt = 'tomorrow' }],
  ]
  it.each(bad)('rejects %s without changing the live world', (_name, mutate) => {
    const live = line(), before = snapshot(live), data = document()
    mutate(data)
    expect(() => decodeSave(JSON.stringify(data))).toThrow()
    expect(snapshot(live)).toEqual(before)
  })
  it('rejects corrupt JSON, excessive size and non-game JSON', () => {
    for (const text of ['{', 'null', '[]', '{}', ' '.repeat(MAX_SAVE_BYTES + 1)]) expect(() => decodeSave(text)).toThrow()
  })
  it('rejects incompatible recipes, overflowing buffers, reservations, packets and coordinates', () => {
    const world = line(); advanceWorld(world, 2350)
    const data = snapshot(world)
    const furnace = data.game.buildings[822] as Furnace
    for (const mutate of [(f: Furnace) => { f.input.iron = 3 }, (f: Furnace) => { f.recipeId = 'ironGear' }, (f: Furnace) => { f.job!.outputs.ironPlate = 2 }, (f: Furnace) => { f.output.ironPlate = 2 }, (f: Furnace) => { f.x = 1 }]) {
      const copy = structuredClone(data); mutate(copy.game.buildings[822] as Furnace)
      expect(() => decodeSave(JSON.stringify(copy))).toThrow()
    }
    expect(furnace.job).not.toBeNull()
  })
})
