import { useGameText } from './useGameText'
import type { ElectricalDetails } from '../simulation/inspection'
const labels = { sabotaged: 'Sabotaged by Pete', disconnected: 'Outside coverage', 'no-generation': 'No generation', idle: 'Connected · idle', reduced: 'Reduced speed', powered: 'Fully powered' }
export function PowerInspector({ details }: { details: ElectricalDetails }) {
  const t = useGameText()
  const network = details.network
  return <div className={`power-details power-${details.state}`}>
    {details.sabotageRemainingMs > 0 && <div className="stats sabotage-countdown"><span>{t('Disabled for')}</span><b>{(details.sabotageRemainingMs / 1000).toFixed(2)} s</b></div>}
    <div className="stats"><span>{t('Assigned network')}</span><b>{details.networkId === null ? t('None') : `#${details.networkId}`}</b></div>
    <div className="stats"><span>{t('Power status')}</span><b>{t(labels[details.state])}</b></div>
    {details.requirementKw > 0 && <>
      <div className="stats"><span>{t('Working requirement')}</span><b>{details.requirementKw} kW</b></div>
      <div className="stats"><span>{t('Requested / supplied')}</span><b>{details.requestedKw.toFixed(1)} / {details.suppliedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>{t('Production speed')}</span><b>{details.state === 'idle' ? t('Idle') : `${(details.speedFraction * 100).toFixed(1)}%`}</b></div>
    </>}
    <p className="inspection-note">{t(details.explanation)}</p>
    {network && <>
      <div className="stats"><span>{t('Network capacity')}</span><b>{network.capacityKw} kW</b></div>
      <div className="stats"><span>{t('Network demand')}</span><b>{network.requestedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>{t('Network supplied')}</span><b>{network.suppliedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>{t('Poles / generators')}</span><b>{network.poles} / {network.generators}</b></div>
      {network.activeGenerators !== network.generators && <div className="stats"><span>{t('Active generators')}</span><b>{network.activeGenerators} / {network.generators}</b></div>}
    </>}
    <p className="inspection-note">{t('Overlapping coverage uses the lowest pole tile index. Machines never bridge networks.')}</p>
  </div>
}
