import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave, SAVE_VERSION } from './saveGame'
import { paintWater } from '../simulation/waterLandscaping'
import { poweredWorld, createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { commitConstruction } from '../simulation/construction'
import { shorelineCorners, terrainRevision } from '../simulation/waterTerrain'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const p = (x: number, y: number) => ({ x, y })
const stamp = '2026-10-21T00:00:00.000Z'
describe('edited water in existing save version 9', () => {
  it('restores edited/removed terrain, packet and productive gameplay exactly without serializing caches', () => {
    const w = poweredWorld(() => .5); w.nature.wood = 30
    placeBuilding(w, 20, 20, 'miner', 'east'); placeBuilding(w, 21, 20, 'furnace', 'east')
    advanceWorld(w, 575)
    paintWater(w, p(5, 5), p(8, 8), 'water', 3); paintWater(w, p(5, 5), p(5, 5), 'land', 1)
    paintWater(w, p(10, 10), p(12, 10), 'water', 1)
    commitConstruction(w, p(8, 10), p(14, 10), 'belt', 'east')
    const belt = w.buildings[411]!
    if (belt.kind !== 'belt') throw Error('fixture')
    belt.item = 'copper'; belt.progress = .4
    const text = encodeSave(w, view, stamp), loaded = decodeSave(text).world
    expect(SAVE_VERSION).toBe(22); expect(text).not.toContain('terrainRevision'); expect(terrainRevision(loaded)).toBe(0)
    expect(JSON.parse(encodeSave(loaded, view, stamp))).toEqual(JSON.parse(text))
    expect(loaded.water[205]).toBe(false)
    expect(shorelineCorners(loaded, 6, 6)).toEqual(shorelineCorners(w, 6, 6))
    advanceWorld(w, 4321); advanceWorld(loaded, 4321)
    expect(JSON.parse(encodeSave(loaded, view, stamp))).toEqual(JSON.parse(encodeSave(w, view, stamp)))
  })
  it('keeps pre-water version-8 saves dry, editable and otherwise unchanged', () => {
    const w = poweredWorld(() => .5); placeBuilding(w, 20, 20, 'miner', 'east'); advanceWorld(w, 575)
    const document = JSON.parse(encodeSave(w, view, stamp)); document.version = 8; delete document.game.personality; delete document.game.water
    const loaded = decodeSave(JSON.stringify(document)).world
    expect(loaded.water.every(v => !v)).toBe(true)
    expect(JSON.parse(encodeSave(loaded, view, stamp))).toEqual(JSON.parse(encodeSave(w, view, stamp)))
    expect(paintWater(loaded, p(4, 4), p(4, 4), 'water', 1)).toBe(1)
    expect(decodeSave(encodeSave(loaded, view, stamp)).world.water[164]).toBe(true)
  })
  it('continues loading Sprint 15.0/15.1 mask-only saves and retains strict bridge validation', () => {
    const w = createBareWorld(() => .5); w.water[205] = true
    const text = encodeSave(w, view, stamp)
    expect(decodeSave(text).world.water[205]).toBe(true)
    const malformed = JSON.parse(text); malformed.game.water[205] = 'water'
    expect(() => decodeSave(JSON.stringify(malformed))).toThrow()
    malformed.game.water[205] = true; malformed.game.terrainRevision = 1
    expect(() => decodeSave(JSON.stringify(malformed))).toThrow()
  })
})
