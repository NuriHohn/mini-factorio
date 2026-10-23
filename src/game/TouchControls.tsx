import { useGameStore } from '../state/gameStore'
export function TouchControls() {
  const { touchActive, touchToolsOpen, touchPlacement, direction, rotate } = useGameStore()
  if (!touchActive) return null
  return <div className="touch-controls" role="group" aria-label="Touch controls">
    <button className="save-action" aria-expanded={touchToolsOpen} onClick={() => useGameStore.setState({ touchToolsOpen: !touchToolsOpen })}>Tools</button>
    {touchPlacement ? <><span>Target: {touchPlacement.end.x}, {touchPlacement.end.y}</span><button className="save-action" onClick={rotate}>Rotate · {direction}</button><button className="save-action" onClick={() => useGameStore.setState({ touchRequest: 'confirm' })}>Confirm</button><button className="save-action" onClick={() => useGameStore.setState({ touchRequest: 'cancel' })}>Cancel</button></> : <span>Drag to move · pinch to zoom · tap to inspect or choose a build target.</span>}
  </div>
}
