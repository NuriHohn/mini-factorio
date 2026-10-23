import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { awardActivity, XP_THRESHOLDS } from '../simulation/personality'
import { createBareWorld } from '../simulation/testFixtures'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { drawPete } from './peteVisuals'
import { drawPeteOutfit, peteOutfit } from './peteOutfit'

function graphics() {
  const calls: { method: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push({ method: String(name), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}

describe('Inventor outfits', () => {
  it.each([1, 2, 3, 4, 5])('selects and restores level %i independently of other paths', level => {
    const w = createBareWorld(() => .5), original = graphics()
    drawPete(original.g, w, 32)
    awardActivity(w.personality, { path: 'eco', xp: 450 })
    awardActivity(w.personality, { path: 'craftsman', xp: 450 })
    if (level > 1) awardActivity(w.personality, { path: 'inventor', xp: XP_THRESHOLDS[level - 1] })
    w.personality.dominant = 'inventor'
    expect(peteOutfit(w.personality)).toEqual({ path: 'inventor', level })
    const loaded = decodeSave(encodeSave(w, { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east', powerOverlay: false })).world
    expect(peteOutfit(loaded.personality)).toEqual({ path: 'inventor', level })
    const a = graphics(), b = graphics()
    drawPete(a.g, w, 32); drawPete(b.g, loaded, 32)
    expect(b.calls).toEqual(a.calls)
    if (level === 1) expect(a.calls).toEqual(original.calls)
    expect(a.calls.some(c => c.method === 'fillStyle' && c.args[0] === 0xb9e1df)).toBe(level > 1)
    expect(a.calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x397444)).toBe(false)
  })

  it('layers goggles, tools, backpack and legendary details cumulatively', () => {
    const { g, calls } = graphics()
    for (const level of [1, 2, 3, 4, 5] as const) {
      calls.length = 0
      drawPeteOutfit(g, { path: 'inventor', level }, 100, 100, 'back')
      expect(calls.length > 0).toBe(level >= 4)
      expect(calls.some(c => c.method === 'fillRoundedRect' && c.args[0] === 88)).toBe(level >= 4)
      drawPeteOutfit(g, { path: 'inventor', level }, 100, 100, 'front')
      if (level === 1) expect(calls).toEqual([])
      expect(calls.some(c => c.method === 'strokeEllipse')).toBe(level >= 2)
      expect(calls.some(c => c.method === 'fillRect' && c.args[0] === 92 && c.args[1] === 107)).toBe(level >= 3)
      expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x83dae0)).toBe(level === 5)
    }
  })

  it('changes tiers and switches paths without retaining accessories', () => {
    const w = createBareWorld(() => .5), { g, calls } = graphics()
    awardActivity(w.personality, { path: 'inventor', xp: 20 })
    w.personality.dominant = 'inventor'
    expect(peteOutfit(w.personality).level).toBe(2)
    awardActivity(w.personality, { path: 'inventor', xp: 430 })
    expect(peteOutfit(w.personality).level).toBe(5)
    for (const path of ['inventor', 'eco', 'craftsman', 'industrial', 'inventor'] as const) {
      w.personality.dominant = path
      calls.length = 0; drawPete(g, w, 32)
      expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x83dae0)).toBe(path === 'inventor')
    }
  })
})
