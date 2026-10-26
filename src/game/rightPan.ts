import type { Position } from '../simulation/world'
export class RightPan {
  private start: Position | null = null
  private last: Position | null = null
  dragging = false
  begin(point: Position) { this.start = point; this.last = point; this.dragging = false }
  move(point: Position): Position | null {
    if (!this.start || !this.last) return null
    if (!this.dragging && Math.hypot(point.x - this.start.x, point.y - this.start.y) < 8) return null
    this.dragging = true
    const delta = { x: point.x - this.last.x, y: point.y - this.last.y }
    this.last = point
    return delta
  }
  end(): boolean { const click = this.start !== null && !this.dragging; this.cancel(); return click }
  cancel() { this.start = null; this.last = null; this.dragging = false }
  get active() { return this.start !== null }
}
