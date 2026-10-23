import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { awardActivity, XP_THRESHOLDS } from '../simulation/personality'
import { createBareWorld } from '../simulation/testFixtures'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { drawPete } from './peteVisuals'
import { drawPeteOutfit, peteOutfit } from './peteOutfit'
import { drawWetPete } from './sprinklerVisuals'
import { drawRowboat } from './rowboatVisuals'
import { planRowboat } from '../simulation/rowboat'

function graphics() {
  const calls: { method: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push({ method: String(name), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}

describe('Industrial outfits', () => {
  it('adds gloves, workwear/helmet, reinforcement and magnate details cumulatively', () => {
    const { g, calls } = graphics()
    for (const level of [1, 2, 3, 4, 5] as const) {
      calls.length = 0
      drawPeteOutfit(g, { path: 'industrial', level }, 100, 100, 'back')
      expect(calls).toEqual([])
      drawPeteOutfit(g, { path: 'industrial', level }, 100, 100, 'front')
      if (level === 1) expect(calls).toEqual([])
      expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0xc89656)).toBe(level >= 2)
      expect(calls.some(c => c.method === 'fillRoundedRect' && c.args[1] === 78)).toBe(level >= 3)
      expect(calls.some(c => c.method === 'strokeRoundedRect')).toBe(level >= 4)
      expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x243e59)).toBe(level === 5)
    }
  })

  it('keeps accessories on the reaction anchor and scales the seated outfit without state writes', () => {
    const w = createBareWorld(() => .5), { g, calls } = graphics()
    awardActivity(w.personality, { path: 'industrial', xp: 450 })
    w.personality.dominant = 'industrial'
    w.pete.mode = 'WATER_FLEEING'; w.pete.next = w.pete.tile + 1; w.timeMs = 45
    const before = structuredClone(w)
    drawWetPete(g, w, 32)
    const x = (w.pete.x + .5) * 32, y = (w.pete.y + .5) * 32
    expect(calls).toContainEqual({ method: 'fillRoundedRect', args: [x - 19, y - 5 - Math.sin(45 / 70) * 4, 4, 5, 1] })
    expect(w).toEqual(before)
    for (let i = 11; i < 18; i++) w.water[10 * 40 + i] = true
    w.peace.boat = planRowboat(w, { kind: 'fishingDock', x: 10, y: 10, direction: 'east' })!
    expect(w.peace.boat).not.toBeNull()
    w.peace.boat.phase = 'rowing'
    const seated = structuredClone(w)
    calls.length = 0; drawRowboat(g, w, 32)
    expect(calls).toContainEqual({ method: 'scaleCanvas', args: [.65, .65] })
    expect(calls).toContainEqual({ method: 'fillRoundedRect', args: [-9 / .65 - 2, (5 + Math.sin(45 / 650) * 2) / .65 - 2, 4, 5, 1] })
    expect(calls.filter(c => c.method === 'save').length).toBe(calls.filter(c => c.method === 'restore').length)
    expect(w).toEqual(seated)
  })
  it.each([1, 2, 3, 4, 5])('selects and restores level %i independently of other paths', level => {
    const w = createBareWorld(() => .5), original = graphics()
    drawPete(original.g, w, 32)
    awardActivity(w.personality, { path: 'eco', xp: 450 })
    awardActivity(w.personality, { path: 'craftsman', xp: 450 })
    if (level > 1) awardActivity(w.personality, { path: 'industrial', xp: XP_THRESHOLDS[level - 1] })
    w.personality.dominant = 'industrial'
    expect(peteOutfit(w.personality)).toEqual({ path: 'industrial', level })
    const loaded = decodeSave(encodeSave(w, { scrollX: 0, scrollY: 0, zoom: 1.3, direction: 'east', powerOverlay: false })).world
    expect(peteOutfit(loaded.personality)).toEqual({ path: 'industrial', level })
    const a = graphics(), b = graphics()
    drawPete(a.g, w, 32); drawPete(b.g, loaded, 32)
    expect(b.calls).toEqual(a.calls)
    if (level === 1) expect(a.calls).toEqual(original.calls)
    expect(a.calls.some(c => c.method === 'fillStyle' && c.args[0] === 0xc89656)).toBe(level > 1)
    expect(a.calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x397444)).toBe(false)
  })

  it('changes tiers and switches paths without retaining accessories', () => {
    const w = createBareWorld(() => .5), { g, calls } = graphics()
    awardActivity(w.personality, { path: 'industrial', xp: 20 })
    w.personality.dominant = 'industrial'
    expect(peteOutfit(w.personality).level).toBe(2)
    awardActivity(w.personality, { path: 'industrial', xp: 430 })
    expect(peteOutfit(w.personality).level).toBe(5)
    for (const path of ['industrial', 'eco', 'craftsman', 'inventor', 'industrial'] as const) {
      w.personality.dominant = path
      calls.length = 0; drawPete(g, w, 32)
      expect(calls.some(c => c.method === 'fillStyle' && c.args[0] === 0x243e59)).toBe(path === 'industrial')
    }
  })
})
