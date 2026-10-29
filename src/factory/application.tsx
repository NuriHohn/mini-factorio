import { RevengeHUD } from '../game/RevengeHUD'
import { ResearchPanel } from '../game/ResearchPanel'
import { AnalyticsPanel } from '../game/AnalyticsPanel'
import { BuildToolbar } from '../game/BuildToolbar'
import { UtilityPanels } from '../game/UtilityPanels'
import { ConstructionResources } from '../game/ConstructionResources'
import { useGameStore } from '../state/gameStore'
import { hasTechnology } from '../simulation/research'
export function HeaderActions() {
  const { uiPanel, togglePanel, powerOverlay, togglePowerOverlay, analyticsOpen, toggleAnalytics, research } = useGameStore()
  const analyticsUnlocked = hasTechnology(research, 'analytics1')
  return <><ConstructionResources />
    <ResearchPanel />
    <button className="hud-button" title="Factory overview · storage, production and power" aria-label="Factory overview" aria-expanded={uiPanel === 'overview'} onClick={() => togglePanel('overview')}><span aria-hidden="true">▥</span><span className="hud-label">Overview</span></button>
    <button className="hud-button" title={analyticsUnlocked ? 'Production analytics' : 'Requires Analytics I.'} aria-label="Production analytics" aria-expanded={analyticsOpen} disabled={!analyticsUnlocked} onClick={toggleAnalytics}><span aria-hidden="true">▥</span><span className="hud-label">Analytics</span>{!analyticsUnlocked && <span className="lock-mark" aria-hidden="true">🔒</span>}</button>
    <button className="hud-button" title="Power coverage (P)" aria-label="Power coverage" aria-pressed={powerOverlay} onClick={togglePowerOverlay}><span aria-hidden="true">ϟ</span><span className="hud-label">Power</span></button>
  </>
}
export function WorldHeading() { return <RevengeHUD /> }
export function Panels() { return <><UtilityPanels /><AnalyticsPanel /></> }
export const Toolbar = BuildToolbar
