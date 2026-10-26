import { describe, expect, it } from 'vitest'
import { RightPan } from './rightPan'
describe('right-button navigation', () => {
  it('keeps short clicks and starts a drag at eight CSS pixels without a final cancellation', () => {
    const pan = new RightPan()
    pan.begin({ x: 100, y: 100 })
    expect(pan.move({ x: 107, y: 100 })).toBeNull()
    expect(pan.end()).toBe(true)
    pan.begin({ x: 100, y: 100 })
    expect(pan.move({ x: 108, y: 100 })).toEqual({ x: 8, y: 0 })
    expect(pan.move({ x: 112, y: 95 })).toEqual({ x: 4, y: -5 })
    expect(pan.end()).toBe(false)
    expect(pan.move({ x: 400, y: 400 })).toBeNull()
  })
  it('discards cancelled and outside gestures without a click', () => {
    const pan = new RightPan()
    pan.begin({ x: 0, y: 0 }); pan.cancel()
    expect(pan.active).toBe(false)
    expect(pan.end()).toBe(false)
  })
})
