import type { Building, World } from './world'
import type { Resource } from './items'

export const SIZE = 40
export const INTERVAL = 1000
export const DIRECTIONS = ['north', 'east', 'south', 'west'] as const
export type Direction = typeof DIRECTIONS[number]
export interface Position { x: number; y: number }
export const offsets: Record<Direction, Position> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
}
export function rotate(direction: Direction): Direction {
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + 1) % 4]
}
export function opposite(direction: Direction): Direction { return rotate(rotate(direction)) }
export function inside(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE
}
export function buildingAt(world: World, x: number, y: number): Building | null {
  return inside(x, y) ? world.buildings[y * SIZE + x] : null
}
export function depositAt(world: World, x: number, y: number): Resource | null {
  return inside(x, y) ? world.tiles[y * SIZE + x] : null
}
