import { describe, expect, it, vi } from 'vitest'
import { moveCamera, updateCameraBounds } from './cameraMovement'

function camera(width = 1800, height = 800, zoom = 1.3) {
  return { width, height, zoom, scrollX: 0, scrollY: 0, setBounds: vi.fn() }
}
function keys(...down: string[]) {
  return { W: { isDown: down.includes('W') }, A: { isDown: down.includes('A') }, S: { isDown: down.includes('S') }, D: { isDown: down.includes('D') } }
}

describe('camera movement', () => {
  it.each([['A', -420, 0], ['D', 420, 0], ['W', 0, -420], ['S', 0, 420]] as const)('moves with %s', (key, x, y) => {
    const c = camera(800, 600, 1)
    moveCamera(c, keys(key), 1000)
    expect(c.scrollX).toBe(x)
    expect(c.scrollY).toBe(y)
  })
  it.each([['W', 'A'], ['W', 'D'], ['S', 'A'], ['S', 'D']])('normalizes diagonal %s + %s', (vertical, horizontal) => {
    const c = camera(800, 600, 1)
    moveCamera(c, keys(vertical, horizontal), 1000)
    expect(Math.hypot(c.scrollX, c.scrollY)).toBeCloseTo(420)
    expect(Math.sign(c.scrollX)).toBe(horizontal === 'A' ? -1 : 1)
    expect(Math.sign(c.scrollY)).toBe(vertical === 'W' ? -1 : 1)
  })
  it('cancels opposite keys and preserves frame-rate independent speed at zoom', () => {
    const c = camera()
    moveCamera(c, keys('W', 'A', 'S', 'D'), 1000)
    expect(c.scrollX).toBe(0)
    expect(c.scrollY).toBe(0)
    for (let n = 0; n < 60; n++) moveCamera(c, keys('D'), 1000 / 60)
    expect(c.scrollX).toBeCloseTo(420 / 1.3)
  })
  it.each([[1800, 800, 1.3], [2400, 900, .5], [800, 600, 2.5]])('keeps both axes movable at %s × %s and zoom %s', (width, height, zoom) => {
    const c = camera(width, height, zoom)
    updateCameraBounds(c, 1280)
    const [x, y, boundsWidth, boundsHeight] = c.setBounds.mock.calls[0]
    // Phaser's scroll interval is bounds size minus visible world size.
    // Original map-sized bounds gave a negative horizontal interval at 1800px.
    expect(boundsWidth - width / zoom).toBeCloseTo(1280)
    expect(boundsHeight - height / zoom).toBeCloseTo(1280)
    expect(x + width / zoom / 2).toBeCloseTo(0)
    expect(y + height / zoom / 2).toBeCloseTo(0)
    c.width = 2800
    c.zoom = .5
    updateCameraBounds(c, 1280)
    expect(c.setBounds).toHaveBeenLastCalledWith(-2800, -height, 6880, 1280 + height * 2)
  })
})
