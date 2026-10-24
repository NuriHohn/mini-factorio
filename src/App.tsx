import { TouchControls } from './game/TouchControls'
import { PinnedGoal } from './game/LearningAids'
import { SimulationSpeed } from './game/SimulationSpeed'
import { RevengeHUD } from './game/RevengeHUD'
import { ResearchPanel } from './game/ResearchPanel'
import { AnalyticsPanel } from './game/AnalyticsPanel'
import { GameCanvas } from './game/GameCanvas'
import { BuildToolbar } from './game/BuildToolbar'
import { BuildingInspection } from './game/BuildingInspection'
import { ConstructionResources } from './game/ConstructionResources'
import { UtilityPanels } from './game/UtilityPanels'
import { StatusMessage } from './game/StatusMessage'
import { useGameStore } from './state/gameStore'
import { hasTechnology } from './simulation/research'
export default function App() {
  const { playMode, miniHint, inspected, peteInspection, uiPanel, togglePanel, powerOverlay, togglePowerOverlay, analyticsOpen, toggleAnalytics, research, touchActive, touchToolsOpen } = useGameStore()
  const analyticsUnlocked = hasTechnology(research, 'analytics1')
  return <div className={`app-shell${touchActive ? ' touch-mode' : ''}${touchActive && !touchToolsOpen ? ' touch-tools-closed' : ''}`}>
    <header className="game-header">
      <div className="game-brand"><span className="brand-mark" aria-hidden="true">M</span><h1>{playMode === 'petesWorld' ? 'PETES WELT' : 'MINI FACTORIO'}</h1></div>
      {playMode === 'factory' && <ConstructionResources />}
      <nav className="hud-actions" aria-label="Game navigation">
        {playMode === 'factory' && <ResearchPanel />}
        {playMode === 'factory' && <><button className="hud-button" title="Factory overview · storage, production and power" aria-label="Factory overview" aria-expanded={uiPanel === 'overview'} onClick={() => togglePanel('overview')}><span aria-hidden="true">▥</span><span className="hud-label">Overview</span></button>
        <button className="hud-button" title={analyticsUnlocked ? 'Production analytics' : 'Requires Analytics I.'} aria-label="Production analytics" aria-expanded={analyticsOpen} disabled={!analyticsUnlocked} onClick={toggleAnalytics}><span aria-hidden="true">▥</span><span className="hud-label">Analytics</span>{!analyticsUnlocked && <span className="lock-mark" aria-hidden="true">🔒</span>}</button>
        <button className="hud-button" title="Power coverage (P)" aria-label="Power coverage" aria-pressed={powerOverlay} onClick={togglePowerOverlay}><span aria-hidden="true">ϟ</span><span className="hud-label">Power</span></button></>}
        <button className="hud-button" title="Help · How to Play and Controls" aria-label="Help" aria-expanded={uiPanel === 'help'} onClick={() => togglePanel('help')}><span aria-hidden="true">?</span><span className="hud-label">Help</span></button>
        <button className="hud-button" title="Game menu · save, load and new game" aria-label="Game menu" aria-expanded={uiPanel === 'menu'} onClick={() => togglePanel('menu')}><span aria-hidden="true">☰</span><span className="hud-label">Menu</span></button>
      </nav>
    </header>
    <main>
      <section className="world-panel" aria-label="Factory world">
        <div className="world-heading"><SimulationSpeed />{playMode === 'factory' ? <RevengeHUD /> : <span>♥ Pete baut seine Welt</span>}</div>
        <div className="world-stage"><GameCanvas /><TouchControls /><PinnedGoal />{miniHint && inspected === null && !peteInspection && !uiPanel && <aside className="mini-world-hint" aria-live="polite">{miniHint}</aside>}<BuildingInspection /><UtilityPanels /><AnalyticsPanel /></div>
        <StatusMessage />
      </section>
    </main>
    <BuildToolbar />
  </div>
}
