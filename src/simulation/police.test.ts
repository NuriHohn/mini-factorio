import { createUnlockedWorld } from './testFixtures'
import { describe, expect, it } from 'vitest'
import { arrestVisual } from '../game/arrestVisuals'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { clickPete } from './pete'
import { ARREST_MS, IMPRISONMENT_MS, RADAR_KW, REARREST_GRACE_MS, radarDetects, radarPowered, releasePete } from './police'
import { allocatePower, workingDemand } from './power'
import { inspectBuilding } from './inspection'
import { advanceWorld } from './step'
import { placeBuilding, placementError, removeBuilding, SIZE } from './world'
import type { Prison, World } from './world'

function setup(powered = true) {
  const world = createUnlockedWorld(() => .5)
  Object.assign(world.pete, { x: 8, y: 8, tile: 328, mode: 'CRYING', cryingMs: 100000, cooldownMs: 12345 })
  placeBuilding(world, 9, 8, 'radar', 'east')
  placeBuilding(world, 9, 7, 'powerPole', 'east')
  if (powered) placeBuilding(world, 9, 6, 'generator', 'east')
  allocatePower(world)
  return world
}
function until(world: World, mode: typeof world.pete.mode) {
  for (let n = 0; n < 2000 && world.pete.mode !== mode; n++) advanceWorld(world, 50)
  expect(world.pete.mode).toBe(mode)
}
function prisoner() {
  const world = setup()
  until(world, 'IMPRISONED')
  const prison = world.pete.prison!
  return { world, prison, index: prison.y * SIZE + prison.x, at: world.pete.imprisonedAtMs! }
}
describe('radar detection and shared electricity', () => {
  it('places a 1×1 trap that requests 5 kW and detects the inclusive three-tile radius', () => {
    const world = setup()
    expect(workingDemand(world.buildings[329]!, world)).toBe(RADAR_KW)
    Object.assign(world.pete, { x: 6, y: 8, tile: 326 })
    expect(radarDetects(world, 329)).toBe(true)
    world.pete.x = 5.9999
    expect(radarDetects(world, 329)).toBe(false)
    Object.assign(world.pete, { x: 7, y: 6, tile: 247 })
    expect(radarDetects(world, 329)).toBe(true)
    expect(inspectBuilding(world, 329)).toMatchObject({ kind: 'radar', radius: 3, active: true })
  })
  it('does not dispatch without generation or coverage', () => {
    const world = setup(false)
    advanceWorld(world, 1000)
    expect(world.police.car).toBe(null); expect(world.police.flash).toBe(null)
    placeBuilding(world, 9, 6, 'generator', 'east')
    removeBuilding(world, 9, 7)
    advanceWorld(world, 1000)
    expect(world.police.car).toBe(null)
    placeBuilding(world, 9, 7, 'powerPole', 'east')
    advanceWorld(world, 50)
    expect(world.police.car?.phase).toBe('RESPONDING')
  })
  it('requires the full allocation, preserving proportional supply for production', () => {
    const world = setup()
    for (const [x, y] of [[8, 7], [8, 6], [10, 7], [10, 6]]) {
      world.tiles[y * SIZE + x] = 'iron'
      expect(placeBuilding(world, x, y, 'miner', 'east')).toBe(true)
    }
    allocatePower(world)
    expect(world.power!.consumers[329].suppliedKw).toBeCloseTo(4)
    expect(radarPowered(world, 329)).toBe(false)
    advanceWorld(world, 50); expect(world.police.car).toBe(null)
    placeBuilding(world, 9, 5, 'generator', 'east')
    advanceWorld(world, 50)
    expect(radarPowered(world, 329)).toBe(true)
    expect(world.police.car).not.toBe(null)
  })
  it('chooses the first of competing traps and launches only one operation and flash', () => {
    const world = setup()
    placeBuilding(world, 8, 7, 'radar', 'east')
    advanceWorld(world, 50)
    expect(world.police.flash?.position).toEqual({ x: 8, y: 7 })
    const car = world.police.car
    expect(car).not.toBe(null)
    advanceWorld(world, 50)
    expect(world.police.car).toBe(car)
    expect(world.buildings.filter(b => b?.kind === 'prison')).toHaveLength(1)
    advanceWorld(world, 300); expect(world.police.flash).toBe(null)
  })
  it('does not use the only reachable edge opening as a prison and block police arrival', () => {
    const world = setup()
    for (let i = 0; i < SIZE * SIZE; i++) if ((i < SIZE || i >= SIZE * (SIZE - 1) || i % SIZE === 0 || i % SIZE === SIZE - 1) && i !== 8 * SIZE) placeBuilding(world, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    advanceWorld(world, 50)
    expect(world.police.car).toBe(null)
    expect(world.buildings.some(b => b?.kind === 'prison')).toBe(false)
    expect(world.buildings[8 * SIZE]).toBe(null)
  })
  it('does not spawn a car or prison without a reachable edge and retries after an opening', () => {
    const world = setup()
    for (const [x, y] of [[8, 7], [8, 9], [7, 8]]) placeBuilding(world, x, y, 'storage', 'east')
    advanceWorld(world, 50)
    expect(world.police.car).toBe(null)
    expect(world.buildings.some(b => b?.kind === 'prison')).toBe(false)
    removeBuilding(world, 7, 8)
    advanceWorld(world, 1000)
    expect(world.police.car).not.toBe(null)
  })
})
describe('police pursuit, arrest and visible transport states', () => {
  it('spawns at an edge and navigates around buildings without crossing occupied tiles', () => {
    const world = setup()
    for (let y = 0; y < 15; y++) if (y !== 12) placeBuilding(world, 5, y, 'storage', 'east')
    advanceWorld(world, 50)
    const car = world.police.car!
    expect(car.x === 0 || car.x === SIZE - 1 || car.y === 0 || car.y === SIZE - 1).toBe(true)
    let sawTransport = false, sawArrest = false
    for (let i = 0; i < 1600 && world.pete.mode !== 'IMPRISONED'; i++) {
      advanceWorld(world, 50)
      const moving = world.police.car
      if (moving) {
        expect(world.buildings[moving.tile]).toBe(null)
        if (moving.next !== null) expect(world.buildings[moving.next]).toBe(null)
        expect(moving.x).toBeGreaterThanOrEqual(0); expect(moving.x).toBeLessThan(SIZE)
        expect(moving.y).toBeGreaterThanOrEqual(0); expect(moving.y).toBeLessThan(SIZE)
        sawTransport ||= moving.phase === 'TRANSPORTING'; sawArrest ||= moving.phase === 'ARRESTING'
      }
    }
    expect(sawArrest && sawTransport).toBe(true)
    expect(world.pete.mode).toBe('IMPRISONED'); expect(world.police.car).toBe(null)
  })
  it('pursues a moving, fleeing Pete and updates its route until capture', () => {
    const world = setup()
    Object.assign(world.pete, { mode: 'WANDERING', cryingMs: 0 })
    clickPete(world, world.pete)
    advanceWorld(world, 50)
    const initial = world.police.car!
    expect(initial).not.toBe(null)
    const originalTarget = initial.target
    let retargeted = false
    for (let i = 0; i < 1500 && world.pete.mode !== 'IMPRISONED'; i++) {
      advanceWorld(world, 50)
      if (world.police.car?.target !== originalTarget) retargeted = true
    }
    expect(retargeted).toBe(true)
    expect(world.pete.mode).toBe('IMPRISONED')
    expect(world.pete.cooldownMs).toBe(Math.max(0, 12345 - world.timeMs))
  })
  it('ignores spider-web scares in custody, cancels in-flight sabotage and preserves cooldown', () => {
    const world = setup()
    until(world, 'ARRESTED')
    expect(world.pete.pumpkin).toBe(null)
    let before = structuredClone(world.pete)
    expect(clickPete(world, world.pete)).toBe(true); expect(world.pete).toEqual(before)
    until(world, 'TRANSPORTED')
    before = structuredClone(world.pete)
    expect(clickPete(world, world.pete)).toBe(true); expect(world.pete).toEqual(before)
    until(world, 'IMPRISONED')
    expect(world.pete.cooldownMs).toBe(Math.max(0, 12345 - world.timeMs))
    const imprisoned = structuredClone(world.pete)
    expect(clickPete(world, world.pete)).toBe(true) // Web mode consumes the hit; ordinary selection opens the prison inspector.
    expect(world.pete).toEqual(imprisoned)
    advanceWorld(world, 2000)
    expect(world.pete.x).toBe(imprisoned.x); expect(world.pete.y).toBe(imprisoned.y)
    expect(world.pete.pumpkin).toBe(null)
    expect(world.pete.cooldownMs).toBe(Math.max(0, 12345 - world.timeMs))
  })
  it('cancels a still-flying pumpkin at arrest so custody cannot produce a later sabotage hit', () => {
    const world = setup()
    placeBuilding(world, 7, 8, 'furnace', 'east')
    for (let i = 0; i < 1000; i++) {
      advanceWorld(world, 50)
      const car = world.police.car
      if (car?.phase === 'RESPONDING' && car.next === null && Math.hypot(car.x - world.pete.x, car.y - world.pete.y) <= .8) break
    }
    const target = world.buildings[327]!
    world.pete.pumpkin = { target, index: 327, from: { x: 8, y: 8 }, elapsedMs: 0 }
    until(world, 'ARRESTED')
    expect(world.pete.pumpkin).toBe(null)
    advanceWorld(world, 10000)
    expect(target.sabotageUntilMs).toBeUndefined()
  })
  it('safely releases the passenger if new obstacles disconnect the return route', () => {
    const world = setup()
    until(world, 'TRANSPORTED')
    const prison = world.pete.prison!
    expect(prison).toMatchObject({ x: 0, y: 0, exit: 1 })
    expect(placeBuilding(world, 2, 0, 'storage', 'east')).toBe(true)
    expect(placeBuilding(world, 1, 1, 'storage', 'east')).toBe(true)
    until(world, 'WANDERING')
    expect(world.police.car).toBe(null)
    expect(world.buildings[world.pete.tile]).toBe(null)
    expect(world.pete.graceUntilMs).toBe(world.timeMs + REARREST_GRACE_MS)
  })
  it('continues an already dispatched operation when its trap loses power or is removed', () => {
    const world = setup()
    advanceWorld(world, 50)
    removeBuilding(world, 9, 8); removeBuilding(world, 9, 6)
    until(world, 'IMPRISONED')
  })
  it('replans a route when a future path tile is built on', () => {
    const world = setup()
    advanceWorld(world, 100)
    const car = world.police.car!, future = car.path[2]
    expect(placeBuilding(world, future % SIZE, Math.floor(future / SIZE), 'storage', 'east')).toBe(true)
    until(world, 'IMPRISONED')
  })
})
describe('prison release, escape and lifecycle safety', () => {
  it('releases immediately outside, exactly once, without resetting cooldown or stale re-release', () => {
    const { world, prison, index, at } = prisoner()
    const cooldown = world.pete.cooldownMs
    expect(inspectBuilding(world, index)).toMatchObject({ kind: 'prison', occupied: true, elapsedMs: 0, remainingMs: IMPRISONMENT_MS })
    expect(releasePete(world, index, at)).toBe(true)
    expect(world.pete.mode).toBe('WANDERING')
    expect(world.pete.tile).toBe(prison.exit)
    expect(world.pete.cooldownMs).toBe(cooldown)
    expect(world.pete.graceUntilMs).toBe(world.timeMs + REARREST_GRACE_MS)
    const released = structuredClone(world)
    expect(releasePete(world, index, at)).toBe(false)
    expect(world).toEqual(released)
    expect(inspectBuilding(world, index)).toMatchObject({ kind: 'prison', occupied: false })
  })
  it('escapes at exactly sixty seconds with a bounded jailbreak visual and no sabotage reset', () => {
    const { world, prison, index, at } = prisoner()
    advanceWorld(world, IMPRISONMENT_MS - 50)
    expect(world.pete.mode).toBe('IMPRISONED')
    expect(inspectBuilding(world, index)).toMatchObject({ elapsedMs: 59950, remainingMs: 50 })
    advanceWorld(world, 50)
    expect(world.timeMs).toBe(at + IMPRISONMENT_MS)
    expect(world.pete.mode).toBe('WANDERING'); expect(world.pete.tile).toBe(prison.exit)
    expect(world.pete.cooldownMs).toBe(0)
    expect(world.pete.jailbreak).toMatchObject({ position: { x: prison.x, y: prison.y }, untilMs: world.timeMs + 1200 })
    advanceWorld(world, 1200); expect(world.pete.jailbreak).toBe(null)
  })
  function releaseRadar(world: World, prison: Prison) {
    const x = prison.exit % SIZE, y = Math.floor(prison.exit / SIZE)
    for (const [a, b] of [[x + 1, y], [x, y + 1], [x + 1, y + 1]]) if (!world.buildings[b * SIZE + a]) {
      expect(placeBuilding(world, a, b, 'radar', 'east')).toBe(true); break
    }
    placeBuilding(world, x + 2, y + 1, 'powerPole', 'east')
    placeBuilding(world, x + 2, y + 2, 'generator', 'east')
    allocatePower(world)
  }
  it.each(['manual', 'sentence'] as const)('detects Pete already inside a radar on %s release without waiting for grace or stale retry', method => {
    const { world, prison, index, at } = prisoner()
    releaseRadar(world, prison)
    if (method === 'sentence') advanceWorld(world, IMPRISONMENT_MS - 50)
    world.police.retryAtMs = world.timeMs + 1000
    if (method === 'manual') expect(releasePete(world, index, at)).toBe(true)
    advanceWorld(world, 50)
    expect(world.police.car?.phase).toBe('RESPONDING')
    expect(world.pete.prison).toBe(null)
    expect(world.pete.imprisonedAtMs).toBe(null)
    expect(world.pete.graceUntilMs).toBeGreaterThan(world.timeMs) // Sprinkler grace remains independent.
    expect(world.revenge.arrests).toBe(1)
    const car = world.police.car
    advanceWorld(world, 50)
    expect(world.police.car).toBe(car)
    expect(world.revenge.arrests).toBe(1)
  })
  it('counts repeated release/arrest cycles once and preserves escalating pickup effects', () => {
    const { world, prison, index } = prisoner()
    world.revenge.threshold = 9
    releaseRadar(world, prison)
    for (let completed = 1; completed <= 4; completed++) {
      // Isolate arrest eligibility from a later, legitimate power outage caused by sabotage.
      world.pete.cooldownMs = 30000
      expect(world.revenge.arrests).toBe(completed)
      advanceWorld(world, 500)
      expect(world.police.car).toBe(null)
      expect(world.revenge.arrests).toBe(completed)
      expect(releasePete(world, index, world.pete.imprisonedAtMs!)).toBe(true)
      advanceWorld(world, 50)
      const car = world.police.car
      expect(car?.phase).toBe('RESPONDING')
      until(world, 'ARRESTED')
      expect(world.police.car).toBe(car)
      expect(arrestVisual(world)).toMatchObject({ stage: Math.min(3, completed + 1), phase: 'arrival' })
      advanceWorld(world, ARREST_MS - 50)
      expect(world.police.car).toBe(car)
      expect(world.revenge.arrests).toBe(completed)
      advanceWorld(world, 50)
      expect(world.pete.mode).toBe('TRANSPORTED')
      expect(world.revenge.arrests).toBe(completed + 1)
      until(world, 'IMPRISONED')
      expect(world.police.car).toBe(null)
      expect(world.revenge.arrests).toBe(completed + 1)
    }
  })
  it.each(['before', 'after'] as const)('continues deterministically when saved %s prison release, including existing grace deadlines', point => {
    const { world, prison, index, at } = prisoner()
    releaseRadar(world, prison)
    world.pete.cryingMs = 0
    if (point === 'after') releasePete(world, index, at)
    const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
    const snapshot = (w: World) => encodeSave(w, view, '2026-10-21T00:00:00.000Z')
    const loaded = decodeSave(snapshot(world)).world
    if (point === 'before') for (const w of [world, loaded]) releasePete(w, index, at)
    for (const delta of [50, 100, 650, 1000, 6000]) {
      advanceWorld(world, delta); advanceWorld(loaded, delta)
      expect(JSON.parse(snapshot(loaded))).toEqual(JSON.parse(snapshot(world)))
    }
    expect(world.revenge.arrests).toBe(2)
  })
  it('rejects stale release timestamps and reserves the exit against construction', () => {
    const { world, prison, index, at } = prisoner()
    expect(releasePete(world, index, at + 1)).toBe(false)
    expect(placementError(world, prison.exit % SIZE, Math.floor(prison.exit / SIZE), 'storage')).toContain('exit')
    expect(placeBuilding(world, prison.exit % SIZE, Math.floor(prison.exit / SIZE), 'storage', 'east')).toBe(false)
    expect(world.pete.mode).toBe('IMPRISONED')
  })
  it.each(['ARRESTED', 'TRANSPORTED', 'IMPRISONED'] as const)('safely frees Pete if his prison is removed during %s', mode => {
    const world = setup()
    until(world, mode)
    const prison = world.pete.prison!, cooldown = world.pete.cooldownMs
    removeBuilding(world, prison.x, prison.y)
    expect(world.pete.mode).toBe('WANDERING'); expect(world.pete.prison).toBe(null)
    expect(world.pete.cooldownMs).toBe(cooldown); expect(world.police.car).toBe(null)
    expect(world.buildings[world.pete.tile]).toBe(null)
    expect(releasePete(world, prison.y * SIZE + prison.x, 0)).toBe(false)
  })
  it('cancels safely when the prison disappears during police arrival', () => {
    const world = setup()
    advanceWorld(world, 50)
    const prison = world.police.car!.prison
    removeBuilding(world, prison.x, prison.y)
    expect(world.police.car).toBe(null); expect(world.pete.mode).toBe('CRYING')
  })
  it('keeps entire arrest/transport/imprisonment/escape cycles deterministic across frame partitions', () => {
    const a = setup(), b = structuredClone(a)
    advanceWorld(a, 90000)
    for (let i = 0; i < 90; i++) for (const delta of [17, 33, 150, 800]) advanceWorld(b, delta)
    expect(b).toEqual(a)
    const prison = a.buildings.find(b => b?.kind === 'prison') as Prison
    expect(prison).toBeDefined()
  })
})
