import { describe, expect, it } from 'vitest'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding } from './world'
import { advanceWorld } from './step'
import { advancePoultry, poultryBedtime, poultryGround } from './poultry'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
function world() {
  const w = createBareWorld(() => .5); w.nature.wood = 100; placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
  const crate = w.buildings[824]!; if (crate.kind === 'supplyCrate') crate.wood = 16
  for (let n = 0; n < 10000 && !w.poultry; n++) advanceWorld(w, 50)
  expect(w.poultry).not.toBeNull()
  return w
}
describe('chickens share Pete bedtime', () => {
  it('walks outside birds back, holds them inside without new eggs and releases them after Pete wakes', () => {
    const w = world(), s = w.poultry!, ground = poultryGround(w, s.coop), distant = [...ground.keys()].at(-1)!
    for (const b of s.birds) Object.assign(b, { tile: distant, next: null, mode: 'pecking', travelMs: 0, untilMs: w.timeMs + 3000 })
    w.peace.activity = 'resting'; expect(poultryBedtime(w)).toBe(true)
    const eggs = s.eggs.length
    for (let n = 0; n < 240; n++) { w.timeMs += 50; advancePoultry(w, 50) }
    expect(s.birds.every(b => b.mode === 'inside' && b.tile === null)).toBe(true); expect(s.eggs).toHaveLength(eggs)
    const seed = s.seed
    for (let n = 0; n < 40; n++) { w.timeMs += 50; advancePoultry(w, 50) }
    expect(s.birds.every(b => b.tile === null)).toBe(true); expect(s.seed).toBe(seed)
    w.peace.activity = 'walking'
    for (let n = 0; n < 40; n++) { w.timeMs += 50; advancePoultry(w, 50) }
    expect(s.birds.some(b => b.tile !== null)).toBe(true)
  })
  it('preserves a real sleeping visit and bird movement through save/load and elapsed-time partitions', () => {
    const w = world()
    for (let n = 0; n < 12000 && w.peace.activity !== 'resting'; n++) advanceWorld(w, 50)
    expect(w.peace.activity).toBe('resting')
    const restored = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 16017); for (const ms of [17, 1000, 5000, 10000]) advanceWorld(restored, ms)
    expect(JSON.parse(encodeSave(restored, view, '2026-10-23T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-23T00:00:00.000Z')))
    removeBuilding(w, 20, 20); expect(poultryBedtime(w)).toBe(false)
    removeBuilding(w, w.poultry!.coop % 40, Math.floor(w.poultry!.coop / 40)); advanceWorld(w, 50)
    expect(w.poultry!.birds.every(b => b.tile === null)).toBe(true); expect(() => encodeSave(w, view)).not.toThrow()
  })
})
