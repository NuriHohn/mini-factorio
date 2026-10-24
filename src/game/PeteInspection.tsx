import type { PeteStatus } from '../simulation/peteStatus'
import { useGameStore } from '../state/gameStore'
import { PersonalityOverview } from './PersonalityOverview'
export function PeteInspection({ status }: { status: PeteStatus }) {
  return <aside className="building-inspection" aria-label="Pete inspection">
    <button className="panel-dismiss" aria-label="Close Pete inspection" onClick={() => useGameStore.setState({ peteInspection: null })}>×</button>
    <section className="inspection"><div className="inspection-summary">
      <h2>🎃 Pete</h2><p role="status">Right now: {status.activity}</p>
      {status.progress !== null && <progress aria-label="Current activity progress" max={100} value={status.progress} />}
      {status.developments.length > 0 && <p className="pete-carrying">Carrying: <strong>{status.carrying}</strong></p>}
      {status.current && <p>My current project: <strong>{status.current}</strong></p>}
      {status.wish && <><h3>I would like to try: {status.wish.name}</h3><p>{status.wish.reason}</p><p className="inspection-note">A wish, not a fixed order. My next decision depends on materials and space.</p></>}
      <p>{status.yard}</p>
      {status.developments.length > 0 && <details className="development-details" open><summary>Daily activities and supplies</summary>{status.developments.map(d => <div key={d.id}><h3>{d.name}</h3><p>{d.stock}</p><p>{d.reason}</p></div>)}</details>}
      <PersonalityOverview personality={status.personality} />
      <details><summary>Projects and requirements</summary>{status.projects.map(project => <div key={project.id}><h3>{project.name}</h3><p>{project.reason}</p></div>)}</details>
    </div></section>
  </aside>
}
