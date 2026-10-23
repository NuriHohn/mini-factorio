import type Phaser from 'phaser'
import type { Personality } from '../simulation/personality'

export type PeteOutfit = 1 | 2 | 3 | 4 | 5

// Derived every draw: dominance changes and restored saves need no outfit state.
export function peteOutfit(personality: Personality): PeteOutfit {
  return personality.dominant === 'eco' ? Math.max(1, Math.min(5, personality.paths.eco.level)) as PeteOutfit : 1
}

// Coordinates share the original standing pose origin (face at y - 4).
// Two immediate-mode passes keep cape/glow behind Pete and clothing below his face.
export function drawPeteOutfit(g: Phaser.GameObjects.Graphics, outfit: PeteOutfit, x: number, y: number, layer: 'back' | 'front'): void {
  if (outfit === 1) return
  if (layer === 'back') {
    if (outfit === 5) {
      g.fillStyle(0xbce58b, .09).fillEllipse(x, y - 3, 34, 41)
      g.fillStyle(0xe3edab, .45).fillRect(x - 16, y - 9, 1, 2).fillRect(x + 15, y + 2, 1, 2)
    }
    if (outfit >= 4) {
      g.fillStyle(0x345e3b).fillTriangle(x, y + 1, x - 13, y + 11, x + 13, y + 11)
      for (const side of [-1, 1]) {
        g.fillStyle(0x558649).fillEllipse(x + side * 9, y + 6, 8, 12)
        g.lineStyle(1, 0x86aa5c).lineBetween(x + side * 7, y + 2, x + side * 11, y + 10)
      }
    }
    return
  }
  if (outfit >= 3) {
    g.fillStyle(0x386443).fillRoundedRect(x - 7, y + 3, 14, 8, 2)
    g.fillStyle(0x8aa55c).fillTriangle(x - 6, y + 3, x - 1, y + 4, x - 3, y + 9).fillTriangle(x + 6, y + 3, x + 1, y + 4, x + 3, y + 9)
    g.fillStyle(0xd3b76a).fillCircle(x, y + 9, 1)
    // Keep the pumpkin brim visible beneath the straw hat, even at tier five.
    g.fillStyle(0xb69150).fillEllipse(x, y - 16, 27, 5)
    g.fillStyle(0xe4c680).fillRoundedRect(x - 7, y - 23, 14, 7, 3)
    g.fillStyle(0x688047).fillRect(x - 7, y - 18, 14, 2)
  }
  g.fillStyle(0x397444).fillTriangle(x - 7, y + 3, x + 7, y + 3, x, y + 8)
  g.fillStyle(0x86b65e).fillCircle(x + 3, y + 4, 2).fillTriangle(x + 3, y + 5, x + 8, y + 5, x + 6, y + 10)
  if (outfit >= 4) {
    for (const side of [-1, 1]) {
      g.fillStyle(0xf0ceba).fillCircle(x + side * 9, y + 3, 2)
      g.fillStyle(0xf0d475).fillCircle(x + side * 9, y + 3, .8)
    }
  }
  if (outfit === 5) {
    g.lineStyle(2, 0x476d37).lineBetween(x - 8, y - 22, x + 8, y - 22)
    for (const dx of [-7, -3, 1, 5]) {
      g.fillStyle(dx % 3 ? 0x719e4b : 0x9cbd64).fillTriangle(x + dx - 2, y - 22, x + dx, y - 29, x + dx + 4, y - 23)
    }
  }
}
