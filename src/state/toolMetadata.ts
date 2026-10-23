import type { NatureTool } from './natureTools'
import type { BuildingKind } from '../simulation/world'
export type BuildTab = 'factory' | 'logistics' | 'power' | 'nature' | 'pete'
export type ToolKind = Exclude<BuildingKind, 'peteDevelopment' | 'peteTreasure' | 'peteFlightpad' | 'prison' | 'tree' | 'peteFence' | 'peteCoop' | 'peteCampfire' | 'peteGate'> | NatureTool | 'remove' | 'spiderWeb' | 'flySwatter' | 'drill' | 'lightningBeam' | 'playfulSpray'
export type Tool = ToolKind | null
export interface ToolMetadata { tool: ToolKind; label: string; hint: string; key: string; icon: string; code?: string; tab: BuildTab }
export const BUILD_TABS: readonly { id: BuildTab; label: string; icon: string }[] = [{ id: 'factory', label: 'Factory', icon: '⚙' }, { id: 'logistics', label: 'Logistics', icon: '➜' }, { id: 'power', label: 'Power', icon: 'ϟ' }, { id: 'nature', label: 'Nature', icon: '♣' }, { id: 'pete', label: 'Special', icon: '✳' }]
export const PLAYER_TOOLS: readonly ToolMetadata[] = [
  { tool: 'playfulSpray', label: 'Playful spray', hint: 'Click any target within 3 tiles of a ready powered sprinkler · harmless', key: 'Click', icon: '💦', tab: 'pete' },
  { tool: 'miner', label: 'Mining machine', hint: '1 ore / sec at full power · on ore', key: '1', icon: '⚙', code: 'Digit1', tab: 'factory' },
  { tool: 'belt', label: 'Conveyor belt', hint: 'Single lane · follows arrow', key: '2', icon: '➜', code: 'Digit2', tab: 'logistics' },
  { tool: 'footbridge', label: 'Wooden Footbridge', hint: 'Drag shore to shore · up to 5 water tiles · 3 Wood each · NPC crossing', key: 'Drag', icon: '≋', tab: 'logistics' },
  { tool: 'storage', label: 'Storage chest', hint: 'Stores every item type', key: '3', icon: '▣', code: 'Digit3', tab: 'logistics' },
  { tool: 'furnace', label: 'Furnace', hint: '1 ore → 1 plate · 2 sec at full power', key: '4', icon: '♨', code: 'Digit4', tab: 'factory' },
  { tool: 'waterwheel', label: 'Waterwheel Generator', hint: '50 kW · 10 Wood · face adjacent water', key: 'Click', icon: '☸', tab: 'power' },
  { tool: 'generator', label: 'Power generator', hint: '100 kW · place near a pole', key: '5', icon: '⚡', code: 'Digit5', tab: 'power' },
  { tool: 'powerPole', label: 'Power pole', hint: '3-tile coverage · 6-tile wires', key: '6', icon: '┬', code: 'Digit6', tab: 'power' },
  { tool: 'assembler', label: 'Assembler', hint: 'Gears, cables & circuits · 60 kW', key: '7', icon: '⚒', code: 'Digit7', tab: 'factory' },
  { tool: 'inserter', label: 'Inserter', hint: 'Behind → ahead · 1 item / sec · 10 kW', key: '8', icon: '⌁', code: 'Digit8', tab: 'logistics' },
  { tool: 'radar', label: 'Radar trap', hint: '3-tile detection · requires full 5 kW', key: '9', icon: '◉', code: 'Digit9', tab: 'pete' },
  { tool: 'spiderWeb', label: 'Spider Web', hint: 'Click Pete to scare · ground webs last 10 sec', key: 'B', icon: '🕸', code: 'KeyB', tab: 'pete' },
  { tool: 'sprinkler', label: 'Anti-Goblin Sprinkler', hint: '3-tile range · 5 kW · sends Pete slipping', key: 'G', icon: '☔', code: 'KeyG', tab: 'pete' },
  { tool: 'flySwatter', label: 'Fly Swatter', hint: 'Click walker · 5 HP · shared 1 s cooldown', key: 'Click', icon: '✳', tab: 'pete' },
  { tool: 'drill', label: 'Drill', hint: 'Click walker · 15 HP · shared 1.5 s cooldown', key: 'Click', icon: '⛏', tab: 'pete' },
  { tool: 'lightningBeam', label: 'Lightning Beam', hint: 'Click walker · 30 HP · shared 2 s cooldown', key: 'Click', icon: 'ϟ', tab: 'pete' },
  { tool: 'splitter', label: 'Splitter', hint: 'Rear input → front / left · no power', key: '0', icon: '⑂', code: 'Digit0', tab: 'logistics' },
  { tool: 'fishingDock', label: 'Fishing Dock', hint: '8 Wood · face adjacent water · peaceful Pete visits', key: 'Click', icon: '⚓', tab: 'nature' },
  { tool: 'supplyCrate', label: 'Pete’s Supply Crate', hint: '6 Wood · holds 200 items · belt/inserter input · peaceful Pete visits', key: 'Click', icon: '▤', tab: 'nature' },
  { tool: 'treehouse', label: 'Pete’s Treehouse', hint: '20 Wood · one home · makes Pete peaceful · no power', key: 'Click', icon: '⌂', tab: 'nature' },
  { tool: 'plantOak', label: 'Plant Oak', hint: 'Free sapling · young at 2 min · mature at 5 min', key: 'Click', icon: '♣', tab: 'nature' },
  { tool: 'plantPine', label: 'Plant Pine', hint: 'Free sapling · trees occupy one tile', key: 'Click', icon: '♠', tab: 'nature' },
  { tool: 'plantBirch', label: 'Plant Birch', hint: 'Free sapling · may grow on ore', key: 'Click', icon: '♧', tab: 'nature' },
  { tool: 'axe', label: 'Axe', hint: 'Chop trees · sapling 0 / young 1 / mature 3 Wood', key: 'Click', icon: '⚒', tab: 'nature' },
  { tool: 'flowers', label: 'Flowers', hint: 'Click and drag · does not block factories', key: 'Drag', icon: '✿', tab: 'nature' },
  { tool: 'grass', label: 'Grass', hint: 'Click and drag · keeps buildings and ore', key: 'Drag', icon: '❧', tab: 'nature' },
  { tool: 'eraseDecoration', label: 'Erase decoration', hint: 'Click and drag · removes only flowers and grass', key: 'Drag', icon: '◌', tab: 'nature' },
  { tool: 'createWater', label: 'Create Water', hint: 'Free · drag to shape water · protected tiles are skipped', key: 'Drag', icon: '≈', tab: 'nature' },
  { tool: 'restoreLand', label: 'Restore Land', hint: 'Free · drag to remove water · bridges stay protected', key: 'Drag', icon: '▱', tab: 'nature' },
  { tool: 'remove', label: 'Remove building', hint: 'Discards contained resources', key: 'X', icon: '×', code: 'KeyX', tab: 'pete' },
]
export const TOOL_HOTKEYS: Readonly<Record<string, ToolKind>> = Object.fromEntries(PLAYER_TOOLS.filter(tool => tool.code).map(tool => [tool.code, tool.tool]))
export function toolMetadata(tool: ToolKind): ToolMetadata { return PLAYER_TOOLS.find(metadata => metadata.tool === tool)! }
