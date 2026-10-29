import { useGameText } from './useGameText'
import { useId, useState } from 'react'
import { useGameStore } from '../state/gameStore'

export function ProcessCards() {
  const t = useGameText()
  const { processes } = useGameStore()
  if (!processes.length) return null
  return <details className="learning-processes" open><summary>{t('How this works')}</summary>{processes.map(p => <section key={t(p.title)}>
    <h3>{t(p.title)}</h3><ol className="process-steps">{p.steps.map((step, i) => <li key={t(step)} aria-current={p.active === i ? 'step' : undefined}><span>{t(step)}</span>{i < p.steps.length - 1 && <span aria-hidden="true"> → </span>}</li>)}</ol><p>{t(p.stock)}</p>
  </section>)}</details>
}
export function MachineHelp() {
  const t = useGameText()
  const { machineHelp, connectionVisible } = useGameStore()
  if (!machineHelp) return null
  return <section className="learning-card" aria-label={t('Machine guidance')}><h3>{t('What is happening?')}</h3><p>{t(machineHelp.reason)}</p><p>{t(machineHelp.action)}</p>{machineHelp.source !== undefined && <button className="save-action" onClick={() => useGameStore.getState().focusPeteProject(machineHelp.source!)}>Quelle zeigen</button>}{machineHelp.target !== undefined && <button className="save-action" onClick={() => useGameStore.getState().focusPeteProject(machineHelp.target!)}>Ziel zeigen</button>}
    <button className="save-action" aria-pressed={connectionVisible} onClick={() => useGameStore.setState({ connectionVisible: !connectionVisible })}>{connectionVisible ? t('Hide connection') : t('Highlight connection')}</button>
    {connectionVisible && <p>{t('Amber marks the route; blue marks its source and green its destination when available.')}</p>}
  </section>
}
export function SupplyAssistant() {
  const t = useGameText()
  const { playMode, supplies, inspected, supplyRequest } = useGameStore()
  const [selected, setSelected] = useState(''), selectId = useId()
  const offer = supplies.find(o => o.id === selected) ?? supplies[0]
  if (inspected === null || !offer) return <p>{t('No material-funded project is unlocked right now. Pete’s inspection explains prerequisites.')}</p>
  if (playMode === 'petesWorld') return <section className="learning-card" aria-label="Lager und Projekte"><h3>Material für Petes Projekte</h3>{supplies.map(o => <p key={o.id}>{o.name}: {o.amounts.map(r => `${r.stored}/${r.required} ${r.label}`).join(' · ')}</p>)}<p>Pete holt das Material selbst. Du platzierst nur Ressourcen in seiner Nähe.</p></section>
  return <section className="learning-card" aria-label="Supply assistant"><h3>Supply a project</h3>
    <label htmlFor={selectId}>What would you like to support?</label><select id={selectId} value={offer.id} onChange={e => setSelected(e.target.value)}>{supplies.map(o => <option key={o.id} value={o.id}>{o.name}{o.id === 'yard' || o.id === 'run' ? ' · per missing fence section' : ''}</option>)}</select>
    {offer.amounts.map(a => <div className="supply-amount" key={a.material}><strong>{a.label}</strong><span>{Math.min(a.required, a.stored)}/{a.required} supplied · {Math.max(0, a.required - a.stored)} missing</span><small>{a.available} available {a.material === 'wood' ? 'in your Wood stock' : 'in storage chests within 3 tiles'}</small></div>)}
    <button className="save-action" disabled={!offer.transferable || !!supplyRequest} onClick={() => useGameStore.setState({ supplyRequest: { index: inspected, id: offer.id } })}>Supply missing materials · up to {offer.transferable}</button>
    <p>{offer.free} free crate slots. Only missing materials move: Wood from your stock, parts from storage chests within three walking-grid tiles. This does not create items, award XP or order Pete to build.</p>
  </section>
}
export function LittleGoals() {
  const { goals, pinnedGoal } = useGameStore()
  return <div className="little-goals"><p>Choose something to try, or ignore these goals. No timer, penalties or extra rewards. Progress comes from actual production and completed projects in this world.</p>{goals.map(g => <section key={g.id} className="learning-card">
    <h3>{g.complete ? '✓ ' : ''}{g.title}</h3><p>{g.hint}</p><progress aria-label={`${g.title} progress`} value={g.value} max={g.target} /><p>{g.value}/{g.target}{g.complete ? ' · Done!' : ''}</p>
    <button className="save-action" aria-pressed={pinnedGoal === g.id} onClick={() => useGameStore.setState({ pinnedGoal: pinnedGoal === g.id ? null : g.id })}>{pinnedGoal === g.id ? 'Unpin goal' : 'Pin above the world'}</button>
  </section>)}</div>
}
export function PinnedGoal() {
  const { goals, pinnedGoal } = useGameStore()
  const goal = goals.find(g => g.id === pinnedGoal)
  if (!goal) return null
  return <div className="pinned-goal" role="status"><span>{goal.complete ? '✓ ' : ''}{goal.title} · {goal.value}/{goal.target}</span><button className="save-action" aria-label="Unpin learning goal" onClick={() => useGameStore.setState({ pinnedGoal: null })}>×</button></div>
}
