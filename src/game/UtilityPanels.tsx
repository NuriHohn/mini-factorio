import { GraphicsOptions } from './GraphicsOptions'
import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import { SaveControls } from './SaveControls'
import { FactoryOverview } from './FactoryOverview'
import { HelpContents } from './HelpContents'
export function UtilityPanels() {
  const { uiPanel, closePanel, powerOverlay, togglePowerOverlay } = useGameStore()
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!uiPanel) return
    const previous = document.activeElement
    close.current?.focus()
    return () => {
      const state = useGameStore.getState()
      if (state.uiPanel === null && !state.researchOpen && !state.analyticsOpen && previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [uiPanel])
  if (!uiPanel) return null
  return <section className="utility-panel" role="dialog" aria-modal="false" aria-labelledby="utility-title">
    <div className="panel-heading"><h2 id="utility-title">{uiPanel === 'menu' ? 'Game menu' : uiPanel === 'help' ? 'Help' : 'Factory overview'}</h2><button ref={close} className="save-action" aria-label={`Close ${uiPanel === 'menu' ? 'game menu' : uiPanel === 'help' ? 'help' : 'factory overview'}`} onClick={closePanel}>Close ×</button></div>
    {uiPanel === 'menu' ? <>
      <SaveControls />
      <h3>Options</h3>
      <GraphicsOptions />
      <button className="save-action" aria-pressed={powerOverlay} onClick={togglePowerOverlay}>ϟ Power coverage {powerOverlay ? 'on' : 'off'}</button>
    </> : uiPanel === 'help' ? <HelpContents /> : <FactoryOverview />}
  </section>
}
