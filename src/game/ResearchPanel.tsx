import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { hasTechnology, purchaseError, formatResearchBalance, TECHNOLOGIES, TECHNOLOGY_IDS } from '../simulation/research'
import type { TechnologyId } from '../simulation/research'

export function ResearchPanel() {
  const { research, researchRate, researchOpen, toggleResearch, requestResearch, researchRequest, researchFeedback } = useGameStore()
  const [selected, setSelected] = useState<TechnologyId>('logistics1')
  const panel = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (researchOpen) panel.current?.showModal()
    else if (panel.current?.open) { panel.current.close(); trigger.current?.focus() }
  }, [researchOpen])
  useEffect(() => {
    if (!researchFeedback) return
    const timer = window.setTimeout(() => useGameStore.setState({ researchFeedback: '' }), 4000)
    return () => window.clearTimeout(timer)
  }, [researchFeedback])
  const technology = TECHNOLOGIES[selected]
  const error = purchaseError(research, selected)
  const state = (id: TechnologyId) => {
    if (hasTechnology(research, id)) return 'Researched'
    const prerequisite = TECHNOLOGIES[id].prerequisite
    if (prerequisite && !hasTechnology(research, prerequisite)) return 'Locked'
    return purchaseError(research, id) ? 'Available · need RP' : 'Affordable'
  }
  return <>
    <button ref={trigger} className="research-toggle" aria-haspopup="dialog" aria-expanded={researchOpen} onClick={toggleResearch}>Research · {formatResearchBalance(research)} RP <small>{researchRate.toFixed(2)} RP/min</small></button>
    <dialog ref={panel} className="research-panel" aria-labelledby="research-title" onCancel={event => { event.preventDefault(); if (researchOpen) toggleResearch() }}>
      <div className="research-heading"><h2 id="research-title">Technology</h2><button className="save-action" onClick={toggleResearch} aria-label="Close technology panel">Close</button></div>
      <p>{formatResearchBalance(research)} RP available · {researchRate.toFixed(2)} RP/min</p>
      <p className="inspection-note">Productive miners earn 2, furnaces 5, and assemblers 12 RP/min at full speed. Research continues while this panel is open.</p>
      <div className="technology-cards" aria-label="Technology tree">{TECHNOLOGY_IDS.map(id => {
        const tech = TECHNOLOGIES[id]
        return <button className="technology-card" key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>
          <strong>{tech.name}</strong><span>{state(id)} · {tech.cost} RP</span>
          <small>{tech.prerequisite ? `${TECHNOLOGIES[tech.prerequisite].name} → ${tech.name}` : 'Starting technology'}</small>
          <small>{tech.unlock}</small>
        </button>
      })}</div>
      <section aria-label="Selected technology" className="technology-detail">
        <h3>{technology.name}</h3><p>{technology.unlock}</p>
        <p>{technology.cost} RP · {technology.prerequisite ? `Requires ${TECHNOLOGIES[technology.prerequisite].name}` : 'No prerequisite'}</p>
        <button className="save-action" disabled={!!error || researchRequest !== null} onClick={() => requestResearch(selected)}>Research {technology.name}</button>
        <p className="inspection-note">{error ?? 'Ready to research.'}</p>
      </section>
      <p role="status" className="research-feedback">{researchFeedback}</p>
    </dialog>
  </>
}
