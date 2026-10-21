import { useGameStore } from '../state/gameStore'
import { WOOD_ICON } from '../state/uiMetadata'
export function ConstructionResources() {
  const wood = useGameStore(state => state.wood)
  return <div className="construction-resources" aria-label="Construction resources" title="Wood builds Pete’s Treehouse (20). Other buildings are free once unlocked.">
    <span aria-hidden="true">{WOOD_ICON}</span><span>Wood</span><strong aria-label={`${wood} Wood available`}>{wood.toLocaleString()}</strong>
  </div>
}
