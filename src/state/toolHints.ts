import { brushMode, natureTool, plantingSpecies } from './natureTools'
import type { Tool } from './toolMetadata'
export const TOOL_HINTS = {
  miner: 'Click an ore patch to build.',
  belt: 'Drag to build belts. Blocked paths try a detour.', powerPole: 'Drag to connect power.', axe: 'Click a tree to collect Wood.',
  landscape: 'Drag to paint the ground.', planting: 'Click an empty tile to plant a tree.',
  building: 'Click an empty tile to build.', remove: 'Click a building to remove it. Items inside are lost.',
  spiderWeb: 'Click Pete or the ground to throw a web.', combat: 'Click the walker to defend your factory.',
} as const
export type HintId = keyof typeof TOOL_HINTS
export function toolHintId(tool: Tool): HintId | null {
  if (!tool) return null
  if (tool === 'miner' || tool === 'belt' || tool === 'powerPole' || tool === 'axe' || tool === 'remove' || tool === 'spiderWeb') return tool
  if (brushMode(tool) !== undefined) return 'landscape'
  if (natureTool(tool) && plantingSpecies(tool)) return 'planting'
  if (['flySwatter', 'drill', 'lightningBeam'].includes(tool)) return 'combat'
  return 'building'
}
