import { describe, expect, it } from 'vitest'
import { cameraViewport, intersects, visiblePoint, visibleTileBounds } from './viewport'
import { createWorld } from '../simulation/world'
import { NatureVisuals } from './natureVisuals'
import { paintLandscape } from '../simulation/nature'
import type Phaser from 'phaser'
it('bounds tile iteration across panning, zoomed views and outside-map cameras', () => {
  expect(visibleTileBounds({ x: 320, y: 320, width: 320, height: 160 }, 32)).toEqual({ left: 8, top: 8, right: 22, bottom: 17 })
  expect(visibleTileBounds({ x: -800, y: -800, width: 3000, height: 3000 }, 32)).toEqual({ left: 0, top: 0, right: 39, bottom: 39 })
  const off = visibleTileBounds({ x: 1600, y: 1600, width: 100, height: 100 }, 32)
  expect(off.left).toBeGreaterThan(off.right)
})
it('keeps boundary objects, large effects and wires crossing the viewport', () => {
  const v = { x: 100, y: 100, width: 100, height: 100 }
  expect(intersects(v, 0, 150, 400, 0)).toBe(true)
  expect(visiblePoint(v, 50, 150, 50)).toBe(true)
  expect(visiblePoint(v, 49, 150, 50)).toBe(false)
  expect(visiblePoint(undefined, 9999, 9999, 0)).toBe(true)
})
describe('decoration viewport cache', () => {
  it('culls offscreen decoration and invalidates for camera, landscape, occupancy and world changes', () => {
    const world = createWorld(() => .5, { nature: false, water: false }), visuals = new NatureVisuals(), calls: string[] = []
    const g = new Proxy({}, { get: (_t, key) => () => { calls.push(String(key)); return g } }) as Phaser.GameObjects.Graphics
    paintLandscape(world, { x: 5, y: 5 }, { x: 5, y: 5 }, 'flowers', 1)
    const near = { x: 128, y: 128, width: 96, height: 96 }, far = { x: 900, y: 900, width: 96, height: 96 }
    visuals.drawDecorations(g, world, 32, far); expect(calls).toEqual(['clear'])
    calls.length = 0; visuals.drawDecorations(g, world, 32, far); expect(calls).toEqual([])
    visuals.drawDecorations(g, world, 32, near); expect(calls).toContain('fillCircle')
    calls.length = 0; visuals.drawDecorations(g, world, 32, near); expect(calls).toEqual([])
    world.nature.decorationRevision++; visuals.drawDecorations(g, world, 32, near); expect(calls[0]).toBe('clear')
    calls.length = 0; world.topologyRevision++; visuals.drawDecorations(g, world, 32, near); expect(calls[0]).toBe('clear')
    calls.length = 0; visuals.drawDecorations(g, createWorld(() => .5, { nature: false, water: false }), 32, near); expect(calls).toEqual(['clear'])
  })
})

it('derives the current zoom/pan before Phaser preRender updates worldView', () => {
  expect(cameraViewport({ scrollX: 100, scrollY: 50, width: 800, height: 600, zoom: 2 })).toEqual({ x: 300, y: 200, width: 400, height: 300 })
  expect(cameraViewport({ scrollX: 100, scrollY: 50, width: 800, height: 600, zoom: .5 })).toEqual({ x: -300, y: -250, width: 1600, height: 1200 })
})
