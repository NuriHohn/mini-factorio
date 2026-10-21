import { useGraphicsSettings } from '../state/graphicsSettings'
export function GraphicsOptions() {
  const mode = useGraphicsSettings(state => state.mode)
  const setMode = useGraphicsSettings(state => state.setMode)
  const diagnostics = useGraphicsSettings(state => state.diagnostics)
  const toggle = useGraphicsSettings(state => state.toggleDiagnostics)
  return <div className="graphics-options">
    <label>Graphics <select aria-label="Graphics mode" value={mode} onChange={event => setMode(event.target.value === 'energy-saving' ? 'energy-saving' : 'standard')}>
      <option value="standard">Standard · 60 FPS</option><option value="energy-saving">Energy Saving · 30 FPS</option>
    </select></label>
    <button className="save-action" aria-pressed={diagnostics} onClick={toggle}>Performance diagnostics {diagnostics ? 'on' : 'off'}</button>
  </div>
}
export function PerformanceOverlay() {
  const enabled = useGraphicsSettings(state => state.diagnostics)
  const stats = useGraphicsSettings(state => state.stats)
  if (!enabled) return null
  return <output className="performance-overlay" aria-label="Performance diagnostics">{stats ? `${stats.fps.toFixed(1)} rendered FPS · ${stats.frameMs.toFixed(1)} ms/frame\n${stats.workMs.toFixed(2)} ms update + render submission\n${stats.tickMs.toFixed(2)} ms/tick (batch average) · ${stats.buildings} buildings drawn` : 'Measuring performance…'}</output>
}
