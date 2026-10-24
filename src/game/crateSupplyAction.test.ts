import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { CrateSupplyAction, supplyIcon, UNLOAD_MS } from './crateSupplyAction'
import { createPetesWorld } from '../simulation/petesWorld'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding, removeBuilding } from '../simulation/world'
import type { SupplyCrate } from '../simulation/world'
import { encodeSave, decodeSave } from '../persistence/saveGame'
function setup() {
  const world = createBareWorld(() => .5); world.nature.wood = 30
  placeBuilding(world, 20, 20, 'supplyCrate', 'east')
  return { world, crate: world.buildings[820] as SupplyCrate, action: new CrateSupplyAction() }
}
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
const view = { x: 0, y: 0, width: 1280, height: 1280 }
describe('Wood icon and cozy crate unloading', () => {
  it('keeps Petes Welt resource-only without manual crate unloading', () => {
    const world = createPetesWorld(), action = new CrateSupplyAction(), { g, calls } = graphics()
    world.nature.wood = 30
    placeBuilding(world, 18, 18, 'supplyCrate', 'east')
    const before = world.nature.wood
    const crate = world.buildings[738] as SupplyCrate
    expect(action.hit(world, supplyIcon(crate, 32, 1), 32, 1)).toBeNull()
    expect(action.activate(world, 738)).toBe(false)
    action.draw(g, world, view, 32, 1, true)
    expect(calls).toEqual([])
    expect(crate.wood).toBe(0)
    expect(world.nature.wood).toBe(before)
  })
  it.each([.5, .65, 1.3, 2.5])('uses a constant screen-pixel hit area at zoom %s', zoom => {
    const { world, crate, action } = setup(), p = supplyIcon(crate, 32, zoom)
    expect(action.hit(world, p, 32, zoom)).toBe(820)
    expect(action.hit(world, { x: p.x + 10 / zoom, y: p.y }, 32, zoom)).toBe(820)
    expect(action.hit(world, { x: p.x + 12 / zoom, y: p.y }, 32, zoom)).toBeNull()
    expect(supplyIcon({ ...crate, y: 0 }, 32, zoom).y).toBeGreaterThan(0)
  })
  it('atomically unloads once per activation and rejects insufficient stock, full or removed crates', () => {
    const { world, crate, action } = setup()
    expect(action.activate(world, 820)).toBe(true); expect(world.nature.wood).toBe(18); expect(crate.wood).toBe(6)
    crate.inventory.iron = 194
    expect(action.activate(world, 820)).toBe(false); expect(world.nature.wood).toBe(18); expect(crate.wood).toBe(6)
    crate.inventory.iron = 0; world.nature.wood = 5
    expect(action.activate(world, 820)).toBe(false)
    removeBuilding(world, 20, 20); expect(action.activate(world, 820)).toBe(false)
    expect(action.hit(world, supplyIcon(crate, 32, 1), 32, 1)).toBeNull()
  })
  it('animates only with simulation time, keeps rendering observational and expires without replay after load', () => {
    const { world, action } = setup(), { g, calls } = graphics()
    action.activate(world, 820); const before = structuredClone(world)
    action.draw(g, world, view, 32, 1, false); const first = [...calls]
    expect(first.length).toBeGreaterThan(0)
    calls.length = 0; action.draw(g, world, view, 32, 1, false)
    expect(calls).toEqual(first); expect(world).toEqual(before)
    world.timeMs = 500; calls.length = 0; action.draw(g, world, view, 32, 1, false); expect(calls).not.toEqual(first)
    world.timeMs = 800; calls.length = 0; action.draw(g, world, view, 32, 1, false); expect(calls.some(c => c[0] === 'strokeEllipse')).toBe(true)
    const loaded = decodeSave(encodeSave(world, { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east', powerOverlay: false })).world
    calls.length = 0; action.draw(g, loaded, view, 32, 1, false); expect(calls).toEqual([])
    action.activate(loaded, 820); loaded.timeMs += UNLOAD_MS
    calls.length = 0; action.draw(g, loaded, view, 32, 1, false); expect(calls).toEqual([])
  })
  it('culls icons/effects and hides controls during other tools; replacing a crate clears its unload', () => {
    const { world, action } = setup(), { g, calls } = graphics()
    action.draw(g, world, view, 32, 1, false); expect(calls).toEqual([])
    action.draw(g, world, view, 32, 1, true); expect(calls.some(c => c[0] === 'strokeCircle')).toBe(true)
    action.activate(world, 820); calls.length = 0
    action.draw(g, world, { x: 3000, y: 3000, width: 100, height: 100 }, 32, 1, true); expect(calls).toEqual([])
    removeBuilding(world, 20, 20); placeBuilding(world, 20, 20, 'supplyCrate', 'east')
    action.draw(g, world, view, 32, 1, false); expect(calls).toEqual([])
  })
})
