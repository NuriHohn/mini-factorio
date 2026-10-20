import { createUnlockedWorld } from '../simulation/testFixtures'
import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { drawSabotage } from './peteVisuals'
import { placeBuilding, removeBuilding } from '../simulation/world'

describe('pumpkin mush and slime rendering lifecycle', () => {
  it('renders for the full disable duration, follows position, and leaves no effects after expiry/deletion', () => {
    const world = createUnlockedWorld(() => .5)
    placeBuilding(world, 22, 20, 'furnace', 'east')
    const building = world.buildings[822]!
    building.sabotageUntilMs = 10000
    const graphics = { fillStyle: vi.fn(), fillRoundedRect: vi.fn(), fillEllipse: vi.fn(), fillCircle: vi.fn() }
    for (const fn of Object.values(graphics)) fn.mockReturnValue(graphics)
    const g = graphics as unknown as Phaser.GameObjects.Graphics
    drawSabotage(g, world, building, 32)
    expect(graphics.fillEllipse).toHaveBeenCalledWith(717, 654, 21, 13)
    expect(graphics.fillStyle).toHaveBeenCalledWith(0xf68b25)
    expect(graphics.fillStyle).toHaveBeenCalledWith(0x79df49)
    for (const fn of Object.values(graphics)) fn.mockClear()
    world.timeMs = 9950; drawSabotage(g, world, building, 32)
    expect(graphics.fillCircle).toHaveBeenCalled()
    for (const fn of Object.values(graphics)) fn.mockClear()
    world.timeMs = 10000; drawSabotage(g, world, building, 32)
    expect(graphics.fillStyle).not.toHaveBeenCalled()
    world.timeMs = 0; removeBuilding(world, 22, 20); drawSabotage(g, world, building, 32)
    expect(graphics.fillStyle).not.toHaveBeenCalled()
  })
})
