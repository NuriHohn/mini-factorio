import { describe, expect, it } from 'vitest'
import { advanceWorld } from './step'
import { createWorld, placeBuilding, SIZE } from './world'
import { shootWeb, MAX_GROUND_WEBS, WEB_FLIGHT_MS, WEB_LIFETIME_MS } from './webs'
import { clickPete } from './pete'
import { releasePete } from './police'
import type { World } from './world'
function corridor() {
  const w = createWorld(() => .5)
  for (const [x, y] of [[16, 23], [17, 22], [17, 24]]) placeBuilding(w, x, y, 'storage', 'east')
  return w
}
function trapped() {
  const w = corridor()
  expect(shootWeb(w, { x: 18, y: 23 })).toBe('ground')
  advanceWorld(w, 400); expect(w.pete.mode).toBe('TRAPPED')
  return w
}
function until(w: World, mode: typeof w.pete.mode) {
  for (let n = 0; n < 2000 && w.pete.mode !== mode; n++) advanceWorld(w, 50)
  expect(w.pete.mode).toBe(mode)
}
describe('ground web commands and deterministic trapping', () => {
  it('accepts empty and occupied map tiles without changing buildings or terrain', () => {
    const w = corridor(), buildings = structuredClone(w.buildings), terrain = [...w.tiles]
    for (const p of [{ x: 16, y: 23 }, { x: 0, y: 0 }, { x: 39, y: 39 }]) expect(shootWeb(w, p)).toBe('ground')
    expect(w.webs.patches).toHaveLength(3)
    expect(w.buildings).toEqual(buildings); expect(w.tiles).toEqual(terrain)
    for (const p of [{ x: -1, y: 0 }, { x: 40, y: 1 }, { x: NaN, y: 2 }]) expect(shootWeb(w, p)).toBe('outside')
    expect(placeBuilding(w, 0, 0, 'belt', 'east')).toBe(true)
  })
  it('flies before landing, lasts exactly ten seconds from landing, and never traps in flight', () => {
    const w = corridor(); shootWeb(w, { x: 18, y: 23 })
    const web = w.webs.patches[0]
    expect(web.landsAtMs).toBe(WEB_FLIGHT_MS); expect(web.expiresAtMs - web.landsAtMs).toBe(WEB_LIFETIME_MS)
    advanceWorld(w, 250); expect(w.pete.mode).toBe('WANDERING')
    advanceWorld(w, 100); expect(w.pete.mode).toBe('WANDERING')
    advanceWorld(w, 50); expect(w.pete.mode).toBe('TRAPPED')
    const frozen = { x: w.pete.x, y: w.pete.y, travelMs: w.pete.travelMs }
    advanceWorld(w, web.expiresAtMs - w.timeMs - 50)
    expect(w.pete).toMatchObject({ ...frozen, mode: 'TRAPPED', trappedBy: web.id, cooldownMs: 0 })
    advanceWorld(w, 50)
    expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.trappedBy).toBeNull(); expect(w.webs.patches).toHaveLength(0)
  })
  it('does not extend a trap with a later overlapping web', () => {
    const w = corridor(); shootWeb(w, { x: 18, y: 23 }); advanceWorld(w, 50); shootWeb(w, { x: 18, y: 23 }); advanceWorld(w, 350)
    expect(w.pete.trappedBy).toBe(1)
    const end = w.webs.patches[0].expiresAtMs
    advanceWorld(w, end - w.timeMs)
    expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.ignoredWebs).toEqual([2])
    advanceWorld(w, 50); expect(w.pete.mode).toBe('WANDERING'); expect(w.pete.ignoredWebs).toEqual([])
  })
  it('directly scares wandering and trapped Pete without another collision or a ground patch', () => {
    const w = trapped(), original = structuredClone(w.webs), position = { x: w.pete.x, y: w.pete.y }
    expect(shootWeb(w, { x: position.x + .75, y: position.y })).toBe('hit')
    expect(w.pete.mode).toBe('FLEEING'); expect(w.pete.trappedBy).toBeNull(); expect(w.pete.ignoredWebs).toContain(1)
    expect(w.pete.x).toBe(position.x); expect(w.pete.y).toBe(position.y); expect(w.webs).toEqual(original)
    advanceWorld(w, 50); expect(w.pete.mode).toBe('FLEEING')
    until(w, 'CRYING'); advanceWorld(w, 9950); expect(w.pete.mode).toBe('CRYING')
    advanceWorld(w, 50); expect(w.pete.mode).toBe('WANDERING')
    expect(shootWeb(w, w.pete)).toBe('hit'); expect(w.pete.mode).toBe('FLEEING')
  })
  it('keeps direct repeated fleeing/crying hits visual only', () => {
    const w = corridor(); clickPete(w, w.pete); advanceWorld(w, 50)
    const before = structuredClone(w.pete)
    shootWeb(w, w.pete); expect(w.pete).toEqual({ ...before, webMs: 700 })
    until(w, 'CRYING'); const cry = w.pete.cryingMs
    shootWeb(w, w.pete); expect(w.pete.cryingMs).toBe(cry)
  })
  it('bounds ground effects without evicting an existing trap or preventing direct release', () => {
    const w = trapped()
    for (let i = 1; i < MAX_GROUND_WEBS; i++) expect(shootWeb(w, { x: 0, y: 0 })).toBe('ground')
    const before = structuredClone(w.webs)
    expect(shootWeb(w, { x: 1, y: 0 })).toBe('full'); expect(w.webs).toEqual(before)
    expect(shootWeb(w, w.pete)).toBe('hit'); expect(w.pete.mode).toBe('FLEEING')
  })
  it('matches different elapsed-time partitions and never launches sabotage while trapped', () => {
    const a = trapped(); placeBuilding(a, 19, 23, 'furnace', 'east')
    const b = structuredClone(a)
    advanceWorld(a, 7900)
    for (let i = 0; i < 79; i++) { advanceWorld(b, 17); advanceWorld(b, 83) }
    expect(b.pete).toEqual(a.pete); expect(b.webs).toEqual(a.webs)
    expect(b.pete.mode).toBe('TRAPPED'); expect(b.pete.pumpkin).toBeNull(); expect(b.buildings[939 + 0]?.sabotageUntilMs).toBeUndefined()
  })
})
describe('trap, police and sprinkler transition safety', () => {
  it('arrests trapped Pete and clears his trap reference, then preserves prison release rules', () => {
    const w = trapped()
    placeBuilding(w, 18, 22, 'radar', 'east'); placeBuilding(w, 19, 22, 'powerPole', 'east'); placeBuilding(w, 19, 21, 'generator', 'east')
    until(w, 'ARRESTED'); expect(w.pete.trappedBy).toBeNull()
    const before = structuredClone(w.pete)
    shootWeb(w, w.pete); expect(w.pete).toEqual(before)
    until(w, 'IMPRISONED'); expect(w.pete.trappedBy).toBeNull()
    const prison = w.pete.prison!, at = w.pete.imprisonedAtMs!, clock = w.pete.cooldownMs
    shootWeb(w, w.pete); expect(w.pete.mode).toBe('IMPRISONED')
    expect(releasePete(w, prison.y * SIZE + prison.x, at)).toBe(true); expect(w.pete.cooldownMs).toBe(clock)
  })
  it('does not interrupt water reactions and does not let sprinklers interrupt a trap', () => {
    const w = trapped()
    placeBuilding(w, 18, 22, 'sprinkler', 'east'); placeBuilding(w, 19, 22, 'powerPole', 'east'); placeBuilding(w, 19, 21, 'generator', 'east')
    advanceWorld(w, 50); expect(w.pete.mode).toBe('TRAPPED'); expect(w.pete.water).toBeNull()
    const water = createWorld(() => .5)
    placeBuilding(water, 18, 23, 'sprinkler', 'east'); placeBuilding(water, 18, 22, 'powerPole', 'east'); placeBuilding(water, 18, 21, 'generator', 'east')
    advanceWorld(water, 50); expect(water.pete.mode).toBe('SPRAYED')
    for (const delta of [0, 1000, 1000, 2000]) {
      advanceWorld(water, delta); const before = structuredClone(water.pete)
      expect(shootWeb(water, water.pete)).toBe('hit'); expect(water.pete).toEqual(before)
    }
  })
})
