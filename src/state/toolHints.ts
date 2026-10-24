import { brushMode, natureTool, plantingSpecies } from './natureTools'
import type { Tool } from './toolMetadata'
export const TOOL_HINTS = {
  grove: 'Wähle eine freie Waldfläche zwischen den Markierungen. Pete baut die Fabrik selbst.',
  playfulSpray: 'Click any target within 3 tiles of a ready powered sprinkler. Just a harmless splash.',
  footbridge: 'Drag straight from one dry shore to the other. Up to 5 water tiles; 3 Wood each. Occupied bridges cannot be removed.',
  miner: 'Click an ore patch to build.',
  belt: 'Drag belts from land to land. Bridges: up to 5 water tiles, 3 Wood each.', powerPole: 'Drag to connect power around obstacles. Blue rings reuse existing poles.', axe: 'Click a tree to collect Wood.',
  water: 'Drag to shape water or restore land. Red tiles stay unchanged; bridge banks are protected.',
  landscape: 'Drag to paint the ground.', planting: 'Click an empty tile to plant a tree.',
  building: 'Click an empty tile to build.', remove: 'Click a building to remove it. Items inside are lost.',
  spiderWeb: 'Click Pete or the ground to throw a web.', combat: 'Click the walker to defend your factory.',
} as const
export type HintId = keyof typeof TOOL_HINTS
export function toolHintId(tool: Tool): HintId | null {
  if (!tool) return null
  if (tool === 'placeGrove') return 'grove'
  if (tool === 'playfulSpray' || tool === 'footbridge' || tool === 'miner' || tool === 'belt' || tool === 'powerPole' || tool === 'axe' || tool === 'remove' || tool === 'spiderWeb') return tool
  if (tool === 'createWater' || tool === 'restoreLand') return 'water'
  if (brushMode(tool) !== undefined) return 'landscape'
  if (natureTool(tool) && plantingSpecies(tool)) return 'planting'
  if (['flySwatter', 'drill', 'lightningBeam'].includes(tool)) return 'combat'
  return 'building'
}
