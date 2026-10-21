import { describe, expect, it } from 'vitest'
import { advanceWorld } from './step'
import { createBareWorld, poweredWorld } from './testFixtures'
import { placeBuilding, placementError, removeBuilding, SIZE } from './world'
import { advancePeace, beginPeace, collectGift, createPeace, GIFT_MAX_MS, GIFT_MIN_MS, peaceful } from './peace'
import { advancePolice, radarDetects, releasePete } from './police'
import { advanceRevenge, attackWalker, damageWalker, recordArrest } from './revenge'
import { advancePete } from './pete'
import { advanceSprinklers, sprinklerDetects } from './sprinklers'
import { shootWeb, tryWebTrap } from './webs'
import { neighboringTiles, reachableTiles } from './navigation'
import { powerRequirement } from './power'
import { inspectBuilding, worldStats } from './inspection'

function home(w = createBareWorld(() => .5)) {
  w.nature.wood = 40
  expect(placeBuilding(w, 18, 23, 'treehouse', 'east')).toBe(true)
  return w
}
function custody(mode: 'ARRESTED' | 'TRANSPORTED' | 'IMPRISONED') {
  const w = createBareWorld(() => .5)
  placeBuilding(w, 0, 1, 'prison', 'east')
  const prison = w.buildings[40]!
  if (prison.kind !== 'prison') throw Error('fixture')
  Object.assign(w.pete, { mode, prison, imprisonedAtMs: mode === 'IMPRISONED' ? 0 : null })
  if (mode === 'IMPRISONED') Object.assign(w.pete, { tile: 40, x: 0, y: 1 })
  else w.police.car = { x: 17, y: 23, tile: 937, next: null, travelMs: 0, path: [], pathRevision: -1, target: 937, phase: mode === 'ARRESTED' ? 'ARRESTING' : 'TRANSPORTING', arrestElapsedMs: mode === 'ARRESTED' ? 700 : 750, arrestFrom: { x: 17, y: 23 }, prison }
  return w
}
describe('Pete’s home and authoritative peace', () => {
  it('starts in conflict; charges exactly 20 global Wood atomically, preserving all other resources/layers', () => {
    const w = createBareWorld(() => .5)
    expect(w.peace).toEqual(createPeace())
    const i = 18 + 23 * SIZE
    w.nature.decorations[i] = 'flowers'; w.tiles[i] = 'copper'
    const resources = structuredClone({ mined: w.mined, produced: w.produced, research: w.research })
    expect(placeBuilding(w, 18, 23, 'treehouse', 'east')).toBe(false)
    expect(w.buildings[i]).toBeNull(); expect(w.nature.wood).toBe(0)
    w.nature.wood = 20
    expect(placeBuilding(w, 18, 23, 'treehouse', 'east')).toBe(true)
    expect(w.nature.wood).toBe(0); expect(peaceful(w)).toBe(true)
    expect(w.tiles[i]).toBe('copper'); expect(w.nature.decorations[i]).toBe('flowers')
    expect({ mined: w.mined, produced: w.produced, research: w.research }).toEqual(resources)
    expect(powerRequirement(w.buildings[i]!)).toBe(0)
    expect(worldStats(w).miners).toBe(0); expect(w.analytics.machines[i]).toBeUndefined()
    expect(inspectBuilding(w, i)).toMatchObject({ kind: 'treehouse', gifts: 0 })
  })
  it('enforces one home and existing occupancy/bounds/actor reservations with no partial charge', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 40
    placeBuilding(w, 18, 23, 'tree', 'east')
    for (const [x, y] of [[18, 23], [-1, 0], [40, 40], [17, 23]]) expect(placeBuilding(w, x, y, 'treehouse', 'east')).toBe(false)
    expect(w.nature.wood).toBe(40)
    expect(placeBuilding(w, 19, 23, 'treehouse', 'east')).toBe(true)
    expect(placementError(w, 20, 23, 'treehouse')).toContain('Only one')
    expect(placeBuilding(w, 20, 23, 'treehouse', 'east')).toBe(false)
    beginPeace(w, 940); expect(w.peace.home).toBe(939); expect(w.nature.wood).toBe(20)
  })
  it.each(['WANDERING', 'FLEEING', 'CRYING', 'TRAPPED', 'SPRAYED', 'SLIPPING', 'COMPLAINING', 'WATER_FLEEING'] as const)('cancels independent hostile/reaction state %s without repairing machinery', mode => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 16, 23, 'generator', 'east')
    const target = w.buildings[936]!
    target.sabotageUntilMs = 10000
    Object.assign(w.pete, { mode, next: 897, travelMs: 50, x: 17, y: 22.935, path: [857], escape: 817, cryingMs: 1000, webMs: 100, trappedBy: 1, ignoredWebs: [1], water: { source: null, origin: { x: 16, y: 23 }, remainingMs: 1000, complaint: 0 }, pumpkin: { target, index: 936, from: { x: 17, y: 23 }, elapsedMs: 350 } })
    home(w)
    expect(w.pete).toMatchObject({ mode: 'WANDERING', next: null, travelMs: 0, prison: null, pumpkin: null, water: null, trappedBy: null, ignoredWebs: [], escape: null, path: [], webMs: 0, cryingMs: 0 })
    advancePete(w, 5000); expect(w.pete.pumpkin).toBeNull()
    expect(target.sabotageUntilMs).toBe(10000)
  })
  it.each(['ARRESTED', 'TRANSPORTED', 'IMPRISONED'] as const)('clears %s custody once, without phantom arrest/release', mode => {
    const w = custody(mode); w.revenge.arrests = 1
    home(w)
    expect(w.police.car).toBeNull(); expect(w.pete.prison).toBeNull(); expect(w.buildings[w.pete.tile]).toBeNull()
    expect(releasePete(w, 40, 0)).toBe(false)
    advancePolice(w, 10000); recordArrest(w)
    expect(w.revenge.arrests).toBe(1)
  })
  it('ignores powered radars, sprinklers and webs; peace prevents all authoritative hostile actions', () => {
    const w = poweredWorld(() => .5)
    Object.assign(w.pete, { tile: 20 * SIZE + 20, x: 20, y: 20 })
    placeBuilding(w, 20, 19, 'radar', 'east'); placeBuilding(w, 19, 19, 'sprinkler', 'east')
    home(w); advanceWorld(w, 50)
    expect(radarDetects(w, 780)).toBe(false); expect(sprinklerDetects(w, 779)).toBe(false)
    shootWeb(w, w.pete); shootWeb(w, { x: 20, y: 20 }); advanceWorld(w, 1000)
    expect(tryWebTrap(w)).toBe(false)
    advanceSprinklers(w, 1000); advancePolice(w, 1000); advancePete(w, 1000)
    expect(w.police.car).toBeNull(); expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.pumpkin).toBeNull()
    expect(attackWalker(w, 'flySwatter', w.pete)).toBeNull(); expect(damageWalker(w, 100)).toBe(false)
  })
  it.each([3, 5, 7, 9])('peace cancels a pending stomp/EMP without combat defeat at threshold %i; demolition gives full warning', threshold => {
    const w = createBareWorld(() => .5); w.revenge.threshold = threshold
    for (let i = 0; i < threshold; i++) recordArrest(w)
    advanceWorld(w, 5000); damageWalker(w, 50)
    expect(w.revenge.stage).toBe('stomp')
    const exitTile = w.revenge.boss!.tile
    home(w)
    expect(w.pete.tile).toBe(exitTile)
    expect(w.revenge).toMatchObject({ stage: 'warning', boss: null, blast: null, arrests: threshold, threshold })
    expect(w.peace.shutdown).not.toBeNull()
    advanceWorld(w, 10000); advanceRevenge(w, 10000)
    expect(w.revenge.boss).toBeNull(); expect(w.revenge.blast).toBeNull()
    expect(removeBuilding(w, 18, 23)).toBe(true)
    expect(w.nature.wood).toBe(20); expect(w.peace.gifts).toEqual([])
    expect(w.pete.mode).toBe('WANDERING'); expect(w.revenge.arrests).toBe(threshold)
    advanceWorld(w, 4950); expect(w.revenge.boss).toBeNull()
    advanceWorld(w, 50); expect(w.revenge.stage).toBe('hunting')
    expect(placeBuilding(w, 18, 23, 'treehouse', 'east')).toBe(true)
    expect(w.revenge.threshold).toBe(threshold); expect(w.nature.wood).toBe(0)
  })
  it('keeps already committed combat escalation when a home is built during breakdown', () => {
    const w = createBareWorld(() => .5)
    for (let i = 0; i < 3; i++) recordArrest(w)
    advanceWorld(w, 5000); damageWalker(w, 100)
    home(w)
    expect(w.revenge).toMatchObject({ stage: 'idle', arrests: 0, threshold: 5, boss: null })
    removeBuilding(w, 18, 23)
    expect(w.revenge).toMatchObject({ stage: 'idle', arrests: 0, threshold: 5 })
  })
  it('rejects construction when a prisoner would have no free world tile', () => {
    const w = custody('IMPRISONED'); w.nature.wood = 20
    for (let i = 0; i < w.buildings.length; i++) if (i !== 938 && !w.buildings[i]) w.buildings[i] = { kind: 'generator', x: i % SIZE, y: Math.floor(i / SIZE) }
    expect(placeBuilding(w, 18, 23, 'treehouse', 'east')).toBe(false)
    expect(w.nature.wood).toBe(20); expect(w.pete.mode).toBe('IMPRISONED')
  })
  it('preserves partial progression on demolition, re-enabling actual police pickups once each', () => {
    const w = custody('ARRESTED'); w.revenge.arrests = 1
    home(w); removeBuilding(w, 18, 23)
    expect(w.revenge).toMatchObject({ stage: 'idle', arrests: 1, threshold: 3 })
    const prison = w.buildings[40]!
    if (prison.kind !== 'prison') throw Error('fixture')
    Object.assign(w.pete, { mode: 'ARRESTED', prison })
    w.police.car = { x: 17, y: 23, tile: 937, next: null, travelMs: 0, path: [], pathRevision: -1, target: 937, phase: 'ARRESTING', arrestElapsedMs: 700, arrestFrom: { x: 17, y: 23 }, prison }
    advancePolice(w, 50); advancePolice(w, 50)
    expect(w.revenge.arrests).toBe(2); expect(w.police.car?.phase).toBe('TRANSPORTING')
  })
})
describe('peaceful routine and gifts', () => {
  it('walks home, climbs, rests, walks and reacts deterministically, recovering after obstruction', () => {
    const w = home(), b = structuredClone(w), seen = new Set<string>()
    for (let i = 0; i < 1600; i++) { advanceWorld(w, 50); seen.add(w.peace.activity) }
    advanceWorld(b, 80000)
    expect(w.peace).toEqual(b.peace); expect(w.pete).toEqual(b.pete)
    for (const name of ['entering', 'resting', 'walking', 'homeward']) expect(seen.has(name)).toBe(true)
    if (w.pete.path.length) {
      const tile = w.pete.path[0]
      placeBuilding(w, tile % SIZE, Math.floor(tile / SIZE), 'storage', 'east')
    }
    advanceWorld(w, 20000)
    expect(w.buildings[w.pete.tile]).toBeNull()
    expect(w.pete.next === null || !w.buildings[w.pete.next]).toBe(true)
  })
  it('recovers when an enclosed home becomes reachable again', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 20
    for (const i of neighboringTiles(20 * SIZE + 20)) placeBuilding(w, i % SIZE, Math.floor(i / SIZE), 'storage', 'east')
    placeBuilding(w, 20, 20, 'treehouse', 'east'); advanceWorld(w, 10000)
    expect(w.pete.mode).toBe('WANDERING')
    removeBuilding(w, 19, 20); advanceWorld(w, 20000)
    expect(['resting', 'walking', 'flowers', 'waving', 'homeward', 'entering']).toContain(w.peace.activity)
    expect(Math.hypot(w.pete.x - 20, w.pete.y - 20)).toBeLessThan(6)
  })
  it('schedules gifts at fixed 5–10 minute intervals on reachable free cells and caps pending gifts', () => {
    const w = home()
    for (let i = 0; i < 5; i++) {
      const delay = w.peace.nextGiftAtMs - w.timeMs
      expect(delay).toBeGreaterThanOrEqual(GIFT_MIN_MS); expect(delay).toBeLessThanOrEqual(GIFT_MAX_MS)
      // Advancing only the peace subsystem avoids irrelevant factory work in this scheduling test.
      w.timeMs += delay - 50; advancePeace(w, 50)
      expect(w.peace.gifts.length).toBe(Math.min(i, 3))
      w.timeMs += 50; advancePeace(w, 50)
      expect(w.peace.gifts.length).toBe(Math.min(i + 1, 3))
      const reachable = reachableTiles(w, w.pete.tile)
      for (const gift of w.peace.gifts) { expect(w.buildings[gift.tile]).toBeNull(); expect(reachable.has(gift.tile)).toBe(true) }
    }
    expect(new Set(w.peace.gifts.map(g => g.tile)).size).toBe(3)
  })
  it('collects each reward once, gifts never reserve occupancy, demolition discards without reward', () => {
    const w = home()
    w.peace.gifts = [{ id: 1, tile: 938 - 40, kind: 'wood', wood: 2, atMs: 0 }, { id: 2, tile: 939, kind: 'flowers', wood: 0, atMs: 0 }]; w.peace.nextId = 3
    expect(collectGift(w, 898)).toContain('+2 Wood'); expect(collectGift(w, 898)).toBeNull(); expect(w.nature.wood).toBe(22)
    expect(placeBuilding(w, 19, 23, 'belt', 'east')).toBe(true)
    expect(collectGift(w, 939)).toBeNull(); removeBuilding(w, 19, 23)
    expect(collectGift(w, 939)).toContain('bouquet'); expect(w.nature.decorations[939]).toBe('flowers')
    expect(collectGift(w, 939)).toBeNull()
    w.peace.gifts.push({ id: 3, tile: 939, kind: 'wood', wood: 1, atMs: 0 })
    removeBuilding(w, 18, 23)
    expect(w.nature.wood).toBe(22); expect(w.peace.gifts).toEqual([])
  })
  it('does not spawn inaccessible gifts or advance any state when paused', () => {
    const w = home()
    for (let i = 0; i < w.buildings.length; i++) if (i !== w.pete.tile && i !== w.peace.home) w.buildings[i] = { kind: 'storage', x: i % SIZE, y: Math.floor(i / SIZE), inventory: { ...w.mined } }
    w.timeMs = w.peace.nextGiftAtMs; advancePeace(w, 50)
    expect(w.peace.gifts).toEqual([])
    const before = structuredClone(w)
    advanceWorld(w, 0); advanceWorld(w, -50); advanceWorld(w, NaN)
    expect(w).toEqual(before)
  })
})
