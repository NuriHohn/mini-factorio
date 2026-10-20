import type { BuildingKind } from '../simulation/world'
export type BuildTab = 'factory' | 'pete'
export type ToolKind = Exclude<BuildingKind, 'prison'> | 'remove' | 'spiderWeb'
export type Tool = ToolKind | null
export interface ToolMetadata { tool: ToolKind; label: string; hint: string; key: string; icon: string; code: string; tab: BuildTab }
export const BUILD_TABS: readonly { id: BuildTab; label: string }[] = [{ id: 'factory', label: 'Factory' }, { id: 'pete', label: 'Pete' }]
export const PLAYER_TOOLS: readonly ToolMetadata[] = [
  { tool: 'miner', label: 'Mining machine', hint: '1 ore / sec at full power · on ore', key: '1', icon: '⚙', code: 'Digit1', tab: 'factory' },
  { tool: 'belt', label: 'Conveyor belt', hint: 'Single lane · follows arrow', key: '2', icon: '➜', code: 'Digit2', tab: 'factory' },
  { tool: 'storage', label: 'Storage chest', hint: 'Stores every item type', key: '3', icon: '▣', code: 'Digit3', tab: 'factory' },
  { tool: 'furnace', label: 'Furnace', hint: '1 ore → 1 plate · 2 sec at full power', key: '4', icon: '♨', code: 'Digit4', tab: 'factory' },
  { tool: 'generator', label: 'Power generator', hint: '100 kW · place near a pole', key: '5', icon: '⚡', code: 'Digit5', tab: 'factory' },
  { tool: 'powerPole', label: 'Power pole', hint: '3-tile coverage · 6-tile wires', key: '6', icon: '┬', code: 'Digit6', tab: 'factory' },
  { tool: 'assembler', label: 'Assembler', hint: 'Gears, cables & circuits · 60 kW', key: '7', icon: '⚒', code: 'Digit7', tab: 'factory' },
  { tool: 'inserter', label: 'Inserter', hint: 'Behind → ahead · 1 item / sec · 10 kW', key: '8', icon: '⌁', code: 'Digit8', tab: 'factory' },
  { tool: 'radar', label: 'Radar trap', hint: '3-tile detection · requires full 5 kW', key: '9', icon: '◉', code: 'Digit9', tab: 'pete' },
  { tool: 'spiderWeb', label: 'Spider Web', hint: 'Click Pete to scare · ground webs last 10 sec', key: 'B', icon: '🕸', code: 'KeyB', tab: 'pete' },
  { tool: 'sprinkler', label: 'Anti-Goblin Sprinkler', hint: '3-tile range · 5 kW · sends Pete slipping', key: 'G', icon: '☔', code: 'KeyG', tab: 'pete' },
  { tool: 'splitter', label: 'Splitter', hint: 'Rear input → front / left · no power', key: '0', icon: '⑂', code: 'Digit0', tab: 'factory' },
  { tool: 'remove', label: 'Remove building', hint: 'Discards contained resources', key: 'X', icon: '×', code: 'KeyX', tab: 'factory' },
]
export const TOOL_HOTKEYS: Readonly<Record<string, ToolKind>> = Object.fromEntries(PLAYER_TOOLS.map(tool => [tool.code, tool.tool]))
export function toolMetadata(tool: ToolKind): ToolMetadata { return PLAYER_TOOLS.find(metadata => metadata.tool === tool)! }
