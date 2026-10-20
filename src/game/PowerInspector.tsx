import type { ElectricalDetails } from '../simulation/inspection'
const labels = { sabotaged: 'Sabotaged by Pumpkin Pete', disconnected: 'Outside coverage', 'no-generation': 'No generation', idle: 'Connected · idle', reduced: 'Reduced speed', powered: 'Fully powered' }
export function PowerInspector({ details }: { details: ElectricalDetails }) {
  const network = details.network
  return <div className={`power-details power-${details.state}`}>
    {details.sabotageRemainingMs > 0 && <div className="stats sabotage-countdown"><span>Disabled for</span><b>{(details.sabotageRemainingMs / 1000).toFixed(2)} s</b></div>}
    <div className="stats"><span>Assigned network</span><b>{details.networkId === null ? 'None' : `#${details.networkId}`}</b></div>
    <div className="stats"><span>Power status</span><b>{labels[details.state]}</b></div>
    {details.requirementKw > 0 && <>
      <div className="stats"><span>Working requirement</span><b>{details.requirementKw} kW</b></div>
      <div className="stats"><span>Requested / supplied</span><b>{details.requestedKw.toFixed(1)} / {details.suppliedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Production speed</span><b>{details.state === 'idle' ? 'Idle' : `${(details.speedFraction * 100).toFixed(1)}%`}</b></div>
    </>}
    <p className="inspection-note">{details.explanation}</p>
    {network && <>
      <div className="stats"><span>Network capacity</span><b>{network.capacityKw} kW</b></div>
      <div className="stats"><span>Network demand</span><b>{network.requestedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Network supplied</span><b>{network.suppliedKw.toFixed(1)} kW</b></div>
      <div className="stats"><span>Poles / generators</span><b>{network.poles} / {network.generators}</b></div>
    </>}
    <p className="inspection-note">Overlapping coverage uses the lowest pole tile index. Machines never bridge networks.</p>
  </div>
}
