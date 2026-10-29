import { UtilityPanelFrame } from '../game/UtilityPanelFrame'
import { PeteHelp } from './Help'
import { PeteToolbar } from './Toolbar'
export function HeaderActions() { return null }
export function WorldHeading() { return <span>♥ Pete lebt und baut seine Welt</span> }
export function Panels() { return <UtilityPanelFrame Help={PeteHelp} /> }
export const Toolbar = PeteToolbar
