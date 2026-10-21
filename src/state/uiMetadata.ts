import { formatResearchBalance, hasTechnology, purchaseError, RP_UNITS, TECHNOLOGIES } from '../simulation/research'
import type { ResearchState, TechnologyId } from '../simulation/research'
import { PLAYER_TOOLS } from './toolMetadata'

export type UiPanel = 'menu' | 'help' | 'overview'
export function worldInputBlocked(state: { researchOpen: boolean; uiPanel: UiPanel | null }): boolean {
  return state.researchOpen || state.uiPanel !== null
}
export const WOOD_ICON = '▤'
export const TECHNOLOGY_ICONS: Record<TechnologyId, string> = {
  basicIndustry: '⚙', logistics1: '⌁', automation1: '⚒', logistics2: '⑂', analytics1: '▥', revengeDefense1: '⛏', revengeDefense2: 'ϟ',
}
export const TECHNOLOGY_GROUPS: readonly { label: string; ids: TechnologyId[] }[] = [
  { label: 'Start here', ids: ['basicIndustry'] },
  { label: 'Build your factory', ids: ['logistics1', 'automation1', 'logistics2', 'analytics1'] },
  { label: 'Pete’s Revenge', ids: ['revengeDefense1', 'revengeDefense2'] },
]
export function technologyView(research: ResearchState, id: TechnologyId, pending: TechnologyId | null = null) {
  const tech = TECHNOLOGIES[id], done = hasTechnology(research, id)
  const locked = !!tech.prerequisite && !hasTechnology(research, tech.prerequisite)
  const ready = !done && !purchaseError(research, id)
  const progress = done || tech.cost === 0 ? 100 : Number(BigInt(research.balanceUnits) * 100n / (BigInt(tech.cost) * RP_UNITS))
  return { state: done ? 'researched' : locked ? 'locked' : pending === id ? 'pending' : ready ? 'ready' : 'available',
    label: done ? 'Researched' : locked ? 'Locked' : pending === id ? 'Unlocking…' : ready ? 'Ready to unlock' : 'Collect points',
    symbol: done ? '✓' : locked ? '🔒' : pending === id ? '◷' : ready ? '✦' : '◔',
    progress: Math.min(100, progress), balance: formatResearchBalance(research) }
}
export const CONTROL_ROWS = [
  { keys: 'W A S D', action: 'Move the camera' },
  { keys: 'Mouse wheel', action: 'Zoom in or out' },
  ...PLAYER_TOOLS.filter(t => t.code).map(t => ({ keys: t.key, action: `Toggle ${t.label}` })),
  { keys: 'R', action: 'Rotate the selected building' },
  { keys: 'P', action: 'Show or hide power coverage' },
  { keys: 'Escape', action: 'Cancel your tool; click a building to inspect it' },
  { keys: 'Left click', action: 'Use your selected tool, or inspect when no tool is selected' },
  { keys: 'Click active tool', action: 'Cancel that tool; choosing a different group also cancels it' },
  { keys: 'Click and drag', action: 'Paint flowers or grass, or erase decoration, with a landscape brush' },
  { keys: 'Gift click', action: 'Press Escape, then click Pete’s gift to collect it' },
] as const
// One existing message slot, no toast queue. Tool instructions belong in Help/tooltips.
export function notificationText(message: string): string | null {
  if (!message || /^(Power first:|Place .* ·|Exploring ·|Spider Web ·|Click a building to remove|.* selected ·|.* · (Free sapling|Chop trees|Click and drag)|Pete’s Treehouse · 20 Wood|Hit!|Miss!)/.test(message)) return null
  return message
}

export function importantNotification(message: string): boolean {
  return /^(Requires |Insufficient |Choose |Only |Keep |A tree |This tile |Place mining|Cannot |No |.*costs [0-9]+ Wood|.*unavailable|.*failed)/i.test(message)
}
