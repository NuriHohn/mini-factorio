import { useGameText } from './useGameText'
import { useGraphicsSettings } from '../state/graphicsSettings'
export function GraphicsOptions() {
  const t = useGameText()
  const mode = useGraphicsSettings(state => state.mode)
  const setMode = useGraphicsSettings(state => state.setMode)
  const diagnostics = useGraphicsSettings(state => state.diagnostics)
  const toggle = useGraphicsSettings(state => state.toggleDiagnostics)
  return <div className="graphics-options">
    <label>{t('Graphics')} <select aria-label={t('Graphics mode')} value={mode} onChange={event => setMode(event.target.value === 'energy-saving' ? 'energy-saving' : 'standard')}>
      <option value="standard">Standard · 60 FPS</option><option value="energy-saving">{t('Energy Saving · 30 FPS')}</option>
    </select></label>
    <button className="save-action" aria-pressed={diagnostics} onClick={toggle}>{t('Performance diagnostics')} {diagnostics ? t('on') : t('off')}</button>
  </div>
}
export function PerformanceOverlay() {
  const t = useGameText()
  const enabled = useGraphicsSettings(state => state.diagnostics)
  const stats = useGraphicsSettings(state => state.stats)
  if (!enabled) return null
  return <output className="performance-overlay" aria-label={t('Performance diagnostics')}>{stats ? t(`${stats.fps.toFixed(1)} rendered FPS · ${stats.frameMs.toFixed(1)} ms/frame\n${stats.workMs.toFixed(2)} ms update + render submission\n${stats.tickMs.toFixed(2)} ms/tick (batch average) · ${stats.buildings} buildings drawn`) : t('Measuring performance…')}</output>
}
