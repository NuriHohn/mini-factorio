import type { InserterInspection } from '../simulation/inspection'
import { ITEM_DEFINITIONS } from '../simulation/items'

const statuses = { 'waiting-input': 'Waiting for compatible input', 'output-blocked': 'Output blocked', moving: 'Moving item', returning: 'Returning' }
export function InserterInspector({ inspection }: { inspection: InserterInspection }) {
  const moving = inspection.status === 'moving' || inspection.status === 'returning'
  return <>
    <h2>Inserter</h2>
    <div className="stats"><span>Status</span><b>{moving && inspection.electrical.speedFraction === 0 ? 'Paused · no power' : statuses[inspection.status]}</b></div>
    <div className="stats"><span>Held item</span><b>{inspection.item ? ITEM_DEFINITIONS[inspection.item].label : 'Empty'}</b></div>
    <div className="stats"><span>Output direction</span><b>{inspection.direction}</b></div>
    <div className="stats"><span>Pickup tile</span><b>{inspection.pickup.x}, {inspection.pickup.y} · {inspection.source ?? 'empty'}</b></div>
    <div className="stats"><span>Drop tile</span><b>{inspection.drop.x}, {inspection.drop.y} · {inspection.target ?? 'empty'}</b></div>
    <div className="stats"><span>Nominal cycle</span><b>{inspection.cycleMs / 1000} s · 1 item</b></div>
    <div className="stats"><span>Cycle progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
    <progress aria-label="Inserter cycle progress" value={inspection.progress} max={1} />
    <p className="inspection-note">Picks up behind and drops ahead. Extracts finished machine output only from its front face. Blocked output and outages preserve the held item; removal discards it.</p>
  </>
}
