import { beforeAll, describe, expect, it } from 'vitest'
import { awardActivity, createPersonality, DOMINANCE_MARGIN, EGG_REWARD, INFLUENCE_LIMIT, levelForXp, PERSONALITY_PATHS, PROJECT_REWARDS, rewardProject } from './personality'
import { createBareWorld } from './testFixtures'
import { placeBuilding, removeBuilding, SIZE } from './world'
import type { SupplyCrate, World } from './world'
import { advanceWorld } from './step'
import { supplyWood } from './supplyCrate'
import { collectEgg } from './poultry'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { SaveDocument } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World): SaveDocument => JSON.parse(encodeSave(w, view, '2026-10-22T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function until(w: World, ready: () => boolean, limit = 900000) {
  for (let t = 0; t < limit && !ready(); t += 50) advanceWorld(w, 50)
  expect(ready()).toBe(true)
}
let template: World
beforeAll(() => {
  template = createBareWorld(() => .5); template.nature.wood = 500
  placeBuilding(template, 20, 20, 'treehouse', 'east'); placeBuilding(template, 24, 20, 'supplyCrate', 'east')
  supplyWood(template, 824, 21)
  until(template, () => template.campfireProject?.phase === 'complete')
})
describe('independent XP and recent personality', () => {
  it('starts every path at zero XP and level one without rewarding supplies', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 100
    placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
    supplyWood(w, 824, 6)
    expect(w.personality).toEqual(createPersonality())
    expect(w.personality.dominant).toBe('eco')
  })
  it.each([[0, 1], [19, 1], [20, 2], [79, 2], [80, 3], [199, 3], [200, 4], [449, 4], [450, 5], [1000, 5]])('derives level %i XP → %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level)
  })
  it('supports repeatable data-driven rewards on all paths without sharing XP', () => {
    const s = createPersonality()
    PERSONALITY_PATHS.forEach((path, i) => {
      awardActivity(s, { path, xp: 20 * (i + 1) }); awardActivity(s, { path, xp: 1 })
    })
    expect(PERSONALITY_PATHS.map(path => s.paths[path].xp)).toEqual([21, 41, 61, 81])
    expect(PERSONALITY_PATHS.map(path => s.paths[path].level)).toEqual([2, 2, 2, 3])
    for (const xp of [0, -1, .5, Infinity]) expect(() => awardActivity(s, { path: 'eco', xp })).toThrow()
  })
  it('uses bounded recency and hysteresis rather than lifetime XP, preserving all levels', () => {
    const s = createPersonality()
    for (let i = 0; i < 20; i++) awardActivity(s, { path: 'eco', xp: 100 })
    expect(s.paths.eco.influence).toBe(INFLUENCE_LIMIT)
    awardActivity(s, { path: 'inventor', xp: 1 }); expect(s.dominant).toBe('eco')
    while (s.dominant === 'eco') awardActivity(s, { path: 'inventor', xp: 1 })
    expect(s.paths.inventor.influence - s.paths.eco.influence).toBeGreaterThanOrEqual(DOMINANCE_MARGIN)
    expect(s.paths.inventor.xp).toBeLessThan(s.paths.eco.xp)
    expect(s.paths.eco).toMatchObject({ xp: 2000, level: 5 })
    awardActivity(s, EGG_REWARD); expect(s.dominant).toBe('inventor')
    for (let i = 0; i < 10; i++) awardActivity(s, EGG_REWARD)
    expect(s.dominant).toBe('eco'); expect(s.paths.inventor.xp).toBeGreaterThan(0)
  })
  it('guards once-only project rewards and safe integer XP saturation', () => {
    const s = createPersonality()
    expect(rewardProject(s, 'fence')).toBe(true); expect(rewardProject(s, 'fence')).toBe(false)
    expect(s.paths.eco.xp).toBe(5)
    s.paths.eco.xp = Number.MAX_SAFE_INTEGER - 1
    awardActivity(s, EGG_REWARD); awardActivity(s, EGG_REWARD)
    expect(s.paths.eco.xp).toBe(Number.MAX_SAFE_INTEGER); expect(s.paths.eco.level).toBe(5)
  })
})
describe('actual activity rewards and persistence', () => {
  it('awards completed projects only once, including the yard and gate, without rewarding individual sections', () => {
    const w = structuredClone(template)
    expect(w.personality.rewardedProjects).toEqual(['fence', 'coop', 'campfire'])
    expect(w.personality.paths.eco.xp).toBe(20 + w.poultry!.collected)
    supplyWood(w, 824, 100)
    until(w, () => w.yard?.built === 1)
    expect(w.personality.rewardedProjects).not.toContain('yard')
    const restored = load(w)
    until(w, () => w.gateProject?.phase === 'complete')
    advanceWorld(restored, w.timeMs - restored.timeMs)
    expect(restored.personality).toEqual(w.personality)
    expect(w.personality.rewardedProjects.filter(id => id !== 'garden')).toEqual(['fence', 'coop', 'campfire', 'yard', 'gate'])
    expect(w.personality.paths.eco.xp).toBe(35 + w.poultry!.collected + 5 * w.buildings.filter(b => b?.kind === 'tree' && b.origin === 'manual').length + (w.gardenProject?.phase === 'complete' ? 20 : 0) + (w.careProject?.completedCycles ?? 0) * 4)
    const tile = w.gateProject!.tiles[0]; removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE))
    const after = load(w); advanceWorld(after, 5000)
    expect(after.personality.rewardedProjects).toEqual(w.personality.rewardedProjects)
  })
  it('rewards each successfully collected egg once across mid-animation restoration, and not on interruption', () => {
    const w = structuredClone(template)
    until(w, () => w.peace.activity === 'collectingEgg')
    const before = structuredClone(w.personality), restored = load(w), remaining = w.peace.untilMs - w.timeMs
    expect(collectEgg(w)).toBe(false); expect(w.personality).toEqual(before)
    advanceWorld(w, remaining); advanceWorld(restored, remaining)
    expect(w.personality.paths.eco.xp).toBe(before.paths.eco.xp + 1)
    expect(restored.personality).toEqual(w.personality); expect(collectEgg(w)).toBe(false)
    until(w, () => w.peace.activity === 'collectingEgg')
    const xp = w.personality.paths.eco.xp, tile = w.poultry!.coop
    expect(removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE))).toBe(true)
    advanceWorld(w, 2000); expect(w.personality.paths.eco.xp).toBe(xp)
  })
  it('migrates completed projects once from version 20, without retroactive egg XP or changing gameplay', () => {
    const w = structuredClone(template); w.peace.nextProjectCheckAtMs = 0; w.peace.nextGiftAtMs = Math.min(w.peace.nextGiftAtMs, w.timeMs + 600000)
    const old = snapshot(w); Reflect.deleteProperty(old.game.peace, 'nextProjectCheckAtMs')
    Object.assign(old, { version: 20 }); Reflect.deleteProperty(old.game, 'personality')
    const restored = decodeSave(JSON.stringify(old)).world
    expect(restored.personality.paths.eco).toMatchObject({ xp: 20, level: 2 })
    expect(restored.personality.rewardedProjects).toEqual(['fence', 'coop', 'campfire'])
    expect(restored.poultry).toEqual(w.poultry); expect(restored.project).toEqual(w.project)
    const again = load(restored); expect(again.personality).toEqual(restored.personality)
    expect(again.buildings).toEqual(w.buildings)
  })
  it('retains exact progression, influence and dominance across normal loads and equivalent time partitions', () => {
    const w = structuredClone(template)
    for (let i = 0; i < 10; i++) awardActivity(w.personality, { path: 'craftsman', xp: 5 })
    const restored = load(w), split = load(w)
    expect(restored.personality).toEqual(w.personality); expect(restored.personality.dominant).toBe('craftsman')
    advanceWorld(w, 120017); advanceWorld(restored, 120017)
    for (let i = 0; i < 120; i++) advanceWorld(split, 1000)
    advanceWorld(split, 17)
    expect(snapshot(w)).toEqual(snapshot(restored)); expect(snapshot(split)).toEqual(snapshot(w))
    const idle = structuredClone(w.personality); advanceWorld(w, 0); expect(w.personality).toEqual(idle)
  })
  it('rejects missing, malformed or inconsistent progression without changing the source world', () => {
    const w = structuredClone(template), before = snapshot(w)
    for (const mutate of [
      (d: SaveDocument) => { Reflect.deleteProperty(d.game, 'personality') },
      (d: SaveDocument) => { d.game.personality.paths.eco.xp = -1 },
      (d: SaveDocument) => { d.game.personality.paths.eco.level = 5 },
      (d: SaveDocument) => { d.game.personality.paths.eco.influence = 21 },
      (d: SaveDocument) => { d.game.personality.paths.eco.xp = 0; d.game.personality.paths.eco.level = 1 },
      (d: SaveDocument) => { d.game.personality.rewardedProjects.push('gate') },
      (d: SaveDocument) => { d.game.personality.rewardedProjects.push('fence') },
      (d: SaveDocument) => { d.game.personality.rewardedProjects = [] },
      (d: SaveDocument) => { Object.assign(d.game.personality, { dominant: 'unknown' }) },
      (d: SaveDocument) => { Object.assign(d.game.personality.paths.eco, { bonus: 3 }) },
    ]) {
      const d = structuredClone(before); mutate(d)
      expect(() => decodeSave(JSON.stringify(d))).toThrow('Invalid save')
      expect(snapshot(w)).toEqual(before)
    }
    expect(PROJECT_REWARDS.gate.xp).toBe(5)
    expect((w.buildings[824] as SupplyCrate).wood).toBe(0)
  })
})
