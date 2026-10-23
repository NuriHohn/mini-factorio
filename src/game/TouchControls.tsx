import { useGameStore } from '../state/gameStore'
export function TouchControls() {
  const { touchActive, touchToolsOpen, touchPlacement, touchAnchor, rotate, select } = useGameStore()
  if (!touchActive) return null
  return <>
    <div className="touch-controls" role="group" aria-label="Touch controls">
      <button className="save-action" aria-expanded={touchToolsOpen} onClick={() => useGameStore.setState({ touchToolsOpen: !touchToolsOpen })}>Tools</button>
      <button className="save-action" onClick={() => select(null)}>Inspect</button>
    </div>
    {touchPlacement && <div className="touch-target-actions" style={{ left: `${Math.min(60, touchAnchor.x)}%`, top: `${Math.max(0, Math.min(75, touchAnchor.y - 12))}%` }}>
      <span>Tap target again to build</span><button className="save-action" aria-label="Rotate touch target" onClick={rotate}>↻</button><button className="save-action" aria-label="Cancel touch target" onClick={() => useGameStore.setState({ touchRequest: 'cancel' })}>×</button>
    </div>}
  </>
}
