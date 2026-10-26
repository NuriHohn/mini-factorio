import { beforeAll, expect, it } from 'vitest'
import { createPetesWorld, placeGrove } from './petesWorld'
import { advanceWorld } from './step'
import { advanceHomestead, freeSite, materialStore } from './homestead'
import { neighboringTiles, peteReachableTiles } from './navigation'
import { planPlanting } from './ecoProjects'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { enclosedYard } from './yard'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-10-26T12:00:00.000Z'
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, stamp))
let farm: World
beforeAll(() => {
  farm = createPetesWorld()
  for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(farm, x, y)).toBeNull()
  for (let t = 0; t < 1200000 && !(farm.gardenProject?.phase === 'complete' && farm.coopProject?.phase === 'complete' && farm.campfireProject?.phase === 'complete'); t += 50) advanceWorld(farm, 50)
  expect(farm.gardenProject?.phase).toBe('complete')
  expect(farm.coopProject?.phase).toBe('complete')
  expect(farm.campfireProject?.phase).toBe('complete')
}, 60000)

let longGame: World, collected = 0, sleeping = false, plantReady = -1
const sleepStarts: number[] = [], plantFinishes: number[] = []
beforeAll(() => { longGame = structuredClone(farm); collected = longGame.poultry!.collected })
// Independent real-time preparation phases keep the hour-long regression within
// the existing per-hook CI allowance; no simulation steps or assertions are skipped.
for (let phase = 0; phase < 6; phase++) beforeAll(() => {
  for (let t = 0; t < 600000; t += 50) {
    advanceWorld(longGame, 50)
    const rests = ['resting', 'verandaRest'].includes(longGame.peace.activity)
    if (rests && !sleeping) sleepStarts.push(longGame.timeMs)
    sleeping = rests
    if (longGame.plantProject?.phase === 'complete' && longGame.plantProject.readyAtMs !== plantReady) { plantReady = longGame.plantProject.readyAtMs!; plantFinishes.push(longGame.timeMs) }
  }
}, 60000)

it('keeps sleeping, collecting eggs, replanting and completing the enclosure in an hour-long real game', () => {
  const w = structuredClone(longGame)
  const report = JSON.stringify({ time: w.timeMs, sleepStarts, plantFinishes, eggs: w.poultry?.collected, h: w.homestead, yard: w.yard, project: w.harvestProject, stock: materialStore(w), activity: w.peace.activity })
  expect(sleepStarts.length, report).toBeGreaterThanOrEqual(3)
  expect(sleepStarts.at(-1)!, report).toBeGreaterThan(farm.timeMs + 3000000)
  expect(w.poultry!.collected - collected, report).toBeGreaterThanOrEqual(3)
  expect(plantFinishes.length, report).toBeGreaterThanOrEqual(2)
  expect(w.poultry!.eaten, report).toBeGreaterThan(0)
  expect(w.feedingProject?.completedCycles ?? 0, report).toBeGreaterThan(0)
  expect(enclosedYard(w), report).not.toBeNull()
  const loaded = decodeSave(encodeSave(w, view, stamp)).world
  advanceWorld(w, 1000); advanceWorld(loaded, 1000)
  expect(snapshot(loaded)).toEqual(snapshot(w))
})

it('never starts a new supply task during a normal tick on the way home', () => {
  const w = structuredClone(farm), h = w.homestead!
  h.task = null; h.nextAtMs = 0
  w.peace.activity = 'homeward'; w.peace.destination = null
  const before = structuredClone(w)
  expect(advanceHomestead(w, 50)).toBe(false)
  expect(w).toEqual(before)
})

it('allows nearby replanting outside the immediate machine approach while preserving Factory clearance', () => {
  const w = createPetesWorld()
  expect(placeBuilding(w, 24, 18, 'storage', 'east')).toBe(true)
  const plan = planPlanting(w)
  expect(plan).not.toBeNull()
  const dx = Math.abs(plan!.tiles[0] % 40 - 20), dy = Math.abs(Math.floor(plan!.tiles[0] / 40) - 20)
  expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(4)
  expect(Math.max(dx, dy)).toBeLessThanOrEqual(6)
  const factory = createBareWorld(() => .5)
  factory.nature.wood = 20; placeBuilding(factory, 20, 20, 'treehouse', 'east')
  for (let y = 14; y <= 26; y += 3) for (let x = 14; x <= 26; x += 3) placeBuilding(factory, x, y, 'storage', 'east')
  expect(planPlanting(factory)).toBeNull()
})

it('migrates a real version-42 rest deadline without altering its stock or paid work', () => {
  const w = structuredClone(farm), old = snapshot(w)
  old.version = 42; for (const key of ['copperMiner', 'circuitAssembler', 'steamEngine', 'coalMiner', 'fuelStore', 'coalInserter', 'briquetteAssembler', 'steamWorkshop', 'steamHoist']) delete old.game.homestead.expansion[key]; delete old.game.homestead.nextRestAtMs
  const loaded = decodeSave(JSON.stringify(old)).world
  expect(loaded.homestead!.nextRestAtMs).toBe(w.timeMs + 180000)
  expect(loaded.homestead!.carried).toEqual(w.homestead!.carried)
  expect(materialStore(loaded)).toEqual(materialStore(w))
  const malformed = snapshot(w); malformed.game.homestead.nextRestAtMs = w.timeMs + 180050
  expect(() => decodeSave(JSON.stringify(malformed))).toThrow()
})

it('rejects a machine footprint that traps Pete and repairs an already trapped idle version-42 save', () => {
  const w = createPetesWorld()
  placeBuilding(w, 17, 17, 'furnace', 'east')
  placeBuilding(w, 18, 16, 'storage', 'east')
  placeBuilding(w, 19, 17, 'storage', 'east')
  Object.assign(w.pete, { tile: 698, x: 18, y: 17, next: null, travelMs: 0, path: [], pathRevision: -1 })
  expect(freeSite(w, [738])).toBe(false)
  placeBuilding(w, 18, 18, 'storage', 'east')
  expect(peteReachableTiles(w, w.pete.tile).size).toBe(1)
  const old = snapshot(w); old.version = 42; for (const key of ['copperMiner', 'circuitAssembler', 'steamEngine', 'coalMiner', 'fuelStore', 'coalInserter', 'briquetteAssembler', 'steamWorkshop', 'steamHoist']) delete old.game.homestead.expansion[key]; delete old.game.homestead.nextRestAtMs
  const loaded = decodeSave(JSON.stringify(old)).world
  expect(loaded.pete.tile).not.toBe(w.pete.tile)
  expect(neighboringTiles(loaded.peace.home!).some(tile => peteReachableTiles(loaded, loaded.pete.tile).has(tile))).toBe(true)
  expect(loaded.buildings).toEqual(w.buildings)
  expect(loaded.personality).toEqual(w.personality)
})
