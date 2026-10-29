import { useGameText } from './game/useGameText'
import { useEffect, useState } from 'react'
import { loadApplication } from './core/application'
import type { ApplicationParts, PlayMode } from './core/application'
import { TouchControls } from './game/TouchControls'
import { PinnedGoal } from './game/LearningAids'
import { SimulationSpeed } from './game/SimulationSpeed'
import { GameCanvas } from './game/GameCanvas'
import { BuildingInspection } from './game/BuildingInspection'
import { StatusMessage } from './game/StatusMessage'
import { useGameStore } from './state/gameStore'
export default function App({ initialParts }: { initialParts?: ApplicationParts } = {}) {
  const t = useGameText()
  const { playMode, uiPanel, togglePanel, touchActive, touchToolsOpen } = useGameStore()
  const [loaded, setLoaded] = useState<{ mode: PlayMode; parts: ApplicationParts } | null>(() => initialParts ? { mode: playMode, parts: initialParts } : null)
  useEffect(() => {
    document.title = playMode === 'petesWorld' ? 'Petes Welt' : 'Mini Factorio — Factory'
    let disposed = false
    void loadApplication(playMode).then(parts => { if (!disposed) setLoaded({ mode: playMode, parts }) })
    return () => { disposed = true }
  }, [playMode])
  const parts = loaded?.mode === playMode ? loaded.parts : null
  return <div className={`app-shell${playMode === 'petesWorld' ? ' pete-app' : ''}${touchActive ? ' touch-mode' : ''}${touchActive && !touchToolsOpen ? ' touch-tools-closed' : ''}`}>
    <header className="game-header">
      <div className="game-brand"><span className="brand-mark" aria-hidden="true">{playMode === 'petesWorld' ? 'P' : 'M'}</span><h1>{playMode === 'petesWorld' ? 'PETES WELT' : 'MINI FACTORIO'}</h1></div>
      <nav className="hud-actions" aria-label={t('Game navigation')}>
        {parts && <parts.HeaderActions />}
        <button className="hud-button" title={t('Help · How to Play and Controls')} aria-label={t('Help')} aria-expanded={uiPanel === 'help'} onClick={() => togglePanel('help')}><span aria-hidden="true">?</span><span className="hud-label">{t('Help')}</span></button>
        <button className="hud-button" title={t('Game menu · save, load and new game')} aria-label={t('Game menu')} aria-expanded={uiPanel === 'menu'} onClick={() => togglePanel('menu')}><span aria-hidden="true">☰</span><span className="hud-label">{t('Menu')}</span></button>
      </nav>
    </header>
    <main>
      <section className="world-panel" aria-label={playMode === 'petesWorld' ? 'Petes Welt' : 'Factory world'}>
        <div className="world-heading"><SimulationSpeed />{parts && <parts.WorldHeading />}</div>
        <div className="world-stage"><GameCanvas /><TouchControls /><PinnedGoal /><BuildingInspection />{parts && <parts.Panels />}</div>
        <StatusMessage />
      </section>
    </main>
    {parts && <parts.Toolbar />}
  </div>
}
