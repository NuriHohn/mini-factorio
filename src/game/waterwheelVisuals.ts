import type Phaser from 'phaser'
import { offsets } from '../simulation/world'
import type { Waterwheel } from '../simulation/world'
import { WATERWHEEL_PERIOD_MS } from '../simulation/waterwheel'
// Bounded procedural geometry; the caller already culls offscreen buildings.
export function drawWaterwheel(g: Phaser.GameObjects.Graphics, b: Waterwheel, interpolationMs = 0) {
  const x = b.x * 32, y = b.y * 32, d = offsets[b.direction]
  const cx = x + 16 + d.x * 3, cy = y + 16 + d.y * 3
  g.fillStyle(0x384b42).fillRoundedRect(x + 3, y + 3, 26, 26, 4)
  g.fillStyle(0x775638).fillRect(x + 3, y + 24, 26, 5)
  g.fillStyle(0x4a3528).fillCircle(cx, cy, 12)
  g.lineStyle(3, 0xb39160).strokeCircle(cx, cy, 10)
  const phase = (b.rotationMs + interpolationMs) / WATERWHEEL_PERIOD_MS * Math.PI * 2
  for (let i = 0; i < 8; i++) {
    const a = phase + i * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a)
    g.lineStyle(2, 0xc6a473).lineBetween(cx, cy, cx + dx * 10, cy + dy * 10)
    g.lineStyle(3, 0x967047).lineBetween(cx + dx * 11 - dy * 3, cy + dy * 11 + dx * 3, cx + dx * 11 + dy * 3, cy + dy * 11 - dx * 3)
  }
  g.fillStyle(0xc9c3a0).fillCircle(cx, cy, 3)
  g.lineStyle(2, 0x8fbabc).lineBetween(x + 16 + d.x * 12 - d.y * 4, y + 16 + d.y * 12 + d.x * 4, x + 16 + d.x * 12 + d.y * 4, y + 16 + d.y * 12 - d.x * 4)
}
