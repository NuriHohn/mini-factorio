import type Phaser from 'phaser'
import type { Personality, PersonalityPath } from '../simulation/personality'

type OutfitLevel = 1 | 2 | 3 | 4 | 5
export interface PeteOutfit { path: PersonalityPath; level: OutfitLevel }

// Derived every draw: dominance changes and restored saves need no outfit state.
export function peteOutfit(personality: Personality): PeteOutfit {
  const path = personality.dominant
  const level = Math.max(1, Math.min(5, personality.paths[path].level)) as OutfitLevel
  return { path, level }
}

// Coordinates share the original standing pose origin (face at y - 4).
// Two immediate-mode passes keep cape/glow behind Pete and clothing below his face.
export function drawPeteOutfit(g: Phaser.GameObjects.Graphics, selection: PeteOutfit, x: number, y: number, layer: 'back' | 'front', hands?: readonly { x: number; y: number }[]): void {
  const outfit = selection.level
  if (outfit === 1) return
  if (selection.path === 'industrial') {
    if (layer === 'front') drawIndustrialOutfit(g, outfit, x, y, hands)
    return
  }
  if (selection.path === 'inventor') {
    drawInventorOutfit(g, outfit, x, y, layer)
    return
  }
  if (selection.path === 'craftsman') {
    if (layer === 'front') drawCraftsmanOutfit(g, outfit, x, y)
    return
  }
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

function drawIndustrialOutfit(g: Phaser.GameObjects.Graphics, level: OutfitLevel, x: number, y: number, hands?: readonly { x: number; y: number }[]): void {
  const reinforced = level >= 4, legendary = level === 5
  if (level >= 3) {
    // Bib and straps stay below the mouth; helmet leaves the pumpkin brim exposed.
    g.fillStyle(legendary ? 0x243e59 : 0x416f98).fillRoundedRect(x - 7, y + 4, 14, 9, 2)
    g.lineStyle(2, 0x7099b4).lineBetween(x - 5, y + 3, x - 4, y + 8).lineBetween(x + 5, y + 3, x + 4, y + 8)
    g.fillStyle(0xc4d2d4).fillCircle(x - 4, y + 7, .8).fillCircle(x + 4, y + 7, .8)
    g.fillStyle(0x284963).fillRect(x - 3, y + 8, 6, 3)
    g.fillStyle(legendary ? 0xf0c66d : 0xe3af43).fillEllipse(x, y - 14, 25, 4)
    g.fillStyle(legendary ? 0xf0c66d : 0xf0c85b).fillRoundedRect(x - 8, y - 22, 16, 8, 5)
    g.lineStyle(2, legendary ? 0xffe5a0 : 0xffdf83).lineBetween(x, y - 21, x, y - 15)
    if (reinforced) {
      g.lineStyle(1, legendary ? 0xf0c66d : 0x9fb2bd).strokeRoundedRect(x - 7, y + 4, 14, 9, 2)
      g.fillStyle(0x253b4c).fillRect(x - 7, y + 10, 4, 3).fillRect(x + 3, y + 10, 4, 3)
      g.fillStyle(0xe6bd5e).fillRect(x - 7, y + 5, 3, 2).fillRect(x + 4, y + 5, 3, 2)
      g.fillStyle(0x99acb6).fillRoundedRect(x - 11, y + 2, 4, 4, 1).fillRoundedRect(x + 7, y + 2, 4, 4, 1)
    }
    if (legendary) {
      // Gold-edged coat tails and a factory badge distinguish the magnate tier.
      g.fillStyle(0x243e59).fillTriangle(x - 7, y + 4, x - 11, y + 13, x - 6, y + 12).fillTriangle(x + 7, y + 4, x + 11, y + 13, x + 6, y + 12)
      g.lineStyle(1, 0xf0c66d).lineBetween(x - 7, y + 4, x - 10, y + 12).lineBetween(x + 7, y + 4, x + 10, y + 12)
      g.fillStyle(0x243e59).fillRoundedRect(x - 3, y - 20, 6, 5, 1)
      g.fillStyle(0xffe5a0).fillRect(x - 2, y - 17, 4, 1).fillRect(x - 2, y - 19, 1, 3).fillRect(x + 1, y - 18, 1, 2)
      g.fillStyle(0xf0c66d).fillCircle(x, y + 8, 1.5)
      g.lineStyle(1, 0xf0c66d).lineBetween(x, y + 9, x + 4, y + 10)
    }
  }
  // Reaction and rowing renderers supply their hand endpoints in this pass's coordinates.
  for (const hand of hands ?? [{ x: x - 10, y: y + 8 }, { x: x + 10, y: y + 8 }]) {
    g.fillStyle(0xc89656).fillRoundedRect(hand.x - 2, hand.y - 2, 4, 5, 1)
    g.fillStyle(legendary ? 0xf0c66d : 0x71543a).fillRect(hand.x - 2, hand.y - 3, 4, 2)
    if (reinforced) g.fillStyle(0x99acb6).fillRect(hand.x - 1, hand.y, 2, 2)
  }
}

function drawInventorOutfit(g: Phaser.GameObjects.Graphics, level: OutfitLevel, x: number, y: number, layer: 'back' | 'front'): void {
  const legendary = level === 5
  if (layer === 'back') {
    if (level >= 4) {
      g.fillStyle(0x354f60).fillRoundedRect(x - 12, y - 1, 24, 13, 3)
      g.lineStyle(1, 0xba794b).strokeRoundedRect(x - 12, y - 1, 24, 13, 3)
      // Visible side gears belong to the backpack, without motors or gameplay state.
      for (const side of [-1, 1]) {
        g.fillStyle(0xba794b).fillCircle(x + side * 12, y + 5, 4)
        g.fillRect(x + side * 12 - 1, y, 2, 10).fillRect(x + side * 12 - 5, y + 4, 10, 2)
        g.fillStyle(0x354f60).fillCircle(x + side * 12, y + 5, 2)
      }
      if (legendary) {
        g.lineStyle(2, 0xe4bc72).lineBetween(x - 9, y, x - 12, y - 15).lineBetween(x + 9, y, x + 12, y - 15)
        g.fillStyle(0x83dae0).fillCircle(x - 12, y - 16, 2).fillCircle(x + 12, y - 16, 2)
        g.fillStyle(0x83dae0, .12).fillCircle(x - 12, y - 16, 4).fillCircle(x + 12, y - 16, 4)
      }
    }
    return
  }
  if (level >= 3) {
    g.lineStyle(2, 0x765541).lineBetween(x - 6, y + 3, x - 4, y + 10).lineBetween(x + 6, y + 3, x + 4, y + 10)
    g.fillStyle(0x765541).fillRect(x - 8, y + 7, 16, 3)
    // A pocket screwdriver and copper spanner sit below the exposed face.
    g.lineStyle(2, 0xba794b).lineBetween(x + 7, y + 4, x + 7, y + 12)
    g.lineStyle(1, 0xb9d8d5).lineBetween(x - 6, y + 5, x - 6, y + 12)
    g.fillStyle(0x8cc6ce).fillRect(x - 7, y + 8, 3, 3)
    g.lineStyle(1, 0xba794b).strokeCircle(x + 7, y + 3, 2)
  }
  // Forehead goggles keep both expressive eyes and the pumpkin brim visible.
  g.lineStyle(2, 0x765541).lineBetween(x - 9, y - 10, x + 9, y - 10)
  for (const side of [-1, 1]) {
    g.fillStyle(0xb9e1df, .85).fillEllipse(x + side * 4, y - 10, 6, 5)
    g.lineStyle(1, legendary ? 0xe4bc72 : level >= 3 ? 0xba794b : 0x8c9d99).strokeEllipse(x + side * 4, y - 10, 6, 5)
    g.fillStyle(0xedffef).fillRect(x + side * 4 - 1, y - 12, 1, 2)
  }
  if (legendary) {
    g.fillStyle(0xe4bc72).fillCircle(x, y + 8, 2)
    g.fillStyle(0x83dae0).fillCircle(x, y + 8, 1)
    g.lineStyle(1, 0xe4bc72).lineBetween(x - 7, y + 12, x + 7, y + 12)
  }
}

function drawCraftsmanOutfit(g: Phaser.GameObjects.Graphics, level: OutfitLevel, x: number, y: number): void {
  const master = level >= 4, legendary = level === 5
  if (level >= 3) {
    // The bib starts below the mouth; ears, pumpkin brim and feet stay exposed.
    g.lineStyle(2, 0x9b754e).lineBetween(x - 5, y + 3, x - 4, y + 8).lineBetween(x + 5, y + 3, x + 4, y + 8)
    g.fillStyle(legendary ? 0x623d32 : 0x9c6844).fillRoundedRect(x - 7, y + 4, 14, 9, 2)
    if (master) {
      g.lineStyle(1, legendary ? 0xe6bd68 : 0xc49a67).strokeRoundedRect(x - 7, y + 4, 14, 9, 2)
      g.fillStyle(0x583e31).fillRect(x - 5, y + 9, 4, 3).fillRect(x + 1, y + 9, 4, 3)
      // A short chisel and awl, held upright in the apron pockets.
      g.fillStyle(0xa8b4ab).fillRect(x - 4, y + 7, 1, 3).fillRect(x + 3, y + 6, 1, 4)
      g.fillStyle(0xd5ab69).fillRect(x + 2, y + 5, 3, 2)
    }
    if (legendary) {
      g.fillStyle(0xe6bd68).fillCircle(x - 5, y + 5, 1).fillCircle(x + 5, y + 5, 1)
      g.lineStyle(1, 0xe6bd68).lineBetween(x - 2, y + 5, x, y + 7).lineBetween(x, y + 7, x + 2, y + 5)
    }
  }
  g.fillStyle(0x513a2b).fillRoundedRect(x - 8, y + 6, 16, 3, 1)
  g.fillStyle(legendary ? 0xe6bd68 : 0xc4a16a).fillRect(x - 2, y + 6, 4, 3)
  g.fillStyle(0x513a2b).fillRect(x - 1, y + 7, 2, 1)
  if (level === 2) g.fillStyle(0x9c6844).fillRect(x - 6, y + 8, 4, 3)
  if (level >= 3) {
    // Secured at the hip, never swung or used as a gameplay tool.
    g.lineStyle(2, 0xc39359).lineBetween(x + 9, y + 4, x + 9, y + 12)
    g.fillStyle(legendary ? 0xe6bd68 : 0xa8b4ab).fillRoundedRect(x + 5, y + 2, legendary ? 10 : 8, 4, 1)
    g.fillStyle(0x513a2b).fillRect(x + 8, y + 7, 3, 2)
    if (legendary) {
      g.fillStyle(0x536c6b).fillRect(x + 7, y + 3, 6, 2)
      g.fillStyle(0xffdc8b).fillRect(x + 9, y + 3, 2, 2)
      g.fillStyle(0xe6bd68).fillRect(x + 8, y + 11, 3, 2)
    }
  }
}
