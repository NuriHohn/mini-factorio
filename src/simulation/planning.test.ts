import { neighboringTiles, peteWalkableTile } from './navigation'
import { describe, expect, it } from 'vitest'
import { materialDemand, materialPolicy } from './materialPolicy'
import { paidConstructionBlocked } from './homesteadExpansion'
import { miniWalk, createPetesWorld } from './petesWorld'
import { advancePetesWorld } from '../pete/simulation'
import { advanceHomestead, begin, materialStore } from './homestead'
import { expansionLayout, planChain } from './homesteadExpansion'
import { emptyInventory } from './items'
import { placeBuilding } from './world'
import { refreshNatureSchedule } from './nature'
import { trySecretProject } from './secretProject'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { workStatus } from '../pete/workStatus'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: ReturnType<typeof createPetesWorld>) => encodeSave(w, view, '2026-11-05T00:00:00.000Z')
function paidOrder() {
  const w = createPetesWorld(), h = w.homestead!
  for (let i = 0; i < w.buildings.length; i++) if (i !== w.peace.home) w.buildings[i] = null
  w.water.fill(false); w.tiles.fill(null); w.topologyRevision++; refreshNatureSchedule(w)
  h.store = 900
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 30, inventory: emptyInventory(), storeTier: 0 }
  materialStore(w)!.inventory.iron = 4
  h.expansion.plan = planChain(w, 'iron')
  expect(h.expansion.plan).not.toBeNull()
  const plan = h.expansion.plan!, parts = expansionLayout(plan)
  begin(w, 'buildChain', parts[1].tile)
  h.carried.iron = 6
  expect(placeBuilding(w, parts[0].tile % 40, Math.floor(parts[0].tile / 40), parts[0].kind, parts[0].direction)).toBe(true)
  plan.built = 1; h.elapsedMs = 750
  const blocked = parts[1].tile
  w.water[blocked] = true; w.topologyRevision++
  return { w, h, plan, blocked }
}
describe('direct material decisions', () => {
  it('derives missing stock without reserving twice after payment, including separate Wood storage', () => {
    const { w } = paidOrder(), store = materialStore(w)!
    const before = save(w)
    expect(materialDemand(store, { wood: 36, iron: 6 })).toEqual({ costs: { wood: 36, iron: 6 }, reserved: { wood: 30, iron: 4 }, missing: { wood: 6, iron: 2 } })
    expect(materialDemand(store, { iron: 6 }, true)).toEqual({ costs: { iron: 6 }, reserved: { iron: 0 }, missing: { iron: 0 } })
    expect(save(w)).toBe(before)
  })
  it('keeps the deliberate manual bootstrap reserve distinct from the common transport reserve', () => {
    const w = createPetesWorld()
    expect(materialPolicy(w)).toMatchObject({ ironPlate: 24, manualGearPlate: 20, copperPlate: 24, copperCable: 12, ironGearTarget: 12, copperCableTarget: 16 })
  })
})
describe('paid orders independent of current activity', () => {
  it('yields a blocked partial construction without losing payment, parts or progress', () => {
    const { w, h, plan } = paidOrder(), before = structuredClone(h.carried)
    expect(paidConstructionBlocked(w)).toBe(true)
    expect(advanceHomestead(w, 50)).toBe(false)
    expect(h.paused).toBe(true)
    expect(h.carried).toEqual(before)
    expect(plan.built).toBe(1); expect(h.elapsedMs).toBe(750)
    expect(workStatus(w)?.activity).toContain('Bauauftrag wartet')
    expect(decodeSave(save(w)).world.homestead).toEqual(h)
  })
  it('does other funded work while blocked, finishes it before resuming, and continues exactly after load', () => {
    const { w, h, blocked } = paidOrder()
    advanceHomestead(w, 50)
    expect(trySecretProject(w)).toBe(true)
    for (let t = 0; t < 30000 && w.project?.phase !== 'building'; t += 50) advancePetesWorld(w, 50)
    expect(w.project?.phase).toBe('building')
    const restored = decodeSave(save(w)).world
    w.water[blocked] = false; w.topologyRevision++
    restored.water[blocked] = false; restored.topologyRevision++
    advancePetesWorld(w, 50); advancePetesWorld(restored, 50)
    expect(h.paused).toBe(true)
    for (let t = 0; t < 180000 && h.expansion.plan; t += 50) { advancePetesWorld(w, 50); advancePetesWorld(restored, 50) }
    expect(w.project?.phase).toBe('complete')
    expect(h.expansion.furnace).not.toBeNull()
    expect(h.expansion.plan).toBeNull(); expect(h.paused).toBeUndefined()
    expect(materialStore(w)!.inventory.iron).toBeLessThanOrEqual(4)
    expect(JSON.parse(save(restored))).toEqual(JSON.parse(save(w)))
  })
  it('finishes an in-flight walking step when a paid site becomes blocked', () => {
    const { w, h } = paidOrder()
    const destination = neighboringTiles(w.pete.tile).find(t => peteWalkableTile(w, t))!
    miniWalk(w, destination, 50)
    expect(w.pete.next).not.toBeNull()
    for (let t = 0; t < 1000 && !h.paused; t += 50) { w.timeMs += 50; advanceHomestead(w, 50) }
    expect(h.paused).toBe(true)
    expect(w.pete.next).toBeNull(); expect(w.pete.tile).toBe(destination)
    expect(h.carried.iron).toBe(6); expect(h.elapsedMs).toBe(750)
    expect(() => decodeSave(save(w))).not.toThrow()
  })
  it('strictly rejects forged pauses and keeps version 56 saves loadable', () => {
    const { w } = paidOrder(), old = JSON.parse(save(w))
    old.version = 56
    expect(decodeSave(JSON.stringify(old)).world.homestead?.paused).toBeUndefined()
    old.game.homestead.paused = true
    expect(() => decodeSave(JSON.stringify(old))).toThrow('Invalid save')
    const bad = JSON.parse(save(w)); bad.game.homestead.paused = false
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
    bad.game.homestead.paused = true; bad.game.homestead.carried.iron = 0; bad.game.homestead.elapsedMs = 0; bad.game.homestead.expansion.plan.built = 0
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('Invalid save')
  })
})
