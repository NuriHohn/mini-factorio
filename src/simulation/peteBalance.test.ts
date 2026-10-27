import { beforeAll, expect, it } from 'vitest'
import { createPetesWorld, placeGrove, placeIron } from './petesWorld'
import { advanceWorld } from './step'
import { advanceHomestead, begin, materialStore } from './homestead'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { finishWorkshop, WORKSHOP_ACTIVITY_MS } from './workshop'
import { projectCandidates, trySecretProject } from './secretProject'
import { advancePeace, GIFT_MAX_MS, GIFT_MIN_MS } from './peace'
import type { World } from './world'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const save = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-26T12:00:00.000Z'))
function until(w: World, ready: () => boolean, limit: number) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready(), JSON.stringify({ time: w.timeMs, paths: w.personality.paths, task: w.homestead, stock: materialStore(w), activity: w.peace.activity })).toBe(true)
}
let eco: World, craftsman: World
beforeAll(() => {
  eco = createPetesWorld()
  for (const [x, y] of [[26, 15], [14, 15], [14, 25], [26, 25]]) expect(placeGrove(eco, x, y)).toBeNull()
  until(eco, () => eco.orchardProject?.phase === 'complete' && eco.homestead!.millBuilt === 3, 1800000)
}, 60000)
it('builds the orchard and paid sawmill from actual groves within thirty simulation minutes', () => {
  expect(eco.personality.paths.eco.level).toBeGreaterThanOrEqual(3)
  expect(eco.mined.iron).toBe(0)
  expect(eco.buildings[eco.homestead!.millAnchor!]?.kind).toBe('sawmill')
  expect(eco.orchardProject?.carried).toBe(0)
})
beforeAll(() => { until(eco, () => eco.homestead!.expansion.assembler !== null && eco.produced.woodenCrate > 0, 1800000) }, 60000)
it('continues through the roof and real forestry/crate production rather than remaining in daily care', () => {
  expect(eco.homestead!.expansion.forestry).not.toBeNull()
  expect(materialStore(eco)!.storeTier).toBeGreaterThan(0)
  expect(eco.produced.woodPanel).toBeGreaterThan(20)
})
beforeAll(() => {
  craftsman = createPetesWorld()
  expect(placeIron(craftsman, 26, 18)).toBeNull()
  until(craftsman, () => craftsman.personality.paths.craftsman.level >= 4, 1800000)
}, 60000)
it('reaches Craftsman four from iron alone, without waiting for an Eco fence or Wood', () => {
  expect(craftsman.project).toBeNull()
  expect(craftsman.workshopProject?.phase).toBe('complete')
  expect(craftsman.homestead!.expansion.miner).not.toBeNull()
  expect(materialStore(craftsman)!.wood).toBe(0)
  expect(craftsman.personality.paths.eco.xp).toBe(0)
})
it('keeps offered ore free when locating a new bicycle or other personal building', () => {
  const w = structuredClone(craftsman)
  for (const tile of w.bicycleProject?.tiles ?? []) w.buildings[tile] = null
  Reflect.deleteProperty(w, 'bicycleProject')
  materialStore(w)!.inventory.ironPlate = 24
  w.tiles[823] = 'copper'
  w.topologyRevision++
  const candidate = projectCandidates(w).find(c => c.definition.id === 'bicycle')
  expect(candidate).toBeDefined()
  expect(candidate!.project.tiles).not.toContain(823)
  expect(candidate!.project.tiles.every(tile => w.tiles[tile] === null)).toBe(true)
})
it('awards repeatable level-three anvil XP only after actual work, and preserves the cooldown', () => {
  const w = structuredClone(craftsman), p = w.workshopProject!, tile = p.spots[0]
  Object.assign(w.pete, { tile, x: tile % 40, y: Math.floor(tile / 40), next: null, travelMs: 0 })
  Object.assign(w.peace, { activity: 'hammering', destination: tile, untilMs: w.timeMs + WORKSHOP_ACTIVITY_MS })
  p.readyAtMs = w.timeMs
  const xp = w.personality.paths.craftsman.xp
  expect(finishWorkshop(w)).toBe(false)
  w.timeMs += WORKSHOP_ACTIVITY_MS
  expect(finishWorkshop(w)).toBe(true)
  expect(w.personality.paths.craftsman.xp).toBe(xp + 5)
  expect(finishWorkshop(w)).toBe(false)
  expect(p.readyAtMs).toBe(w.timeMs + 60000)
})
it('prefers affordable new buildings over overdue routine work while retaining a paid project', () => {
  const w = structuredClone(eco), store = materialStore(w)!
  Reflect.deleteProperty(w, 'orchardProject'); Reflect.deleteProperty(w, 'nurseryProject')
  store.wood = 30
  if (w.careProject) w.careProject.readyAtMs = 0
  if (w.feedingProject) w.feedingProject.readyAtMs = w.timeMs + 60000
  w.peace.activity = 'walking'; w.peace.destination = null
  for (const c of projectCandidates(w)) if (w[c.definition.state]) delete w[c.definition.state]!.selected
  expect(projectCandidates(w).some(c => c.definition.id === 'orchard')).toBe(true)
  expect(projectCandidates(w).some(c => c.definition.id === 'gardenCare')).toBe(true)
  expect(trySecretProject(w)).toBe(true)
  expect(w.orchardProject?.selected).toBe(true)
  w.orchardProject!.phase = 'building'; w.orchardProject!.carried = 18; store.wood = 0
  const project = w.orchardProject
  expect(trySecretProject(w)).toBe(true)
  expect(w.orchardProject).toBe(project)
  expect(project?.carried).toBe(18)
})
it('awards iron XP on physical output collection, never again on returning the same plates', () => {
  const w = structuredClone(craftsman), h = w.homestead!, tile = h.expansion.furnace!, furnace = w.buildings[tile]!
  expect(furnace.kind).toBe('furnace')
  if (furnace.kind !== 'furnace') return
  furnace.output.ironPlate = 2
  h.carried.ironPlate = 0; h.task = null
  const spot = tile + 40
  Object.assign(w.pete, { tile: spot, x: spot % 40, y: Math.floor(spot / 40), next: null, travelMs: 0 })
  begin(w, 'takeIron', tile)
  const xp = w.personality.paths.craftsman.xp
  expect(advanceHomestead(w, 50)).toBe(true)
  expect(h.carried.ironPlate).toBe(2)
  expect(w.personality.paths.craftsman.xp).toBe(xp + 2)
  for (let t = 0; t < 60000 && h.task; t += 50) { w.timeMs += 50; advanceHomestead(w, 50) }
  expect(h.task).toBeNull()
  expect(h.carried.ironPlate).toBe(0)
  expect(w.personality.paths.craftsman.xp).toBe(xp + 2)
})
it('round trips longer rest/gift timers and continues exact active work', () => {
  const w = structuredClone(eco)
  w.homestead!.nextRestAtMs = w.timeMs + 360000
  w.peace.nextGiftAtMs = w.timeMs + 3000000
  const loaded = decodeSave(JSON.stringify(save(w))).world
  advanceWorld(w, 1000); advanceWorld(loaded, 1000)
  expect(save(loaded)).toEqual(save(w))
})
it('uses longer gift intervals and at most two waiting gifts in new Petes Welt', () => {
  const w = createPetesWorld()
  expect(w.peace.nextGiftAtMs).toBeGreaterThanOrEqual(GIFT_MIN_MS * 2)
  expect(w.peace.nextGiftAtMs).toBeLessThanOrEqual(GIFT_MAX_MS * 2)
  for (let i = 0; i < 4; i++) {
    w.timeMs = w.peace.nextGiftAtMs
    advancePeace(w, 50)
    expect(w.peace.nextGiftAtMs - w.timeMs).toBeGreaterThanOrEqual(GIFT_MIN_MS * 2)
    expect(w.peace.nextGiftAtMs - w.timeMs).toBeLessThanOrEqual(GIFT_MAX_MS * 2)
  }
  expect(w.peace.gifts).toHaveLength(2)
  expect(decodeSave(JSON.stringify(save(w))).world.peace.gifts).toEqual(w.peace.gifts)
})
