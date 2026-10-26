import { create } from 'zustand'
export const SIMULATION_SPEEDS = [0, 1, 2, 4, 8, 16] as const
export type SimulationSpeed = typeof SIMULATION_SPEEDS[number]
// A session control: importing a factory never changes the player's chosen pace.
export const useSimulationSpeed = create<{ speed: SimulationSpeed; setSpeed: (speed: SimulationSpeed) => void }>(set => ({
  speed: 1,
  setSpeed: speed => { if (SIMULATION_SPEEDS.includes(speed)) set({ speed }) },
}))
export function simulationDelta(delta: number, speed: SimulationSpeed): number {
  return Number.isFinite(delta) && delta > 0 ? Math.min(delta, 250) * speed : 0
}
