import { peteText } from './text'
import { connectionGuide } from '../simulation/connectionGuide'
import { recurringOrderReady, earlySupplyReady } from '../simulation/infrastructure'
import { HOME_TASK_LABELS } from '../simulation/homestead'
import { ACTIVITY_NAMES } from '../simulation/peteStatus'
import { LINK_NAMES } from '../simulation/infrastructureRules'
import { PERSONALITY_PATHS } from '../simulation/personality'
import type { World } from '../simulation/world'

export function workStatus(world: World) {
  const h = world.homestead
  if (!h) return null
  const early = PERSONALITY_PATHS.filter(path => earlySupplyReady(world, path))
  const recurring = PERSONALITY_PATHS.filter(path => recurringOrderReady(world, path))
  const deadline = Math.min(...(early.length ? [h.infrastructure.nextSupplyAtMs] : []), ...(recurring.length ? [h.infrastructure.nextOrderAtMs] : []))
  return {
    activity: h.paused ? `${peteText(ACTIVITY_NAMES[world.peace.activity])} · Bezahlter Bauauftrag wartet. Material und Fortschritt bleiben erhalten.` : h.task === 'finishOrder' && h.infrastructure.order && h.infrastructure[h.infrastructure.order] === 3
      ? 'Ich erledige einen bezahlten Versorgungsauftrag für meine bestehenden Anlagen.' : h.task ? HOME_TASK_LABELS[h.task] : ACTIVITY_NAMES[world.peace.activity],
    connections: h.infrastructure.links.map(link => ({ name: LINK_NAMES[link.kind], target: link.target, reason: connectionGuide(world, link.parts[2].tile)?.reason ?? 'Verbindung wird geprüft.' })),
    orders: PERSONALITY_PATHS.filter(path => early.includes(path) || recurring.includes(path)),
    nextOrderSeconds: Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - world.timeMs) / 1000)) : 0,
  }
}
export type WorkStatus = ReturnType<typeof workStatus>
