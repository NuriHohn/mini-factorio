import { beforeAll, describe, expect, it } from 'vitest'
import { createPetesWorld, placeGrove, placeIron } from './petesWorld'
import { advanceWorld } from './step'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { neighboringTiles, peteReachableTiles, peteWalkableTile } from './navigation'
import { projectBuilding } from './secretProject'

function until(w: World, done: () => boolean, limit = 1800000) {
  for (let t = 0; t < limit && !done(); t += 50) advanceWorld(w, 50)
  expect(done(), JSON.stringify({ time: w.timeMs, h: w.homestead, stock: w.buildings[w.homestead!.store ?? 0], paths: w.personality.paths, activity: w.peace.activity })).toBe(true)
}
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
describe('raw iron supply grows into connected Craftsman production', () => {
  let w: World
  beforeAll(() => { w = createPetesWorld(); expect(placeIron(w, 26, 18)).toBeNull(); until(w, () => w.homestead!.expansion.miner !== null && w.verandaProject?.phase === 'complete') }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.cargoBicycle) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'iron')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.length === 3) }, 60000)
  it('builds three paid ordinary links from iron alone and preserves exact ongoing simulation', () => {
    expect(w.homestead!.infrastructure.links.map(p => p.kind)).toEqual(['iron', 'gearFeed', 'gearReturn'])
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 5000); advanceWorld(loaded, 5000)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-27T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-27T00:00:00.000Z')))
    expect(w.personality.paths.eco.xp).toBe(0)
  })
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.craftsman > 0) }, 60000)
  it('uses real gears for a visible later workshop order', () => { expect(w.homestead!.infrastructure.craftsman).toBeGreaterThan(0) })
})
describe('raw groves fund Eco wheel and later visible orders', () => {
  let w: World
  let paidSnapshot: string, completeSnapshot: string, visitSnapshot: string
  beforeAll(() => { w = createPetesWorld(); for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(w, x, y)).toBeNull(); until(w, () => w.homestead!.millBuilt === 3) }, 60000)
  beforeAll(() => { until(w, () => w.orchardProject?.phase === 'complete') }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.expansion.assembler !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.waterworks.dock !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.wheel !== null) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.eco > 0) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'woodReturn')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'panelReturn')) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.links.some(p => p.kind === 'crateReturn')) }, 60000)
  it('funds real water power and a product-consuming yard improvement without player Wood', () => {
    expect(w.homestead!.infrastructure.wheel).not.toBeNull()
    expect(w.homestead!.infrastructure.eco).toBeGreaterThan(0)
    expect(w.homestead!.infrastructure.links.map(p => p.kind).sort()).toEqual(['crateReturn', 'panelReturn', 'woodReturn'])
    expect(w.nature.wood).toBe(0)
    expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
  })
  it('keeps the store reachable through the planned yard entrance after all return links are installed', () => {
    const future = structuredClone(w), yard = future.yard!
    expect(yard).not.toBeNull()
    for (const tile of yard.tiles) if (!future.buildings[tile]) future.buildings[tile] = projectBuilding(yard, tile)
    const inside = neighboringTiles(future.peace.home!).find(tile => peteWalkableTile(future, tile))!
    const paths = peteReachableTiles(future, inside)
    expect(neighboringTiles(future.homestead!.store!).some(tile => paths.has(tile))).toBe(true)
  })
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.eco === 3) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.task === 'buildPavilion' && w.homestead!.elapsedMs > 0); paidSnapshot = encodeSave(w, view) }, 60000)
  it('collects a real mixed pavilion invoice and resumes paid construction exactly', () => {
    const w = decodeSave(paidSnapshot).world, h = w.homestead!
    expect(h.carried.woodPanel).toBe(4); expect(h.carried.woodenCrate).toBe(2)
    const loaded = decodeSave(encodeSave(w, view)).world
    advanceWorld(w, 1000); advanceWorld(loaded, 1000)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-28T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-28T00:00:00.000Z')))
  })
  beforeAll(() => { until(w, () => (w.homestead!.infrastructure.pavilion?.stage ?? 0) >= 1) }, 60000)
  beforeAll(() => { until(w, () => (w.homestead!.infrastructure.pavilion?.stage ?? 0) >= 2) }, 60000)
  beforeAll(() => { until(w, () => w.homestead!.infrastructure.pavilion?.stage === 3); completeSnapshot = encodeSave(w, view) }, 60000)
  it('autonomously completes all three visible Eco-5 stages using produced goods', () => {
    const w = decodeSave(completeSnapshot).world
    const p = w.homestead!.infrastructure.pavilion!
    expect(w.buildings[p.tile]?.kind).toBe('petePavilion')
    expect(w.produced.woodPanel).toBeGreaterThanOrEqual(12); expect(w.produced.woodenCrate).toBeGreaterThanOrEqual(8)
    expect(() => decodeSave(encodeSave(w, view))).not.toThrow()
  })
  beforeAll(() => { until(w, () => w.developmentLife?.task === 'pavilionRest' && w.peace.activity === 'developmentWork'); visitSnapshot = encodeSave(w, view) }, 60000)
  it('resumes a real pavilion visit and its five-minute cooldown exactly', () => {
    const w = decodeSave(visitSnapshot).world
    const loaded = decodeSave(encodeSave(w, view)).world, xp = w.developmentLife!.ecoXp
    advanceWorld(w, 8000); advanceWorld(loaded, 8000)
    expect(w.developmentLife!.ecoXp).toBe(xp + 1)
    expect(w.developmentLife!.nextAt.pavilionRest).toBeGreaterThan(w.timeMs)
    expect(JSON.parse(encodeSave(loaded, view, '2026-10-28T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(w, view, '2026-10-28T00:00:00.000Z')))
  })

})
