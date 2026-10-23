import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { awardActivity, PERSONALITY_PATHS, XP_THRESHOLDS } from '../simulation/personality'
import { createBareWorld } from '../simulation/testFixtures'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { drawPete } from './peteVisuals'
import { drawPeteOutfit, peteOutfit } from './peteOutfit'

function graphics() {
  const calls: { method: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push({ method: String(name), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}

describe('progressive Pete outfits', () => {
  it.each([1, 2, 3, 4, 5])('selects and restores Craftsman level %i independently of Eco progress', level => {
    const w = createBareWorld(() => .5), original = graphics()
    drawPete(original.g, w, 32)
    awardActivity(w.personality, { path: 'eco', xp: 450 })
    if (level > 1) awardActivity(w.personality, { path: 'craftsman', xp: XP_THRESHOLDS[level - 1] })
    w.personality.dominant = 'craftsman'
    expect(peteOutfit(w.personality)).toEqual({ path: 'craftsman', level })
    const loaded = decodeSave(encodeSave(w, { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east', powerOverlay: false })).world
    expect(peteOutfit(loaded.personality)).toEqual({ path: 'craftsman', level })
    const a = graphics(), b = graphics()
    drawPete(a.g, w, 32); drawPete(b.g, loaded, 32)
    expect(b.calls).toEqual(a.calls)
    if (level === 1) expect(a.calls).toEqual(original.calls)
    expect(a.calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x397444)).toBe(false)
    expect(a.calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x513a2b)).toBe(level > 1)
  })

  it('switches between both outfits and remaining personalities without stale accessories', () => {
    const w = createBareWorld(() => .5), { g, calls } = graphics()
    awardActivity(w.personality, { path: 'eco', xp: 200 })
    awardActivity(w.personality, { path: 'craftsman', xp: 80 })
    for (const path of ['eco', 'craftsman', 'inventor', 'industrial', 'craftsman', 'eco'] as const) {
      w.personality.dominant = path
      calls.length = 0
      drawPete(g, w, 32)
      const colors = calls.filter(c => c.method === 'fillStyle').map(c => c.args[0])
      expect(colors.includes(0x397444)).toBe(path === 'eco')
      expect(colors.includes(0x513a2b)).toBe(path === 'craftsman')
      expect(peteOutfit(w.personality).level).toBe(path === 'eco' ? 4 : path === 'craftsman' ? 3 : 1)
    }
    w.personality.dominant = 'craftsman'
    awardActivity(w.personality, { path: 'craftsman', xp: 370 })
    expect(peteOutfit(w.personality)).toEqual({ path: 'craftsman', level: 5 })
    calls.length = 0; drawPete(g, w, 32)
    expect(calls).toContainEqual({ method: 'fillStyle', args: [0xe6bd68] })
  })

  it('builds Craftsman tiers cumulatively with no back-pass geometry or level-one changes', () => {
    const { g, calls } = graphics()
    for (const level of [1, 2, 3, 4, 5] as const) {
      calls.length = 0
      drawPeteOutfit(g, { path: 'craftsman', level }, 100, 100, 'back')
      expect(calls).toEqual([])
      drawPeteOutfit(g, { path: 'craftsman', level }, 100, 100, 'front')
      if (level === 1) expect(calls).toEqual([])
      expect(calls.some(c => c.method === 'fillRoundedRect' && c.args[0] === 92 && c.args[2] === 16)).toBe(level >= 2)
      expect(calls.some(c => c.method === 'lineBetween' && c.args[0] === 109)).toBe(level >= 3)
      expect(calls.some(c => c.method === 'strokeRoundedRect')).toBe(level >= 4)
      expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0xe6bd68)).toBe(level === 5)
    }
  })
  it.each([1, 2, 3, 4, 5])('selects Eco level %i directly from existing progression', level => {
    const w = createBareWorld(() => .5)
    if (level > 1) awardActivity(w.personality, { path: 'eco', xp: XP_THRESHOLDS[level - 1] })
    expect(peteOutfit(w.personality)).toEqual({ path: 'eco', level })
    const loaded = decodeSave(encodeSave(w, { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east', powerOverlay: false })).world
    expect(peteOutfit(loaded.personality)).toEqual({ path: 'eco', level })
    const a = graphics(), b = graphics()
    drawPete(a.g, w, 32); drawPete(b.g, loaded, 32)
    expect(b.calls).toEqual(a.calls)
  })

  it.each(PERSONALITY_PATHS.filter(path => path !== 'eco' && path !== 'craftsman'))('keeps %s unchanged even with legendary Eco progress', path => {
    const w = createBareWorld(() => .5), original = graphics(), other = graphics()
    drawPete(original.g, w, 32)
    w.personality.paths.eco.level = 5
    w.personality.dominant = path
    w.personality.paths[path].level = 5
    expect(peteOutfit(w.personality).level).toBe(1)
    drawPete(other.g, w, 32)
    expect(other.calls).toEqual(original.calls)
  })

  it('updates on level/dominance changes and returns without stale accessory commands', () => {
    const w = createBareWorld(() => .5), { g, calls } = graphics()
    const render = () => { calls.length = 0; drawPete(g, w, 32); return calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x397444) }
    expect(render()).toBe(false)
    awardActivity(w.personality, { path: 'eco', xp: 20 })
    expect(render()).toBe(true)
    for (let n = 0; n < 3; n++) awardActivity(w.personality, { path: 'craftsman', xp: 1 })
    expect(w.personality.dominant).toBe('craftsman')
    expect(render()).toBe(false)
    for (let n = 0; n < 4; n++) awardActivity(w.personality, { path: 'eco', xp: 120 })
    expect(peteOutfit(w.personality)).toEqual({ path: 'eco', level: 5 })
    expect(render()).toBe(true)
  })

  it('draws cumulative tiers, a restrained back glow, and no level-one geometry', () => {
    const { g, calls } = graphics()
    drawPeteOutfit(g, { path: 'eco', level: 1 }, 100, 100, 'back'); drawPeteOutfit(g, { path: 'eco', level: 1 }, 100, 100, 'front')
    expect(calls).toEqual([])
    for (const level of [2, 3, 4, 5] as const) {
      calls.length = 0
      drawPeteOutfit(g, { path: 'eco', level }, 100, 100, 'back'); drawPeteOutfit(g, { path: 'eco', level }, 100, 100, 'front')
      const colors = calls.filter(c => c.method === 'fillStyle').map(c => c.args[0])
      expect(colors.includes(0x397444)).toBe(true)
      expect(colors.includes(0xe4c680)).toBe(level >= 3)
      expect(colors.includes(0xf0ceba)).toBe(level >= 4)
      expect(colors.includes(0xbce58b)).toBe(level === 5)
    }
  })

  it.each(['eco', 'craftsman'] as const)('follows the moving %s pose/bob without modifying authoritative world state', path => {
    const w = createBareWorld(() => .5), { g, calls } = graphics()
    awardActivity(w.personality, { path, xp: 450 })
    w.pete.next = w.pete.tile + 1
    w.timeMs = 95
    w.pete.x += .25
    const before = structuredClone(w)
    drawPete(g, w, 32)
    const x = (w.pete.x + .5) * 32, y = (w.pete.y + .5) * 32 + Math.sin(1) * 1.5
    if (path === 'eco') expect(calls).toContainEqual({ method: 'fillTriangle', args: [x - 7, y + 3, x + 7, y + 3, x, y + 8] })
    else expect(calls).toContainEqual({ method: 'fillRoundedRect', args: [x - 8, y + 6, 16, 3, 1] })
    expect(w).toEqual(before)
  })
})
