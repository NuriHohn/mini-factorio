export type UiPanel = 'menu' | 'help' | 'overview'
export function worldInputBlocked(state: { researchOpen: boolean; uiPanel: UiPanel | null }): boolean {
  return state.researchOpen || state.uiPanel !== null
}
export const WOOD_ICON = '▤'
// One existing message slot, no toast queue. Tool instructions belong in Help/tooltips.
export function notificationText(message: string): string | null {
  if (!message || /^(Power first:|Place .* ·|Exploring ·|Spider Web ·|Click a building to remove|.* selected ·|.* · (Free sapling|Chop trees|Click and drag)|Pete’s Treehouse · 20 Wood|Hit!|Miss!)/.test(message)) return null
  return message
}

export function importantNotification(message: string): boolean {
  return /^(Nothing built|Requires |Insufficient |Choose |Only |Keep |A tree |This tile |Place mining|Cannot |No |.*costs [0-9]+ Wood|.*unavailable|.*failed)/i.test(message)
}
