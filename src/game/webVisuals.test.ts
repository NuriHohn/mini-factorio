import { createUnlockedWorld } from '../simulation/testFixtures'
import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { WebVisuals } from './webVisuals'
import { drawPete } from './peteVisuals'
import { shootWeb } from '../factory/webSystem'
import { placeBuilding } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
function graphics() {
  const calls = { lineStyle: vi.fn(), lineBetween: vi.fn(), strokeEllipse: vi.fn(), strokeCircle: vi.fn(), fillEllipse: vi.fn(), fillStyle: vi.fn(), fillTriangle: vi.fn(), fillCircle: vi.fn(), fillRect: vi.fn() }
  for (const fn of Object.values(calls)) fn.mockReturnValue(calls)
  return { calls, g: calls as unknown as Phaser.GameObjects.Graphics, clear: () => { for (const fn of Object.values(calls)) fn.mockClear() } }
}
describe('web rendering lifecycle', () => {
  it('renders flight, persistent ground web, then a short fade without changing simulation', () => {
    const w = createUnlockedWorld(() => .5), visuals = new WebVisuals(), { g, calls, clear } = graphics()
    shootWeb(w, { x: 0, y: 0 }); advanceWorld(w, 150)
    const before = structuredClone(w)
    visuals.draw(g, w, 32); expect(calls.lineBetween).toHaveBeenCalled(); expect(w).toEqual(before)
    advanceWorld(w, 150); clear(); visuals.draw(g, w, 32)
    expect(calls.strokeEllipse).toHaveBeenCalledWith(16, 19, 14 * 1.8, 14 * 1.15)
    advanceWorld(w, 10000); clear(); visuals.draw(g, w, 32)
    expect(w.webs.patches).toHaveLength(0); expect(calls.lineBetween).toHaveBeenCalled()
    advanceWorld(w, 500); clear(); visuals.draw(g, w, 32)
    expect(calls.lineBetween).not.toHaveBeenCalled()
  })
  it('keeps offscreen expiry bookkeeping while culling geometry and Pete', () => {
    const w = createUnlockedWorld(() => .5), visuals = new WebVisuals(), { g, calls, clear } = graphics()
    shootWeb(w, { x: 0, y: 0 }); advanceWorld(w, 300)
    const far = { x: 5000, y: 5000, width: 100, height: 100 }
    visuals.draw(g, w, 32, far); drawPete(g, w, 32, far)
    expect(calls.lineBetween).not.toHaveBeenCalled(); expect(calls.fillEllipse).not.toHaveBeenCalled()
    visuals.draw(g, w, 32, { x: 0, y: 0, width: 100, height: 100 })
    expect(calls.lineBetween).toHaveBeenCalled()
    advanceWorld(w, 10000); clear(); visuals.draw(g, w, 32, far)
    advanceWorld(w, 500); clear(); visuals.draw(g, w, 32)
    expect(calls.lineBetween).not.toHaveBeenCalled()
  })
  it('does not retain cosmetic webs across world replacement', () => {
    const w = createUnlockedWorld(() => .5), visuals = new WebVisuals(), { g, calls, clear } = graphics()
    shootWeb(w, { x: 0, y: 0 }); advanceWorld(w, 300); visuals.draw(g, w, 32)
    clear(); visuals.draw(g, createUnlockedWorld(() => .5), 32)
    expect(calls.lineBetween).not.toHaveBeenCalled()
  })
  it('draws a surprised struggling trapped Pete and keeps authoritative timers untouched', () => {
    const w = createUnlockedWorld(() => .5), { g, calls } = graphics()
    for (const [x, y] of [[16, 23], [17, 22], [17, 24]]) placeBuilding(w, x, y, 'storage', 'east')
    shootWeb(w, { x: 18, y: 23 }); advanceWorld(w, 400)
    expect(w.pete.mode).toBe('TRAPPED')
    const before = structuredClone(w)
    drawPete(g, w, 32)
    expect(calls.strokeCircle).toHaveBeenCalled(); expect(calls.strokeEllipse).toHaveBeenCalled()
    expect(w).toEqual(before)
  })
})
