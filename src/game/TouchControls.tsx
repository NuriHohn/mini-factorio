import { useGameStore } from '../state/gameStore'
import { toolMetadata } from '../state/toolMetadata'
export function TouchControls() {
  const { touchActive, touchToolsOpen, touchPlacement, touchAnchor, rotate, select, tool, peteInspection, inspected } = useGameStore()
  if (!touchActive) return null
  return <>
    {!peteInspection && inspected === null && <div className="touch-controls" role="group" aria-label="Touch controls">
      <button className="save-action" aria-expanded={touchToolsOpen} onClick={() => useGameStore.setState({ touchToolsOpen: !touchToolsOpen })}>Tools</button>
      <button className="save-action" onClick={() => select(null)}>Inspect</button>
      {tool && <span className="touch-selected-tool" role="status">{toolMetadata(tool)?.label ?? tool}</span>}
    </div>}
    {touchPlacement && <div className="touch-target-actions" style={{ left: `clamp(4px, ${touchAnchor.x}%, calc(100% - 216px))`, top: `${Math.max(0, Math.min(65, touchAnchor.y - 18))}%` }}>
      <span>Tap target again to build</span><button className="save-action" aria-label="Rotate touch target" onClick={rotate}>↻</button><button className="save-action" aria-label="Cancel touch target" onClick={() => useGameStore.setState({ touchRequest: 'cancel' })}>×</button>
    </div>}
  </>
}
