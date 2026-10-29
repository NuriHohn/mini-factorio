import { useGameStore } from '../state/gameStore'
import { PeteHelp } from '../pete/Help'
import { FactoryHelp } from '../factory/Help'
export function HelpContents() {
  const mode = useGameStore(state => state.playMode)
  return mode === 'petesWorld' ? <PeteHelp /> : <FactoryHelp />
}
