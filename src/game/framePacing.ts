export type GraphicsMode = 'standard' | 'energy-saving'
export const graphicsFps = (mode: GraphicsMode) => mode === 'energy-saving' ? 30 : 60

// One gate before Phaser's complete update/render callback. No second loop or timer.
export class FramePacer {
  private last: number | null = null
  private next: number | null = null
  private mode: GraphicsMode = 'standard'
  reset() { this.last = null; this.next = null }
  frame(time: number, mode: GraphicsMode, hidden = false): number | null {
    if (hidden || !Number.isFinite(time)) { this.reset(); return null }
    if (mode !== this.mode) { this.mode = mode; this.next = null }
    if (this.next !== null && time + .01 < this.next) return null
    const period = 1000 / graphicsFps(mode)
    const delta = this.last === null ? 0 : Math.max(0, Math.min(250, time - this.last))
    this.last = time
    // Retain the deadline phase, skipping missed frames rather than bursting.
    const deadline = this.next ?? time
    this.next = deadline + Math.max(1, Math.floor((time - deadline + .01) / period) + 1) * period
    return delta
  }
}
