import { useGameText } from './useGameText'
import { PATH_LABELS, PERSONALITY_PATHS } from '../simulation/personality'
import type { PeteStatus, ProjectStatus } from '../simulation/peteStatus'
import { useGameStore } from '../state/gameStore'
import { PersonalityOverview } from './PersonalityOverview'
import { ProcessCards } from './LearningAids'
const PATH_ICONS = { eco: '🌱', craftsman: '🔨', inventor: '💡', industrial: '🏭' }
export function PeteInspection({ status }: { status: PeteStatus }) {
  const t = useGameText()
  const { petePathVisible, prioritizeProject } = useGameStore()
  const priority = status.projects.find(p => p.prioritized && !p.completed)
  const row = (project: ProjectStatus) => <details className="project-row" key={project.id}>
    <summary><span aria-hidden="true">{project.completed ? '✓' : project.name === status.current ? '🔨' : project.prioritized ? '🎯' : project.selectable || project.ready ? '○' : '🔒'}</span> {t(project.name)}{project.prioritized && <small>Priorität</small>}</summary>
    <p>{t(project.reason)}</p>
    {project.selectable && <button className="save-action" aria-pressed={!!project.prioritized} onClick={() => prioritizeProject(project.prioritized ? null : project.id)}>{project.prioritized ? 'Priorität aufheben' : '🎯 Priorisieren'}</button>}
  </details>
  return <aside className="building-inspection pete-inspector" aria-label={t('Pete inspection')}>
    <button className="panel-dismiss" aria-label={t('Close Pete inspection')} onClick={() => useGameStore.setState({ peteInspection: null })}>×</button>
    <section className="inspection"><div className="inspection-summary">
      <h2>🎃 Pete</h2>
      <section className="pete-current" aria-label="Aktuelles Vorhaben">
        <small>{priority ? '🎯 Mein Hauptziel' : '🔨 Aktuelle Arbeit'}</small>
        <h3>{t(priority?.name ?? status.current ?? 'Meine Basis aufbauen')}</h3>
        <p role="status">{t(status.activity)}</p>
        {status.progress !== null && <progress aria-label={t('Current activity progress')} max={1} value={status.progress} />}
        <details><summary>Transport und nächster Schritt</summary><p>{t(status.intent)}</p><p>🎒 {t(status.carrying)}</p>{priority && <p>{t(priority.reason)}</p>}<p>{t(status.yard)}</p></details>
      </section>
      <button className="save-action" aria-pressed={petePathVisible} onClick={() => useGameStore.setState({ petePathVisible: !petePathVisible })}>{petePathVisible ? 'Route ausblenden' : '👣 Route zeigen'}</button>
      <section aria-label="Nächste Entwicklung"><h3>Entwicklungspfade</h3>
      {PERSONALITY_PATHS.map(path => {
        const projects = status.projects.filter(p => p.path === path)
        const finished = projects.filter(p => p.completed), pending = projects.filter(p => !p.completed)
        const next = status.next?.find(step => step.path === path)
        return <details className="pete-path-group" key={path} aria-label={t(`${PATH_LABELS[path]} projects`)}>
          <summary><span aria-hidden="true">{PATH_ICONS[path]}</span> {t(PATH_LABELS[path])}<small>Lv. {status.personality.paths[path].level} · {next ? `${next.completion.finished}/${next.completion.total}` : `${finished.length}/${projects.length}`} ✓</small></summary>
          {next && <div className="path-next"><strong>{t(next.name)}</strong><small>{next.completion.level === next.completion.maxLevel ? 'Levelmaximum erreicht · ' : ''}{next.completion.state === 'complete' ? 'Ausbau abgeschlossen' : next.completion.state === 'rebuilding' ? 'Wiederaufbau offen' : 'Ausbau offen'}</small><p>{next.phase} · {next.progress}</p>{next.target !== null && <button className="save-action" aria-label={`Ort zeigen: ${t(next.name)}`} onClick={() => useGameStore.getState().focusPeteProject(next.target!)}>📍 Ort zeigen</button>}<details><summary>Bedarf und Hindernisse</summary><p>{t(next.reason)}</p>{next.missing.length > 0 && <p>Fehlt: {t(next.missing.join(', '))}</p>}{next.blockage && <p>{t(next.blockage)}</p>}</details></div>}
          {pending.map(row)}
          {finished.length > 0 && <details className="completed-projects"><summary>✓ {finished.length} abgeschlossen</summary>{finished.map(row)}</details>}
        </details>
      })}</section>
      {status.projects.some(p => p.path === null) && <details><summary>🛠 Wiederaufbau</summary>{status.projects.filter(p => p.path === null).map(row)}</details>}
      <details><summary>🌿 Alltag und Versorgung</summary>{status.developments.map(d => <details key={d.id}><summary>{t(d.name)}</summary><p>{t(d.stock)}</p><p>{t(d.reason)}</p></details>)}</details>
      <details><summary>📊 Persönlichkeit und Hilfe</summary><PersonalityOverview personality={status.personality} /><ProcessCards /></details>
    </div></section>
  </aside>
}
