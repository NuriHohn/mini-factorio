import { describe, expect, it } from 'vitest'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { materialStore } from './homestead'
import { emptyInventory } from './items'
import { createPetesWorld, placeGrove } from './petesWorld'
import { removeBuilding, SIZE } from './world'
import { advancePetesWorld as advanceWorld } from '../pete/simulation'
import { paintWater, waterEditError } from './waterLandscaping'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const point = (x: number, y: number) => ({ x, y })
const load = (world: ReturnType<typeof createPetesWorld>) => decodeSave(encodeSave(world, view)).world
describe('Petes Welt water and landscaping', () => {
  it('generates persistent ponds/streams while keeping the home and offering area dry', () => {
    const world = createPetesWorld()
    expect(world.water.filter(Boolean).length).toBeGreaterThan(40)
    for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) expect(world.water[y * SIZE + x]).toBe(false)
    for (const [x, y] of [[22, 27], [21, 27], [23, 27], [22, 26], [22, 28]]) expect(world.water[y * SIZE + x]).toBe(true)
    expect(placeGrove(world, 26, 15)).toBeNull()
    expect(load(world).water).toEqual(world.water)
    expect(createPetesWorld().water).toEqual(world.water)
  })
  it('loads a previously dry Petes Welt without silently generating new water', () => {
    const world = createPetesWorld(); world.water.fill(false)
    expect(load(world).water.some(Boolean)).toBe(false)
    expect(load(world).peace.home).toBe(820)
  })
  it.each([1, 3, 5] as const)('uses existing %i-square create/restore brushes without spending supplies', size => {
    const world = createPetesWorld(), stock = world.nature.wood, before = [...world.water]
    expect(paintWater(world, point(14, 14), point(14, 14), 'water', size)).toBe(size * size)
    expect(load(world).water).toEqual(world.water)
    expect(paintWater(world, point(14, 14), point(14, 14), 'land', size)).toBe(size * size)
    expect(world.water).toEqual(before); expect(world.nature.wood).toBe(stock)
  })
  it('protects paid construction footprints, work approaches and missing home repair sites', () => {
    const world = createPetesWorld(), h = world.homestead!
    h.task = 'buildStore'; h.target = 824; h.carried.wood = 6
    h.expansion.plan = { kind: 'iron', anchor: 950, direction: 'south', built: 0 }
    world.project = { home: 820, direction: 'east', tiles: [699, 700, 701], spots: [739, 740, 741], built: 0, phase: 'building', carried: 6, elapsedMs: 0, crate: null }
    for (const tile of [824, 950, 990, 991, 699, 700, 701, 739, 740, 741]) {
      expect(waterEditError(world, tile, 'water')).toContain('reserved')
      expect(paintWater(world, point(tile % SIZE, Math.floor(tile / SIZE)), point(tile % SIZE, Math.floor(tile / SIZE)), 'water', 1)).toBe(0)
    }
    removeBuilding(world, 20, 20)
    expect(world.buildings[820]).toBeNull()
    expect(paintWater(world, point(20, 20), point(20, 20), 'water', 1)).toBe(0)
    expect(world.water[820]).toBe(false)
  })
  it('retains autonomous harvesting/store bootstrap with generated water and a player pond nearby', () => {
    const world = createPetesWorld()
    placeGrove(world, 26, 15)
    paintWater(world, point(16, 14), point(16, 16), 'water', 1)
    for (let elapsed = 0; elapsed < 180000 && !materialStore(world); elapsed += 50) advanceWorld(world, 50)
    expect(materialStore(world)).not.toBeNull()
    expect(world.homestead!.carried).toEqual(emptyInventory())
    expect(load(world).water).toEqual(world.water)
  })
})
