import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { ShoreVegetation, drawShorePlant, plantSway, shorePlants } from './shoreVegetation'
import { createBareWorld } from '../simulation/testFixtures'
import { createWorld, placeBuilding, removeBuilding, SIZE } from '../simulation/world'
import { paintWater } from '../simulation/waterLandscaping'
import { invalidateTerrain } from '../simulation/waterTerrain'
import { commitConstruction } from '../simulation/construction'
import { encodeSave, decodeSave } from '../persistence/saveGame'
import { reachableTiles } from '../simulation/navigation'
const view = { x: 0, y: 0, width: 1280, height: 1280 }
const savedView = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function river() {
  const w = createBareWorld(() => .5)
  for (let y = 0; y < SIZE; y++) for (let x = 5; x <= 7; x++) w.water[y * SIZE + x] = true
  return w
}
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('decorative shoreline vegetation', () => {
  it('forms repeatable irregular clusters on shores, with both species and open edges', () => {
    const w = river(), plants = shorePlants(w), before = structuredClone(w)
    expect(shorePlants(w)).toEqual(plants)
    expect(plants.length).toBeGreaterThan(10); expect(plants.length).toBeLessThan(65)
    expect(plants.some(p => p.cattail)).toBe(true); expect(plants.some(p => !p.cattail)).toBe(true)
    expect(plants.some(p => p.animated)).toBe(true); expect(plants.some(p => !p.animated)).toBe(true)
    const occupied = new Set(plants.map(p => p.tile))
    expect(plants.some(p => occupied.has(p.tile + SIZE))).toBe(true)
    for (const p of plants) { expect(w.water[p.tile]).toBe(true); expect([5, 7]).toContain(p.tile % SIZE) }
    const generated = createWorld(() => .42)
    expect(shorePlants(generated).length).toBeGreaterThan(0)
    expect(w).toEqual(before)
  })
  it('supports single-cell streams, small ponds and map boundaries without decorating deep water', () => {
    const w = createBareWorld(() => .5)
    for (let y = 0; y < SIZE; y++) w.water[y * SIZE] = true
    expect(shorePlants(w).length).toBeGreaterThan(0)
    paintWater(w, { x: 15, y: 6 }, { x: 15, y: 6 }, 'water', 5)
    for (const p of shorePlants(w)) expect(w.water[p.tile]).toBe(true)
    w.water.fill(true); invalidateTerrain(w, [0])
    expect(shorePlants(w)).toEqual([])
  })
  it('refreshes cached edges on water painting, removal and replacement, retaining idle caches', () => {
    const w = river(), cache = new ShoreVegetation(), original = cache.sites(w)
    expect(cache.sites(w)).toBe(original)
    const p = original[0], x = p.tile % SIZE, y = Math.floor(p.tile / SIZE)
    paintWater(w, { x, y }, { x, y }, 'land', 1)
    expect(cache.sites(w)).not.toBe(original); expect(cache.sites(w).some(s => s.tile === p.tile)).toBe(false)
    paintWater(w, { x, y }, { x, y }, 'water', 1)
    expect(cache.sites(w)).toEqual(original)
    const empty = createBareWorld(() => .5)
    expect(cache.sites(empty)).toEqual([])
  })
  it.each(['footbridge', 'belt'] as const)('clears plants around %s crossings and restores after demolition', kind => {
    const w = river(), cache = new ShoreVegetation(), original = cache.sites(w)
    const p = original.find(p => p.tile / SIZE >= 2 && p.tile / SIZE < 38)!, y = Math.floor(p.tile / SIZE)
    w.nature.wood = 100
    expect(commitConstruction(w, { x: 4, y }, { x: 8, y }, kind, 'east', true).error).toBeNull()
    expect(cache.sites(w).some(p => Math.abs(Math.floor(p.tile / SIZE) - y) <= 1)).toBe(false)
    expect(removeBuilding(w, 6, y)).toBe(true)
    if (kind === 'belt') { removeBuilding(w, 4, y); removeBuilding(w, 8, y) }
    expect(cache.sites(w)).toEqual(original)
  })
  it('suppresses neighboring structures and has no construction, navigation or save state', () => {
    const w = river(), cache = new ShoreVegetation(), p = cache.sites(w)[0], x = p.tile % SIZE, y = Math.floor(p.tile / SIZE), bank = x === 5 ? 4 : 8
    const paths = reachableTiles(w, 0), before = encodeSave(w, savedView, '2026-10-22T00:00:00.000Z')
    const { g } = graphics(); cache.draw(g, w, view, 32)
    expect(encodeSave(w, savedView, '2026-10-22T00:00:00.000Z')).toBe(before); expect(reachableTiles(w, 0)).toEqual(paths)
    expect(placeBuilding(w, bank, y, 'storage', 'east')).toBe(true)
    expect(cache.sites(w).some(s => s.tile === p.tile)).toBe(false)
    expect(removeBuilding(w, bank, y)).toBe(true)
    expect(cache.sites(w).some(s => s.tile === p.tile)).toBe(true)
    expect(shorePlants(decodeSave(encodeSave(w, savedView, '2026-10-22T00:00:00.000Z')).world)).toEqual(cache.sites(w))
  })
  it('draws only visible plants without mutation, with subtle pause-safe simulation-time sway', () => {
    const w = river(), cache = new ShoreVegetation(), before = structuredClone(w), { g, calls } = graphics()
    cache.draw(g, w, { x: 2000, y: 2000, width: 100, height: 100 }, 32); expect(calls).toEqual([])
    cache.draw(g, w, view, 32); expect(calls.length).toBeGreaterThan(0); expect(w).toEqual(before)
    const animated = cache.sites(w).find(p => p.animated)!, still = cache.sites(w).find(p => !p.animated)!
    expect(plantSway(still, 5000)).toBe(0)
    expect(plantSway(animated, 1000)).toBe(plantSway(animated, 1000))
    expect(Math.abs(plantSway(animated, 1000) - plantSway(animated, 1050))).toBeLessThan(.02)
    for (let t = 0; t < 30000; t += 500) expect(Math.abs(plantSway(animated, t))).toBeLessThanOrEqual(1.1)
    calls.length = 0; drawShorePlant(g, animated, 3000, 32); const frame = [...calls]
    calls.length = 0; drawShorePlant(g, animated, 3000, 32); expect(calls).toEqual(frame)
  })
})
