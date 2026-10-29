import { UtilityPanelFrame } from './UtilityPanelFrame'
import { FactoryOverview } from './FactoryOverview'
import { FactoryHelp } from '../factory/Help'
export function UtilityPanels() { return <UtilityPanelFrame Help={FactoryHelp} Overview={FactoryOverview} /> }
