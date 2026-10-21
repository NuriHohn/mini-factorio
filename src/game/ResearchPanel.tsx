import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { purchaseError, formatResearchBalance, TECHNOLOGIES, TECHNOLOGY_IDS } from '../simulation/research'
import type { TechnologyId } from '../simulation/research'
import { TECHNOLOGY_GROUPS, TECHNOLOGY_ICONS, technologyView } from '../state/uiMetadata'

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
  const technology = TECHNOLOGIES[selected], view = technologyView(research, selected, researchRequest)
  const error = purchaseError(research, selected)
  const ready = TECHNOLOGY_IDS.filter(id => technologyView(research, id).state === 'ready').length
  return <>
    <button ref={trigger} className="research-toggle" title={`Technology · ${formatResearchBalance(research)} research points · ${researchRate.toFixed(2)} points/min · ${ready} ready to unlock`} aria-label="Research" aria-haspopup="dialog" aria-expanded={researchOpen} onClick={toggleResearch}>
      <span className="research-icon" aria-hidden="true">✦</span><span>Research <b>{formatResearchBalance(research)} <abbr title="Research points">RP</abbr></b><small>{researchRate.toFixed(2)} RP/min</small></span>{ready > 0 && <span className="research-ready" aria-label={`${ready} technologies ready to unlock`}>{ready}</span>}
    </button>
    <dialog ref={panel} className="research-panel" aria-labelledby="research-title" onCancel={event => { event.preventDefault(); if (researchOpen) toggleResearch() }}>
      <div className="research-heading"><div><h2 id="research-title">✦ Technology</h2><p>{formatResearchBalance(research)} research points · {researchRate.toFixed(2)} per minute</p></div><button className="save-action" onClick={toggleResearch} aria-label="Close technology panel">Close ×</button></div>
      <p className="inspection-note">Working machines earn points. Choose an unlock when you have enough. Your factory keeps running.</p>
      <div className="research-layout">
        <div aria-label="Technology tree">{TECHNOLOGY_GROUPS.map(group => <section key={group.label} className="technology-group" aria-label={group.label}>
          <h3>{group.label}</h3><div className="technology-cards">{group.ids.map(id => {
            const tech = TECHNOLOGIES[id], card = technologyView(research, id, researchRequest)
            return <button className={`technology-card technology-${card.state}`} key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>
              <span className="technology-name"><span className="technology-icon" aria-hidden="true">{TECHNOLOGY_ICONS[id]}</span><strong>{tech.name}</strong></span>
              <span>{card.symbol} {card.label} <b>{tech.cost} RP</b></span>
              {card.state !== 'researched' && <progress aria-label={`${tech.name} balance toward cost`} max={100} value={card.progress} />}
              {tech.prerequisite && <small>↳ {TECHNOLOGIES[tech.prerequisite].name}</small>}
            </button>
          })}</div>
        </section>)}</div>
        <section aria-label="Selected technology" className="technology-detail">
          <span className="technology-detail-icon" aria-hidden="true">{TECHNOLOGY_ICONS[selected]}</span>
          <h3>{technology.name}</h3><p>{technology.unlock}</p>
          <p>{view.symbol} {view.label}</p>
          <p>{technology.cost} research points<br /><small>{technology.prerequisite ? `Requires ${TECHNOLOGIES[technology.prerequisite].name}` : 'Available from the start'}</small></p>
          {view.state !== 'researched' && <><progress aria-label="Selected technology balance toward cost" max={100} value={view.progress} /><p className="inspection-note">{view.balance} / {technology.cost} points available. Points are shared between all choices; this is not a timed research task.</p></>}
          <button className="save-action purchase-technology" disabled={!!error || researchRequest !== null} onClick={() => requestResearch(selected)}>{view.state === 'researched' ? '✓ Researched' : `Unlock ${technology.name}`}</button>
          <p className="inspection-note">{error ?? 'Ready to unlock.'}</p>
        </section>
      </div>
      <p role="status" className="research-feedback">{researchFeedback}</p>
    </dialog>
  </>
}
