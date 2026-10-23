import type { Position } from '../simulation/world'
export class TouchGestures {
  private points = new Map<number, Position>()
  private origin: Position | null = null
  private moved = false
  private tap: (point: Position) => void
  private pan: (dx: number, dy: number) => void
  private pinch: (ratio: number) => void
  constructor(tap: (point: Position) => void, pan: (dx: number, dy: number) => void, pinch: (ratio: number) => void) { this.tap = tap; this.pan = pan; this.pinch = pinch }
  down(id: number, point: Position): void { if (!this.points.size) { this.origin = { ...point }; this.moved = false } else this.moved = true; this.points.set(id, { ...point }) }
  move(id: number, point: Position): void {
    const previous = this.points.get(id)
    if (!previous) return
    const pair = [...this.points.entries()].find(([other]) => other !== id)?.[1]
    if (pair) {
      const before = Math.hypot(previous.x - pair.x, previous.y - pair.y), after = Math.hypot(point.x - pair.x, point.y - pair.y)
      if (before > 4 && after > 4) this.pinch(after / before)
      this.pan((point.x - previous.x) / 2, (point.y - previous.y) / 2)
      this.moved = true
    } else if (this.moved || this.origin && Math.hypot(point.x - this.origin.x, point.y - this.origin.y) > 8) {
      this.pan(point.x - previous.x, point.y - previous.y); this.moved = true
    }
    this.points.set(id, { ...point })
  }
  up(id: number, point: Position): void {
    if (!this.points.has(id)) return
    const tap = this.points.size === 1 && !this.moved && this.origin && Math.hypot(point.x - this.origin.x, point.y - this.origin.y) <= 8
    this.points.delete(id)
    if (tap) this.tap(point)
    if (!this.points.size) this.origin = null
  }
  cancel(): void { this.points.clear(); this.origin = null; this.moved = true }
}
