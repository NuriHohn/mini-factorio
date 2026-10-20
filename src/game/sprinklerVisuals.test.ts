import { createUnlockedWorld } from '../simulation/testFixtures'
import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { WaterVisuals, drawSprinkler, drawWetPete } from './sprinklerVisuals'
import { placeBuilding, removeBuilding } from '../simulation/world'
import type { Sprinkler } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
function graphics() {
  const calls = { fillStyle: vi.fn(), fillEllipse: vi.fn(), fillCircle: vi.fn(), fillRect: vi.fn(), lineStyle: vi.fn(), lineBetween: vi.fn(), strokeEllipse: vi.fn(), fillTriangle: vi.fn(), fillRoundedRect: vi.fn(), strokeRoundedRect: vi.fn() }
  for (const fn of Object.values(calls)) fn.mockReturnValue(calls)
  return { calls, g: calls as unknown as Phaser.GameObjects.Graphics, clear: () => { for (const fn of Object.values(calls)) fn.mockClear() } }
}
function setup() {
  const world = createUnlockedWorld(() => .5)
  placeBuilding(world, 18, 23, 'sprinkler', 'east'); placeBuilding(world, 18, 22, 'powerPole', 'east'); placeBuilding(world, 18, 21, 'generator', 'east')
  advanceWorld(world, 350)
  return world
}
describe('bounded cosmetic sprinkler rendering', () => {
  it('aims a visible connected water jet at Pete and suppresses it without power', () => {
    const w = setup(), visual = new WaterVisuals(), { g, calls, clear } = graphics()
    const before = structuredClone(w)
    drawSprinkler(g, w, w.buildings[938] as Sprinkler, 32)
    visual.draw(g, w, 32); drawWetPete(g, w, 32)
    expect(calls.lineBetween.mock.calls.length).toBeGreaterThan(12)
    expect(calls.fillStyle).toHaveBeenCalledWith(0xc4f5ff, .9)
    expect(w).toEqual(before)
    removeBuilding(w, 18, 21); advanceWorld(w, 50); clear(); visual.draw(g, w, 32)
    expect(calls.lineBetween).not.toHaveBeenCalled()
    expect(w.pete.mode).toBe('SPRAYED')
  })
  it('renders slip splashes and a complaint bubble without changing the world', () => {
    const w = setup(), visual = new WaterVisuals(), { g, calls, clear } = graphics()
    advanceWorld(w, 1000); const before = structuredClone(w)
    visual.draw(g, w, 32); drawWetPete(g, w, 32)
    expect(calls.strokeEllipse).toHaveBeenCalled(); expect(w).toEqual(before)
    advanceWorld(w, 1000); clear(); drawWetPete(g, w, 32)
    expect(calls.fillRoundedRect).toHaveBeenCalled()
  })
  it('bounds puddles, expires them after five seconds and clears them when a loaded world replaces the old world', () => {
    const w = setup(), visual = new WaterVisuals(), { g, calls, clear } = graphics()
    advanceWorld(w, 4000)
    for (let i = 0; i < 18; i++) {
      visual.draw(g, w, 32); advanceWorld(w, 400); clear()
    }
    visual.draw(g, w, 32)
    expect(calls.fillEllipse.mock.calls.length).toBeLessThanOrEqual(14)
    expect(calls.fillEllipse.mock.calls.length).toBeGreaterThan(0)
    advanceWorld(w, 6000); clear(); visual.draw(g, w, 32)
    expect(calls.fillEllipse).not.toHaveBeenCalled()
    clear(); visual.draw(g, createUnlockedWorld(() => .5), 32)
    expect(calls.fillEllipse).not.toHaveBeenCalled()
  })
})
