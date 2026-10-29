import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { RevengeVisuals } from './RevengeVisuals'
import { createWorld, placeBuilding } from '../simulation/world'
import { emptyInventory } from '../simulation/items'
import { changeFurnaceRecipe } from '../simulation/smelting'
import { advanceWorld } from '../simulation/step'
import { attackWalker, damageWalker, recordArrest } from '../factory/revengeSystem'
function renderer() {
  const calls: string[] = []
  const graphics = new Proxy({}, { get: (_target, key) => () => { calls.push(String(key)); return graphics } }) as Phaser.GameObjects.Graphics
  const labels: { destroy: ReturnType<typeof vi.fn>; setPosition: ReturnType<typeof vi.fn>; setText: ReturnType<typeof vi.fn> }[] = []
  const label = () => {
    const text = { setOrigin: () => text, setDepth: () => text, setPosition: vi.fn(() => text), setText: vi.fn(() => text), setAlpha: vi.fn(() => text), setVisible: vi.fn(() => text), destroy: vi.fn() }
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
    visuals.impact(impact, world)
    const before = structuredClone(world)
    visuals.draw(graphics, world, 32, scene)
    expect(world).toEqual(before)
    expect(calls).toContain('fillEllipse')
    expect(scene.add.text).toHaveBeenCalledTimes(2)
    advanceWorld(world, 1000)
    world.research.unlocked.push('revengeDefense1', 'revengeDefense2')
    const hit = attackWalker(world, 'lightningBeam', world.revenge.boss!)!
    visuals.impact(hit, world)
    expect(scene.cameras.main.shake).not.toHaveBeenCalled()
    damageWalker(world, 20); visuals.draw(graphics, world, 32, scene)
    advanceWorld(world, 1500)
    const stomp = structuredClone(world)
    visuals.draw(graphics, world, 32, scene); visuals.draw(graphics, world, 32, scene)
    expect(scene.cameras.main.shake).not.toHaveBeenCalled()
    expect(world).toEqual(stomp)
    damageWalker(world, 100); advanceWorld(world, 1000)
    visuals.draw(graphics, world, 32, scene)
    expect(calls).toContain('fillRoundedRect')
    advanceWorld(world, 1000); visuals.draw(graphics, world, 32, scene)
    expect(world.revenge.stage).toBe('stunned')
    visuals.destroy()
    expect(labels.every(text => text.destroy.mock.calls.length > 0)).toBe(true)
  })
  it('culls offscreen walker geometry and still expires hidden impacts without replay', () => {
    const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, calls, labels } = renderer()
    for (let i = 0; i < 3; i++) recordArrest(world)
    advanceWorld(world, 5000)
    const far = { x: 5000, y: 5000, width: 100, height: 100 }
    const before = structuredClone(world)
    visuals.draw(graphics, world, 32, scene, far)
    expect(calls).toHaveLength(0); expect(world).toEqual(before)
    const boss = world.revenge.boss!
    const near = { x: boss.x * 32 - 64, y: boss.y * 32 - 64, width: 160, height: 160 }
    visuals.draw(graphics, world, 32, scene, near)
    expect(calls).toContain('fillEllipse')
    const impact = attackWalker(world, 'flySwatter', boss)!
    visuals.impact(impact, world); visuals.draw(graphics, world, 32, scene, near)
    const label = labels.at(-1)!
    visuals.draw(graphics, world, 32, scene, far)
    advanceWorld(world, 1250); visuals.draw(graphics, world, 32, scene, far)
    expect(label.destroy).toHaveBeenCalledOnce()
    const count = labels.length
    visuals.draw(graphics, world, 32, scene, far)
    expect(labels).toHaveLength(count)
  })
  it('marks the current machine even when the walker is offscreen and removes the mark with its target', () => {
    const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, calls } = renderer()
    for (let i = 0; i < 3; i++) recordArrest(world)
    advanceWorld(world, 5000)
    placeBuilding(world, 20, 20, 'furnace', 'east')
    world.revenge.boss!.target = 820
    const view = { x: 630, y: 630, width: 64, height: 64 }, before = structuredClone(world)
    visuals.draw(graphics, world, 32, scene, view)
    expect(calls.filter(c => c === 'strokeRoundedRect')).toHaveLength(1)
    expect(world).toEqual(before)
    world.revenge.boss!.target = null
    calls.length = 0
    visuals.draw(graphics, world, 32, scene, view)
    expect(calls).toHaveLength(0)
  })
  it('cleans up impact labels when loading another world', () => {
    const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, labels } = renderer()
    const miss = attackWalker(world, 'flySwatter', { x: 8, y: 8 })!
    visuals.impact(miss, world); visuals.draw(graphics, world, 32, scene)
    visuals.draw(graphics, createWorld(() => .5), 32, scene)
    expect(labels[0].destroy).toHaveBeenCalledOnce()
  })
  it.each(['flySwatter', 'drill', 'lightningBeam'] as const)('keeps %s hit/miss feedback distinct, bounded and frozen with simulation time', tool => {
    for (const hit of [true, false]) {
      const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, labels } = renderer()
      for (let i = 0; i < 3; i++) recordArrest(world)
      advanceWorld(world, 5000)
      world.research.unlocked.push('revengeDefense1', 'revengeDefense2')
      const impact = attackWalker(world, tool, hit ? world.revenge.boss! : { x: 20, y: 20 })!
      const before = structuredClone(world)
      visuals.impact(impact, world)
      visuals.draw(graphics, world, 32, scene)
      const label = vi.mocked(scene.add.text).mock.calls.find(call => String(call[2]) === (hit ? `−${impact.damage}` : '·'))
      expect(label).toBeDefined()
      const caption = labels.at(-1)!
      const position = caption.setPosition.mock.calls.at(-1)
      visuals.draw(graphics, world, 32, scene)
      expect(caption.setPosition.mock.calls.at(-1)).toEqual(position)
      expect(world).toEqual(before)
      expect(scene.cameras.main.shake).not.toHaveBeenCalled()
      advanceWorld(world, 1200); visuals.draw(graphics, world, 32, scene)
      expect(caption.destroy).toHaveBeenCalledOnce()
      visuals.destroy()
    }
  })
  it.each([false, true])('telegraphs only a productive EMP target (productive=%s) without changing attacks or simulation state', productive => {
    const world = createWorld(() => .5), visuals = new RevengeVisuals(), { graphics, scene, labels } = renderer()
    for (let i = 0; i < 3; i++) recordArrest(world)
    advanceWorld(world, 5000)
    const boss = world.revenge.boss!
    // An authoritative target supplies the presentation; rendering never dispatches an EMP.
    placeBuilding(world, 2, 0, 'furnace', 'east')
    if (productive) {
      changeFurnaceRecipe(world, 2, 0, 'ironSmelting')
      const furnace = world.buildings[2]
      if (furnace?.kind === 'furnace') furnace.job = { recipeId: 'ironSmelting', elapsedMs: 0, inputs: { ...emptyInventory(), iron: 1 }, outputs: { ...emptyInventory(), ironPlate: 1 } }
      world.power!.consumers[2] = { networkId: 0, requestedKw: 30, suppliedKw: 30, speedFraction: 1 }
    }
    boss.target = 2; boss.empAtMs = world.timeMs + (productive ? 1000 : -60000)
    const before = structuredClone(world)
    visuals.draw(graphics, world, 32, scene)
    expect(world).toEqual(before)
    expect(labels[0].setText).toHaveBeenCalledWith(productive ? 'ϟ' : '')
    expect(scene.cameras.main.shake).not.toHaveBeenCalled()
  })

})
