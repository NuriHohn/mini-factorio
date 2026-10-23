import { describe, expect, it, vi } from 'vitest'
import { TouchGestures } from './touchGestures'
describe('additive touch gestures', () => {
  it('separates taps, panning, pinching and cancellation so camera gestures never place buildings', () => {
    const tap = vi.fn(), pan = vi.fn(), pinch = vi.fn(), g = new TouchGestures(tap, pan, pinch)
    g.down(1, { x: 10, y: 10 }); g.up(1, { x: 12, y: 11 }); expect(tap).toHaveBeenCalledTimes(1)
    g.down(1, { x: 10, y: 10 }); g.move(1, { x: 30, y: 10 }); g.up(1, { x: 30, y: 10 }); expect(pan).toHaveBeenCalled(); expect(tap).toHaveBeenCalledTimes(1)
    g.down(1, { x: 10, y: 10 }); g.down(2, { x: 30, y: 10 }); g.move(2, { x: 50, y: 10 }); g.up(2, { x: 50, y: 10 }); g.up(1, { x: 10, y: 10 }); expect(pinch).toHaveBeenCalledWith(2); expect(tap).toHaveBeenCalledTimes(1)
    g.down(1, { x: 10, y: 10 }); g.cancel(); g.up(1, { x: 10, y: 10 }); expect(tap).toHaveBeenCalledTimes(1)
  })
})
