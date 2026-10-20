import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { RevengeVisuals } from './RevengeVisuals'
import { createWorld } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { attackWalker, damageWalker, recordArrest } from '../simulation/revenge'
function renderer() {
  const calls: string[] = []
  const graphics = new Proxy({}, { get: (_target, key) => () => { calls.push(String(key)); return graphics } }) as Phaser.GameObjects.Graphics
  const labels: { destroy: ReturnType<typeof vi.fn> }[] = []
  const label = () => {
    const text = { setOrigin: () => text, setDepth: () => text, setPosition: () => text, setText: () => text, setAlpha: () => text, destroy: vi.fn() }
    labels.push(text)
    return text
  }
  const scene = { add: { text: vi.fn(label) }, cameras: { main: { shake: vi.fn() } } } as unknown as Phaser.Scene
  return { graphics, scene, calls, labels }
}
describe('Revenge rendering stays observational', () => {
  it('draws walker, hit/miss feedback, stomp, breakdown/ejection and stun without mutating gameplay', () => {
    const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, calls, labels } = renderer()
    for (let i = 0; i < 3; i++) recordArrest(world)
    advanceWorld(world, 5000)
    const impact = attackWalker(world, 'flySwatter', { x: 10, y: 10 })!
    visuals.impact(impact, world, scene.cameras.main)
    const before = structuredClone(world)
    visuals.draw(graphics, world, 32, scene)
    expect(world).toEqual(before)
    expect(calls).toContain('fillEllipse')
    expect(scene.add.text).toHaveBeenCalledTimes(2)
    advanceWorld(world, 1000)
    world.research.unlocked.push('revengeDefense1', 'revengeDefense2')
    const hit = attackWalker(world, 'lightningBeam', world.revenge.boss!)!
    visuals.impact(hit, world, scene.cameras.main)
    expect(scene.cameras.main.shake).toHaveBeenCalledTimes(1)
    damageWalker(world, 20); visuals.draw(graphics, world, 32, scene)
    advanceWorld(world, 1500)
    const stomp = structuredClone(world)
    visuals.draw(graphics, world, 32, scene); visuals.draw(graphics, world, 32, scene)
    expect(scene.cameras.main.shake).toHaveBeenCalledTimes(2)
    expect(world).toEqual(stomp)
    damageWalker(world, 100); advanceWorld(world, 1000)
    visuals.draw(graphics, world, 32, scene)
    expect(calls).toContain('fillRoundedRect')
    advanceWorld(world, 1000); visuals.draw(graphics, world, 32, scene)
    expect(world.revenge.stage).toBe('stunned')
    visuals.destroy()
    expect(labels.every(text => text.destroy.mock.calls.length > 0)).toBe(true)
  })
  it('cleans up impact labels when loading another world', () => {
    const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, labels } = renderer()
    const miss = attackWalker(world, 'flySwatter', { x: 8, y: 8 })!
    visuals.impact(miss, world, scene.cameras.main); visuals.draw(graphics, world, 32, scene)
    visuals.draw(graphics, createWorld(() => .5), 32, scene)
    expect(labels[0].destroy).toHaveBeenCalledOnce()
  })
})
