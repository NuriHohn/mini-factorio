import { PATH_LABELS, PERSONALITY_PATHS } from '../simulation/personality'
import type { PeteStatus } from '../simulation/peteStatus'
import { useGameStore } from '../state/gameStore'
import { PersonalityOverview } from './PersonalityOverview'
import { ProcessCards } from './LearningAids'
export function PeteInspection({ status }: { status: PeteStatus }) {
  const { petePathVisible } = useGameStore()
  return <aside className="building-inspection" aria-label="Pete inspection">
    <button className="panel-dismiss" aria-label="Close Pete inspection" onClick={() => useGameStore.setState({ peteInspection: null })}>×</button>
    <section className="inspection"><div className="inspection-summary">
      <h2>🎃 Pete</h2><p role="status">Right now: {status.activity}</p>
      {!status.activity.includes(status.intent) && <p>{status.intent}</p>}<button className="save-action" aria-pressed={petePathVisible} onClick={() => useGameStore.setState({ petePathVisible: !petePathVisible })}>{petePathVisible ? 'Hide Pete’s route' : 'Show Pete’s route'}</button><p className="inspection-note">Green marks show Pete’s actual planned walk and next stop. If he is waiting or choosing, there may be no route yet.</p>
      {status.progress !== null && <progress aria-label="Current activity progress" max={1} value={status.progress} />}
      <p className="pete-carrying">Carrying: <strong>{status.carrying}</strong></p>
      {status.current && <p>My current project: <strong>{status.current}</strong></p>}
      {status.wish && <><h3>I would like to try ({status.wish.path ? PATH_LABELS[status.wish.path] : 'Rebuilding'}): {status.wish.name}</h3><p>{status.wish.reason}</p><p className="inspection-note">A wish, not a fixed order. My next decision depends on materials and space.</p></>}
      <p>{status.yard}</p>
      <ProcessCards />
      {status.developments.length > 0 && <details className="development-details" open><summary>Daily activities and supplies</summary>{status.developments.map(d => <div key={d.id}><h3>{d.name}</h3><p>{d.stock}</p><p>{d.reason}</p></div>)}</details>}
      <PersonalityOverview personality={status.personality} />
      <details><summary>Projects and requirements</summary>{[...PERSONALITY_PATHS, null].map(path => {
        const projects = status.projects.filter(project => project.path === path)
        return projects.length > 0 && <section key={path ?? 'rebuilding'} aria-label={path ? `${PATH_LABELS[path]} projects` : 'Rebuilding projects'}><h3>{path ? PATH_LABELS[path] : 'Wiederaufbau'}</h3>{projects.map(project => <div key={project.id}><h4>{project.name}</h4><p>{project.reason}</p></div>)}</section>
      })}</details>
    </div></section>
  </aside>
}
