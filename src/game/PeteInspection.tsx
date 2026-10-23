import type { PeteStatus } from '../simulation/peteStatus'
import { useGameStore } from '../state/gameStore'
import { PersonalityOverview } from './PersonalityOverview'
export function PeteInspection({ status }: { status: PeteStatus }) {
  return <aside className="building-inspection" aria-label="Pete inspection">
    <button className="panel-dismiss" aria-label="Close Pete inspection" onClick={() => useGameStore.setState({ peteInspection: null })}>×</button>
    <section className="inspection"><div className="inspection-summary">
      <h2>🎃 Pete</h2><p role="status">Right now: {status.activity}</p>
      {status.current && <p>My current project: <strong>{status.current}</strong></p>}
      {status.wish && <><h3>I would like to try: {status.wish.name}</h3><p>{status.wish.reason}</p><p className="inspection-note">A wish, not a fixed order. My next decision depends on materials and space.</p></>}
      <PersonalityOverview personality={status.personality} />
      <details><summary>Projects and requirements</summary>{status.projects.map(project => <div key={project.id}><h3>{project.name}</h3><p>{project.reason}</p></div>)}</details>
    </div></section>
  </aside>
}
