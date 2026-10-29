import { useGameText } from './useGameText'
import type { InserterInspection } from '../simulation/inspection'
import { ITEM_DEFINITIONS } from '../simulation/items'

const statuses = { 'waiting-input': 'Waiting for compatible input', 'output-blocked': 'Output blocked', moving: 'Moving item', returning: 'Returning' }
export function InserterInspector({ inspection }: { inspection: InserterInspection }) {
  const t = useGameText()
  const moving = inspection.status === 'moving' || inspection.status === 'returning'
  return <>
    <h2>{t('Inserter')}</h2>
    <div className="stats"><span>Status</span><b>{moving && inspection.electrical.speedFraction === 0 ? t('Paused · no power') : t(statuses[inspection.status])}</b></div>
    <div className="stats"><span>{t('Held item')}</span><b>{inspection.item ? t(ITEM_DEFINITIONS[inspection.item].label) : t('Empty')}</b></div>
    <div className="stats"><span>{t('Output direction')}</span><b>{t(inspection.direction)}</b></div>
    <div className="stats"><span>{t('Pickup tile')}</span><b>{inspection.pickup.x}, {inspection.pickup.y} · {inspection.source ?? 'empty'}</b></div>
    <div className="stats"><span>{t('Drop tile')}</span><b>{inspection.drop.x}, {inspection.drop.y} · {inspection.target ?? 'empty'}</b></div>
    <div className="stats"><span>{t('Nominal cycle')}</span><b>{inspection.cycleMs / 1000} s · 1 item</b></div>
    <div className="stats"><span>{t('Cycle progress')}</span><b>{Math.round(inspection.progress * 100)}%</b></div>
    <progress aria-label={t('Inserter cycle progress')} value={inspection.progress} max={1} />
    <p className="inspection-note">{t('Picks up behind and drops ahead. Extracts finished machine output only from its front face. Blocked output and outages preserve the held item; removal discards it.')}</p>
  </>
}
