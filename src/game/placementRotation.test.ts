import { expect, it } from 'vitest'
import { PlacementRotation, rotationBuilding } from './placementRotation'
import { createUnlockedWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import { PLAYER_TOOLS } from '../state/toolMetadata'
const tile = { x: 10, y: 10 }, origin = { x: 300, y: 200 }

it('applies only to directional single-placement tools', () => {
  expect(PLAYER_TOOLS.filter(t => rotationBuilding(t.tool)).map(t => t.tool)).toEqual(['miner', 'furnace', 'waterwheel', 'assembler', 'inserter', 'splitter'])
  expect(rotationBuilding(null)).toBe(false)
})
it.each(['east', 'south', 'west', 'north'] as const)('keeps preset %s on a short click, without building before release', direction => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation(), before = structuredClone(world)
  gesture.begin(world, tile, origin, 'furnace', direction)
  gesture.move({ x: 323.99, y: 200 })
  expect(gesture.preview()).toMatchObject({ ...tile, direction, info: { state: 'valid' } })
  expect(world).toEqual(before)
  expect(gesture.finish(world)).toEqual({ kind: 'furnace', error: null })
  expect(world.buildings[410]).toMatchObject({ kind: 'furnace', ...tile, direction })
  expect(gesture.finish(world)).toBeNull()
  expect(world.nature).toEqual(before.nature)
})
it.each([
  [24, 0, 'east'], [0, 24, 'south'], [-24, 0, 'west'], [0, -24, 'north'],
  [40, 25, 'east'], [-25, -40, 'north'], [17, 17, 'east'],
] as const)('uses screen drag (%s,%s) for %s and keeps the original tile', (dx, dy, direction) => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation()
  gesture.begin(world, tile, origin, 'inserter', 'west')
  gesture.move({ x: origin.x + dx, y: origin.y + dy })
  expect(gesture.preview()).toMatchObject({ ...tile, direction, info: { state: 'valid' } })
  expect(world.buildings.filter(Boolean)).toHaveLength(0)
  gesture.finish(world)
  expect(world.buildings[410]).toMatchObject({ kind: 'inserter', ...tile, direction })
  expect(world.buildings.filter(Boolean)).toHaveLength(1)
})
it('uses radial threshold and live dominant direction after activation', () => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation()
  gesture.begin(world, tile, origin, 'splitter', 'west')
  gesture.move({ x: 316, y: 216 }); expect(gesture.preview()?.direction).toBe('west')
  gesture.move({ x: 330, y: 201 }); expect(gesture.preview()?.direction).toBe('east')
  gesture.move({ x: 301, y: 240 }); expect(gesture.preview()?.direction).toBe('south')
  gesture.move(origin); expect(gesture.preview()?.direction).toBe('south')
})
it('supports keyboard rotation without an unchanged pointer overriding it', () => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation()
  gesture.begin(world, tile, origin, 'assembler', 'east')
  gesture.move({ x: 300, y: 230 })
  gesture.setDirection('west')
  gesture.move({ x: 300, y: 230 })
  expect(gesture.preview()?.direction).toBe('west')
  gesture.finish(world)
  expect(world.buildings[410]).toMatchObject({ direction: 'west' })
})
it.each(['storage', 'water', 'research', 'ore'] as const)('rejects %s conflicts without resource consumption', conflict => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation()
  if (conflict === 'storage') placeBuilding(world, 10, 10, 'storage', 'east')
  if (conflict === 'water') world.water[410] = true
  if (conflict === 'research') world.research.unlocked = ['basicIndustry']
  if (conflict === 'ore') world.tiles[410] = null
  const before = structuredClone(world)
  gesture.begin(world, tile, origin, conflict === 'ore' ? 'miner' : 'assembler', 'east')
  gesture.move({ x: 300, y: 230 })
  expect(gesture.preview()?.info.state).toBe('invalid')
  expect(gesture.finish(world)?.error).toBeTruthy()
  expect(world).toEqual(before)
})
it('revalidates live occupancy on release and consumes the failed gesture', () => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation()
  gesture.begin(world, tile, origin, 'furnace', 'east')
  expect(gesture.preview()?.info.state).toBe('valid')
  placeBuilding(world, 10, 10, 'storage', 'east')
  const before = structuredClone(world)
  expect(gesture.finish(world)?.error).toBeTruthy()
  expect(gesture.finish(world)).toBeNull()
  expect(world).toEqual(before)
})
it('cancels safely and cannot replay into a replacement world', () => {
  const world = createUnlockedWorld(), gesture = new PlacementRotation(), before = structuredClone(world)
  gesture.begin(world, tile, origin, 'furnace', 'east')
  gesture.cancel(); gesture.move({ x: 330, y: 200 })
  expect(gesture.active).toBe(false)
  expect(gesture.preview()).toBeNull()
  expect(gesture.finish(world)).toBeNull()
  gesture.begin(world, tile, origin, 'furnace', 'east')
  const replacement = structuredClone(world)
  expect(gesture.finish(replacement)).toBeNull()
  expect(world).toEqual(before); expect(replacement).toEqual(before)
})
