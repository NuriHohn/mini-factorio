import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawFootbridge } from './footbridgeVisuals'
it.each(['east', 'south'] as const)('draws distinct static wooden planks along %s without modifying the building', direction => {
  const calls: string[] = []
  const g = new Proxy({}, { get: (_t, key) => () => { calls.push(String(key)); return g } }) as Phaser.GameObjects.Graphics
  const b = { kind: 'footbridge' as const, x: 10, y: 10, direction }, before = structuredClone(b)
  drawFootbridge(g, b, 32)
  expect(b).toEqual(before)
  expect(calls.filter(c => c === 'lineBetween').length).toBeGreaterThan(10)
  expect(calls.filter(c => c === 'save')).toHaveLength(1)
  expect(calls.filter(c => c === 'restore')).toHaveLength(1)
  expect(calls.includes('rotateCanvas')).toBe(direction === 'south')
})
