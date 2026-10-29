import { useGameStore } from '../state/gameStore'
import { peteText } from '../pete/text'
const original = (text: string) => text
export function useGameText() {
  return useGameStore(state => state.playMode) === 'petesWorld' ? peteText : original
}
