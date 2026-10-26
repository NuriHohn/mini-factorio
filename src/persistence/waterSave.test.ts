import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave, SAVE_VERSION } from './saveGame'
import type { SaveDocument } from './saveGame'
import { createBareWorld, poweredWorld } from '../simulation/testFixtures'
import { createWorld, placeBuilding } from '../simulation/world'
import { commitConstruction } from '../simulation/construction'
import { advanceWorld } from '../simulation/step'
const view = { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: ReturnType<typeof createWorld>): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-21T00:00:00.000Z'))
function bridgeWorld() {
  const w = createBareWorld(() => .5); w.nature.wood = 15
  for (let y = 0; y < 40; y++) for (const x of [10, 11, 12]) w.water[y * 40 + x] = true
  commitConstruction(w, { x: 8, y: 10 }, { x: 14, y: 10 }, 'belt', 'east')
  return w
}
describe('version 9 terrain and bridge persistence', () => {
  it('round trips new generated terrain, nature and factory state exactly', () => {
    const w = createWorld(() => .42); advanceWorld(w, 675)
    const original = snapshot(w), restored = decodeSave(JSON.stringify(original)).world
    expect(SAVE_VERSION).toBe(47); expect(restored.water.some(Boolean)).toBe(true)
    expect(snapshot(restored)).toEqual(original)
    advanceWorld(w, 1234); advanceWorld(restored, 1234)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('migrates a genuine version-8 factory without flooding or changing saved gameplay state', () => {
    const w = poweredWorld(() => .5)
    placeBuilding(w, 20, 20, 'miner', 'east'); advanceWorld(w, 1600)
    w.peace.nextProjectCheckAtMs = 0; w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs'); Object.assign(old, { version: 8 }); Reflect.deleteProperty(old.game, 'personality'); Reflect.deleteProperty(old.game, 'water')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(restored.water.every(v => !v)).toBe(true)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('restores paid bridge state and packets mid-crossing, with no duplicate material deduction', () => {
    const w = bridgeWorld(), b = w.buildings[411]!
    if (b.kind !== 'belt') throw Error('fixture')
    b.item = 'copper'; b.progress = .35
    const restored = decodeSave(JSON.stringify(snapshot(w))).world
    expect(restored.nature.wood).toBe(6); expect(snapshot(restored)).toEqual(snapshot(w))
    advanceWorld(w, 1000); advanceWorld(restored, 1000)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(restored.nature.wood).toBe(6)
  })
  it.each([
    ['missing terrain', (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'water') }],
    ['wrong length', (d: SaveDocument) => { d.game.water.pop() }],
    ['invalid tile type', (d: SaveDocument) => { Object.assign(d.game.water, { 0: 'water' }) }],
    ['missing segment', (d: SaveDocument) => { d.game.buildings[411] = null }],
    ['direction mismatch', (d: SaveDocument) => { Object.assign(d.game.buildings[411]!, { direction: 'north' }) }],
    ['side entry', (d: SaveDocument) => { Object.assign(d.game.buildings[411]!, { entry: 'north' }) }],
    ['false marker', (d: SaveDocument) => { Object.assign(d.game.buildings[411]!, { bridge: false }) }],
    ['ordinary belt on water', (d: SaveDocument) => { Reflect.deleteProperty(d.game.buildings[411]!, 'bridge') }],
    ['bridge on land', (d: SaveDocument) => { Object.assign(d.game.buildings[409]!, { bridge: true }) }],
    ['decoration on water', (d: SaveDocument) => { d.game.nature.decorations[411] = 'flowers' }],
    ['water under Pete', (d: SaveDocument) => { d.game.water[d.game.pete.tile] = true }],
    ['terrain hidden in old version', (d: SaveDocument) => { Object.assign(d, { version: 8 }); Reflect.deleteProperty(d.game, 'personality') }],
    ['bridge hidden in old version', (d: SaveDocument) => { Object.assign(d, { version: 8 }); Reflect.deleteProperty(d.game, 'personality'); Reflect.deleteProperty(d.game, 'water') }],
  ])('strictly rejects %s without changing the source world', (_name, change) => {
    const w = bridgeWorld(), before = snapshot(w), malformed = structuredClone(before)
    change(malformed)
    expect(() => decodeSave(JSON.stringify(malformed))).toThrow()
    expect(snapshot(w)).toEqual(before)
  })
})
