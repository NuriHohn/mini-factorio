import { describe, expect, it } from 'vitest'
import { createPetesWorld, placeGrove } from './petesWorld'
import { advanceWorld } from './step'
import { advanceHomestead, materialStore } from './homestead'
import { awardActivity } from './personality'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { emptyInventory } from './items'
import { supplyCapacity } from './supplyCrate'
import { canReceive, deliverItem } from './transport'
import type { World } from './world'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-10-24T15:00:00.000Z'
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, stamp))
function forest() {
  const w = createPetesWorld()
  for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(w, x, y)).toBeNull()
  return w
}
function until(w: World, condition: () => boolean, limit = 240000) {
  for (let t = 0; t < limit && !condition(); t += 50) advanceWorld(w, 50)
  expect(condition(), JSON.stringify({ time: w.timeMs, home: w.homestead, wood: materialStore(w)?.wood, panels: materialStore(w)?.inventory.woodPanel, xp: w.personality.paths.eco.xp, projects: [w.project, w.coopProject, w.campfireProject, w.gardenProject, w.harvestProject].map(p => p && [p.kind, p.phase, p.built, p.selected, p.carried]), feed: w.gardenProject && w.buildings[w.gardenProject.tiles[0]], feeding: w.feedingProject, activity: w.peace.activity, tile: w.pete.tile, destination: w.peace.destination })).toBe(true)
}
describe('Petes Welt follows the original project and daily-life progression', () => {
  it('boots by felling real trees and pays six Wood for a general store at level one', () => {
    const w = forest(), before = w.buildings.filter(b => b?.kind === 'tree').length
    until(w, () => materialStore(w) !== null)
    expect(w.buildings.filter(b => b?.kind === 'tree')).toHaveLength(before - 2)
    expect(w.nature.wood).toBe(0)
    expect(materialStore(w)?.wood).toBe(0)
    expect(materialStore(w)?.inventory).toEqual(emptyInventory())
    expect(w.personality.paths.eco).toMatchObject({ level: 1, xp: 5 })
    expect(w.miniFactory).toMatchObject({ anchor: null, built: 0 })
    expect(w.buildings.some(b => b?.kind === 'sawmill' || b?.kind === 'forester' || b?.kind === 'assembler')).toBe(false)
    expect(() => snapshot(w)).not.toThrow()
  })
  it('uses harvested store Wood for the old fence, coop, campfire and garden projects', () => {
    const w = forest()
    until(w, () => w.gardenProject?.phase === 'complete' && w.coopProject?.phase === 'complete' && w.campfireProject?.phase === 'complete', 1200000)
    expect(w.project?.phase).toBe('complete')
    expect(w.harvestProject?.completedCycles).toBeGreaterThan(0)
    expect(w.poultry?.birds.length).toBeGreaterThan(0)
    expect(w.personality.paths.eco.level).toBeGreaterThanOrEqual(2)
    expect(w.nature.wood).toBe(0)
    materialStore(w)!.wood = 60
    let slept = false
    until(w, () => { slept ||= w.peace.activity === 'resting'; return slept && (w.feedingProject?.completedCycles ?? 0) > 0 }, 600000)
    expect(slept).toBe(true)
    expect(() => snapshot(w)).not.toThrow()
  })
  it('builds the level-three hand-fed sawmill and spends eight real panels on the store roof', () => {
    const w = forest()
    until(w, () => materialStore(w) !== null)
    const store = materialStore(w)!
    store.wood = 40
    advanceWorld(w, 5000)
    expect(w.homestead?.millAnchor).toBeNull()
    awardActivity(w.personality, { path: 'eco', xp: 80 })
    const checked = new Set<string>()
    for (let t = 0; t < 1800000 && materialStore(w)?.storeTier !== 1; t += 50) {
      const h = w.homestead!
      const boundary = h.task === 'buildMill' && h.elapsedMs > 0 || h.task === 'feedMill' && h.carried.wood > 0 || h.task === 'returnStock' && h.carried.woodPanel > 0 || h.task === 'expandStore' && h.elapsedMs > 0
      if (boundary && h.task && !checked.has(h.task)) {
        checked.add(h.task)
        const restored = decodeSave(encodeSave(w, view, stamp)).world
        advanceWorld(w, 50); advanceWorld(restored, 50)
        expect(snapshot(restored)).toEqual(snapshot(w))
      } else advanceWorld(w, 50)
    }
    expect([...checked].sort()).toEqual(['buildMill', 'expandStore', 'feedMill', 'returnStock'])
    expect(materialStore(w)?.storeTier).toBe(1)
    expect(w.homestead?.millBuilt).toBe(3)
    expect(w.produced.woodPanel).toBeGreaterThanOrEqual(8)
    expect(w.buildings.some(b => b?.kind === 'forester' || b?.kind === 'assembler' || b?.kind === 'belt')).toBe(false)
    expect(supplyCapacity(materialStore(w)!)).toBe(400)
    expect(() => snapshot(w)).not.toThrow()
  })
  it.each([10000, 40000, 150000, 400000])('continues without replay across a %i ms save', checkpoint => {
    const w = forest(); advanceWorld(w, checkpoint)
    const restored = decodeSave(encodeSave(w, view, stamp)).world
    advanceWorld(w, 60000); advanceWorld(restored, 60000)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('preserves a real carried load while the destination store is full', () => {
    const w = forest(); until(w, () => materialStore(w) !== null)
    const s = w.homestead!, store = materialStore(w)!
    s.task = 'returnStock'; s.target = s.store; s.carried.woodPanel = 2
    store.wood = 200
    for (let n = 0; n < 200; n++) advanceHomestead(w, 50)
    expect(s.carried.woodPanel).toBe(2)
    expect(store.inventory.woodPanel).toBe(0)
    store.wood = 198
    for (let n = 0; n < 200 && s.task; n++) advanceHomestead(w, 50)
    expect(s.carried.woodPanel).toBe(0)
    expect(store.inventory.woodPanel).toBe(2)
    expect(s.task).toBeNull()
  })
  it('applies the expanded shared capacity to mixed transport and strict save validation', () => {
    const w = forest(); until(w, () => materialStore(w) !== null)
    const store = materialStore(w)!
    store.storeTier = 1; store.wood = 399
    expect(deliverItem(store, 'iron', 'east')).toBe(true)
    expect(canReceive(store, 'copper', 'north')).toBe(false)
    expect(() => snapshot(w)).not.toThrow()
    const bad = snapshot(w); bad.game.buildings[w.homestead!.store!].wood++
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  })
  it('migrates paid version-39 factory work without removing buildings, products or progress', () => {
    const w = createPetesWorld(); placeGrove(w, 26, 15); w.miniFactory!.anchor = 17 * 40 + 24
    advanceWorld(w, 17550)
    const doc = snapshot(w); doc.version = 39; delete doc.game.homestead
    const restored = decodeSave(JSON.stringify(doc)).world
    expect(restored.miniFactory).toEqual(w.miniFactory)
    expect(restored.buildings).toEqual(w.buildings)
    expect(restored.personality).toEqual(w.personality)
    advanceWorld(w, 90000); advanceWorld(restored, 90000)
    expect(restored.miniFactory?.built).toBe(11)
    expect(snapshot(restored)).toEqual(snapshot(w))
  })
  it('rejects fabricated carried stock or work clocks without altering the original world', () => {
    const w = forest(), before = snapshot(w), bad = snapshot(w)
    bad.game.homestead.carried.ironPlate = 12
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
    expect(snapshot(w)).toEqual(before)
    bad.game.homestead.carried.ironPlate = 0; bad.game.homestead.elapsedMs = 1
    expect(() => decodeSave(JSON.stringify(bad))).toThrow()
  })
  it('does not give materials or progress when no mature reachable trees exist', () => {
    const w = createPetesWorld(); advanceWorld(w, 10000)
    expect(w.homestead?.store).toBeNull()
    expect(w.homestead?.carried.wood).toBe(0)
    expect(w.personality.paths.eco.xp).toBe(0)
    expect(() => snapshot(w)).not.toThrow()
  })
})
