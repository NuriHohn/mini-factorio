import { describe, expect, it } from 'vitest'
import { poweredWorld } from './testFixtures'
import { placeBuilding } from './world'
import { playfulSpray } from './playfulSpray'
import { advanceWorld } from './step'
import { encodeSave, decodeSave } from '../persistence/saveGame'
describe('harmless manual sprinkler', () => {
  it('sprays peaceful Pete and arbitrary targets only in powered range without changing his routine or resources', () => {
    const w = poweredWorld(() => .5); w.nature.wood = 20
    placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 22, 20, 'sprinkler', 'east')
    Object.assign(w.pete, { x: 23, y: 20, tile: 823, next: null })
    const before = structuredClone(w.peace), wood = w.nature.wood
    expect(playfulSpray(w, { x: 23, y: 20 })).toBe(true)
    expect(w.playfulSpray!.wetPete).toBe(true); expect(w.pete.mode).toBe('WANDERING'); expect(w.peace).toEqual(before); expect(w.nature.wood).toBe(wood)
    expect(playfulSpray(w, { x: 23, y: 20 })).toBe(false)
    const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
    expect(decodeSave(encodeSave(w, view)).world.playfulSpray).toEqual(w.playfulSpray)
    advanceWorld(w, 3000); expect(w.playfulSpray).toBeUndefined()
    advanceWorld(w, 7000); expect(playfulSpray(w, { x: 25, y: 20 })).toBe(true)
    expect(w.playfulSpray!.wetPete).toBe(false)
  })
  it('rejects unpowered, out-of-world and out-of-range targets', () => {
    const w = poweredWorld(() => .5); placeBuilding(w, 22, 20, 'sprinkler', 'east')
    expect(playfulSpray(w, { x: 26, y: 20 })).toBe(false)
    expect(playfulSpray(w, { x: NaN, y: 20 })).toBe(false)
    w.buildings[741] = null; w.topologyRevision++
    expect(playfulSpray(w, { x: 22, y: 20 })).toBe(false)
  })
})
