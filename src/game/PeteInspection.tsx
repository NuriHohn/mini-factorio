import { useGameText } from './useGameText'
import { PATH_LABELS, PERSONALITY_PATHS } from '../simulation/personality'
import type { PeteStatus } from '../simulation/peteStatus'
import { useGameStore } from '../state/gameStore'
import { PersonalityOverview } from './PersonalityOverview'
import { ProcessCards } from './LearningAids'
export function PeteInspection({ status }: { status: PeteStatus }) {
  const t = useGameText()
  const { petePathVisible } = useGameStore()
  return <aside className="building-inspection" aria-label={t('Pete inspection')}>
    <button className="panel-dismiss" aria-label={t('Close Pete inspection')} onClick={() => useGameStore.setState({ peteInspection: null })}>×</button>
    <section className="inspection"><div className="inspection-summary">
      <h2>🎃 Pete</h2><p role="status">{t('Right now:')} {t(status.activity)}</p>
      {!status.activity.includes(status.intent) && <p>{t(status.intent)}</p>}<button className="save-action" aria-pressed={petePathVisible} onClick={() => useGameStore.setState({ petePathVisible: !petePathVisible })}>{petePathVisible ? t('Hide Pete’s route') : t('Show Pete’s route')}</button><p className="inspection-note">{t('Green marks show Pete’s actual planned walk and next stop. If he is waiting or choosing, there may be no route yet.')}</p>
      {status.progress !== null && <progress aria-label={t('Current activity progress')} max={1} value={status.progress} />}
      <p className="pete-carrying">{t('Carrying:')} <strong>{t(status.carrying)}</strong></p>
      {status.current && <p>{t('My current project:')} <strong>{t(status.current)}</strong></p>}
      {status.wish && <><h3>{t('I would like to try')} ({status.wish.path ? t(PATH_LABELS[status.wish.path]) : t('Rebuilding')}): {t(status.wish.name)}</h3><p>{t(status.wish.reason)}</p><p className="inspection-note">{t('A wish, not a fixed order. My next decision depends on materials and space.')}</p></>}
      <p>{t(status.yard)}</p>
      {status.next && status.next.length > 0 && <section aria-label="Nächste Entwicklung"><h3>Nächste Entwicklung</h3>{status.next.map(step => <div key={step.path}><h4>{t(PATH_LABELS[step.path])}: {t(step.name)}</h4><p>Level {step.completion.level}/{step.completion.maxLevel}{step.completion.level === step.completion.maxLevel ? ' · Levelmaximum erreicht' : ''} · Bauprojekte {step.completion.finished}/{step.completion.total} · {step.completion.state === 'complete' ? 'Ausbau abgeschlossen' : step.completion.state === 'rebuilding' ? 'Wiederaufbau offen' : 'Ausbau offen'}</p><p>{step.phase} · {step.progress}</p><p>{t(step.reason)}</p>{step.missing.length > 0 && <p>Fehlt: {t(step.missing.join(', '))}</p>}{step.blockage && <p>Blockiert: {t(step.blockage)}</p>}{step.target !== null && <button className="save-action" onClick={() => useGameStore.getState().focusPeteProject(step.target!)}>Ort zeigen: {t(step.name)}</button>}</div>)}</section>}
      <ProcessCards />
      {status.developments.length > 0 && <details className="development-details" open><summary>{t('Daily activities and supplies')}</summary>{status.developments.map(d => <div key={d.id}><h3>{t(d.name)}</h3><p>{t(d.stock)}</p><p>{t(d.reason)}</p></div>)}</details>}
      <PersonalityOverview personality={status.personality} />
      <details><summary>{t('Projects and requirements')}</summary>{[...PERSONALITY_PATHS, null].map(path => {
        const projects = status.projects.filter(project => project.path === path)
        return projects.length > 0 && <section key={path ?? 'rebuilding'} aria-label={path ? t(`${PATH_LABELS[path]} projects`) : t('Rebuilding projects')}><h3>{path ? t(PATH_LABELS[path]) : 'Wiederaufbau'}</h3>{projects.map(project => <div key={project.id}><h4>{t(project.name)}</h4><p>{t(project.reason)}</p></div>)}</section>
      })}</details>
    </div></section>
  </aside>
}
