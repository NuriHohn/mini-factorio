import { INSERTER_SWING_MS } from '../simulation/inserters'
import type { Inserter } from '../simulation/world'

// Tile-local reach, rotated into the building's direction by Phaser.
export function inserterArmPoint(phase: Inserter['phase'], elapsedMs: number): { x: number; y: number } {
  const progress = Math.max(0, Math.min(1, elapsedMs / INSERTER_SWING_MS))
  const angle = phase === 'carrying' ? Math.PI * (1 - progress) : phase === 'returning' ? Math.PI * progress : Math.PI
  return { x: Math.cos(angle), y: -Math.sin(angle) * .65 }
}
