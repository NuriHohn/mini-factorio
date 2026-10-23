import { SIMULATION_SPEEDS, useSimulationSpeed } from '../state/simulationSpeed'
export function SimulationSpeed() {
  const { speed, setSpeed } = useSimulationSpeed()
  return <div className="simulation-speed" role="group" aria-label="Game speed">
    {SIMULATION_SPEEDS.map(value => <button key={value} className="hud-button" aria-pressed={speed === value} onClick={() => setSpeed(value)} title={value === 0 ? 'Pause simulation' : `Game speed ×${value}`}>{value === 0 ? 'Ⅱ' : `×${value}`}</button>)}
  </div>
}
