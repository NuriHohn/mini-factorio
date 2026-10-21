import { describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { TerrainVisuals, drawTerrainTile } from './terrainVisuals'
import { createBareWorld } from '../simulation/testFixtures'
import { paintWater } from '../simulation/waterLandscaping'
import { shorelineCorners, shoreline } from '../simulation/waterTerrain'
import { placeBuilding } from '../simulation/world'
function sceneFixture() {
  const textures = new Map<string, object>(), images: { destroy: () => void }[] = []
  const calls: string[] = []
  const graphics = new Proxy({}, { get: (_t, name) => () => { calls.push(String(name)); return graphics } }) as Phaser.GameObjects.Graphics
  const scene = { add: {
    graphics: () => graphics,
    image: (_x: number, _y: number, key: string) => {
      let cleanup = () => {}
      const image = { setOrigin: () => image, setDepth: () => image, setVisible: () => image, once: (_event: string, fn: () => void) => { cleanup = fn }, destroy: () => { cleanup(); textures.delete(key) } }
      images.push(image); return image
    },
  }, textures: {
    createCanvas: vi.fn((key: string, width: number, height: number) => {
      const texture = { width, height, context: { clearRect: vi.fn() }, canvas: {}, refresh: vi.fn() }
      textures.set(key, texture); return texture
    }),
    remove: (key: string) => textures.delete(key),
  } } as unknown as Phaser.Scene
  return { scene, textures, calls, graphics }
}
const point = (x: number, y: number) => ({ x, y })
describe('rounded eight-neighbor shorelines', () => {
  it('classifies isolated tiles, channels, straight banks and convex corners', () => {
    const w = createBareWorld(() => .5)
    paintWater(w, point(5, 5), point(5, 5), 'water', 1)
    expect(shorelineCorners(w, 5, 5)).toEqual(['convex', 'convex', 'convex', 'convex'])
    paintWater(w, point(4, 5), point(6, 5), 'water', 1)
    expect(shoreline(w, 5, 5)).toBe(5)
    expect(shorelineCorners(w, 5, 5)).toEqual(['edge', 'edge', 'edge', 'edge'])
    expect(shorelineCorners(w, 4, 5)).toEqual(['convex', 'edge', 'edge', 'convex'])
  })
  it('derives concave bays from diagonal land and rounds them in the adjoining land tile', () => {
    const w = createBareWorld(() => .5)
    paintWater(w, point(5, 5), point(5, 5), 'water', 3)
    paintWater(w, point(4, 4), point(4, 4), 'land', 1)
    expect(shorelineCorners(w, 5, 5)[0]).toBe('concave')
    expect(shorelineCorners(w, 4, 4)[2]).toBe('inlet')
    const before = structuredClone(w), { graphics, calls } = sceneFixture()
    drawTerrainTile(graphics, w, 4, 4, 32)
    expect(calls).toContain('arc'); expect(calls).toContain('fillPath'); expect(w).toEqual(before)
    paintWater(w, point(4, 4), point(4, 4), 'water', 1)
    expect(shorelineCorners(w, 5, 5)[0]).toBe('open')
  })
  it('treats map boundaries as banks without wrapping diagonals to the opposite edge', () => {
    const w = createBareWorld(() => .5)
    paintWater(w, point(0, 0), point(0, 0), 'water', 1)
    expect(shoreline(w, 0, 0)).toBe(15)
    expect(shorelineCorners(w, 0, 0)).toEqual(['convex', 'convex', 'convex', 'convex'])
    expect(shorelineCorners(w, 39, 0)).toEqual(['land', 'land', 'land', 'land'])
  })
})
describe('local terrain texture invalidation', () => {
  it('retains cached terrain on no-ops/camera changes and rebuilds only edited chunks plus the diagonal halo', () => {
    const w = createBareWorld(() => .5), f = sceneFixture(), cache = new TerrainVisuals(f.scene, w)
    expect(cache.rebuilds).toBe(25); expect(f.textures.size).toBe(25)
    cache.update(); expect(cache.rebuilds).toBe(25)
    paintWater(w, point(3, 3), point(3, 3), 'water', 1); cache.update(); expect(cache.rebuilds).toBe(26)
    paintWater(w, point(3, 3), point(3, 3), 'water', 1); cache.update(); expect(cache.rebuilds).toBe(26)
    paintWater(w, point(7, 7), point(7, 7), 'water', 1); cache.update(); expect(cache.rebuilds).toBe(30)
    placeBuilding(w, 20, 20, 'miner', 'east'); cache.setVisible(false).setVisible(true); cache.update(); expect(cache.rebuilds).toBe(30)
    cache.destroy(); expect(f.textures.size).toBe(0)
    const replacement = new TerrainVisuals(f.scene, createBareWorld(() => .5))
    expect(replacement.rebuilds).toBe(25); expect(f.textures.size).toBe(25)
    replacement.destroy(); expect(f.textures.size).toBe(0)
  })
  it('cleans partial preparation failures without destroying the existing cache', () => {
    const f = sceneFixture(), old = new TerrainVisuals(f.scene, createBareWorld(() => .5))
    const original = f.scene.textures.createCanvas.bind(f.scene.textures)
    vi.spyOn(f.scene.textures, 'createCanvas').mockImplementationOnce(original).mockReturnValueOnce(null)
    expect(() => new TerrainVisuals(f.scene, createBareWorld(() => .5))).toThrow('prepare terrain')
    expect(f.textures.size).toBe(25); old.destroy(); expect(f.textures.size).toBe(0)
  })
})
