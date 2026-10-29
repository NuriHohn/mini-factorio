import { connectionGuide } from '../simulation/connectionGuide'
import { recurringOrderReady } from '../simulation/infrastructure'
import { HOME_TASK_LABELS } from '../simulation/homestead'
import { ACTIVITY_NAMES } from '../simulation/peteStatus'
import { LINK_NAMES } from '../simulation/infrastructureRules'
import { PERSONALITY_PATHS } from '../simulation/personality'
import type { World } from '../simulation/world'

export function workStatus(world: World) {
  const h = world.homestead
  if (!h) return null
  return {
    activity: h.task === 'finishOrder' && h.infrastructure.order && h.infrastructure[h.infrastructure.order] === 3
      ? 'Ich erledige einen bezahlten Versorgungsauftrag für meine bestehenden Anlagen.' : h.task ? HOME_TASK_LABELS[h.task] : ACTIVITY_NAMES[world.peace.activity],
    connections: h.infrastructure.links.map(link => ({ name: LINK_NAMES[link.kind], target: link.target, reason: connectionGuide(world, link.parts[2].tile)?.reason ?? 'Verbindung wird geprüft.' })),
    orders: PERSONALITY_PATHS.filter(path => recurringOrderReady(world, path)),
    nextOrderSeconds: Math.max(0, Math.ceil((h.infrastructure.nextOrderAtMs - world.timeMs) / 1000)),
  }
}
export type WorkStatus = ReturnType<typeof workStatus>
