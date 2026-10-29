import { UtilityPanelFrame } from '../game/UtilityPanelFrame'
import { PeteHelp } from './Help'
import { PeteToolbar } from './Toolbar'
import { useGameStore } from '../state/gameStore'
import { PATH_LABELS } from '../simulation/personality'
import { peteText } from './text'
export function HeaderActions() { return null }
export function WorldHeading() {
  const status = useGameStore(state => state.workStatus)
  return <details className="pete-work-status"><summary>♥ Pete lebt und baut seine Welt · Arbeit und Warenfluss</summary>
    {status && <><p>{peteText(status.activity)}</p>{status.connections.map(link => <p key={link.name}><strong>{link.name}:</strong> {peteText(link.reason)} <button className="save-action" onClick={() => useGameStore.getState().focusPeteProject(link.target)}>Ziel zeigen</button></p>)}
      {status.orders.length > 0 && <p>Wiederkehrende Versorgung: {status.orders.map(path => peteText(PATH_LABELS[path])).join(', ')} · {status.nextOrderSeconds ? `nächster Auftrag frühestens in ${status.nextOrderSeconds} s` : 'bereit, sobald Material und Zugang verfügbar sind'}.</p>}</>}
  </details>
}
export function Panels() { return <UtilityPanelFrame Help={PeteHelp} /> }
export const Toolbar = PeteToolbar
