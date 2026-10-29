import { useGameText } from './useGameText'
import { GraphicsOptions } from './GraphicsOptions'
import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import { SaveControls } from './SaveControls'
import type { ComponentType } from 'react'
export function UtilityPanelFrame({ Help, Overview }: { Help: ComponentType; Overview?: ComponentType }) {
  const t = useGameText()
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
    <div className="panel-heading"><h2 id="utility-title">{uiPanel === 'menu' ? t('Game menu') : uiPanel === 'help' ? t('Help') : 'Factory overview'}</h2><button ref={close} className="save-action" aria-label={t(`Close ${uiPanel === 'menu' ? 'game menu' : uiPanel === 'help' ? 'help' : 'factory overview'}`)} onClick={closePanel}>{t('Close ×')}</button></div>
    {uiPanel === 'menu' ? <>
      <SaveControls />
      <h3>{t('Options')}</h3>
      <GraphicsOptions />
      <button className="save-action" aria-pressed={powerOverlay} onClick={togglePowerOverlay}>ϟ {t('Power coverage')} {powerOverlay ? t('on') : t('off')}</button>
    </> : uiPanel === 'help' ? <Help /> : Overview ? <Overview /> : null}
  </section>
}
