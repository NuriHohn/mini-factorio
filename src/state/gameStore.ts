import { create } from 'zustand'
import { rotate } from '../simulation/world'
import type { BuildingKind, Direction, World } from '../simulation/world'
import { inspectBuilding, worldStats } from '../simulation/inspection'
import type { Inspection, WorldStats } from '../simulation/inspection'
export type Tool = BuildingKind | 'remove' | null
interface State {
  stats: WorldStats
  tool: Tool
  direction: Direction
  message: string
  inspected: number | null
  inspection: Inspection | null
  select: (tool: Tool) => void
  rotate: () => void
  publish: (world: World) => void
}
export const useGameStore = create<State>(set => ({
  stats: { oreMined: 0, platesSmelted: 0, storedOre: 0, storedPlates: 0, miners: 0, furnaces: 0 },
  tool: 'miner', direction: 'east', inspected: null, inspection: null,
  message: 'Mine ore, smelt it in a furnace, and deliver plates to storage.',
  select: tool => set({ tool, inspected: null, inspection: null, message: tool === 'remove' ? 'Click a building to remove it. Contained resources will be discarded.' : tool ? `Place ${tool} · R rotates direction.` : 'Exploring · Click a furnace or storage chest to inspect it.' }),
  rotate: () => set(state => ({ direction: rotate(state.direction) })),
  publish: world => set(state => {
    const stats = worldStats(world)
    const inspection = inspectBuilding(world, state.inspected)
    const inspected = inspection ? state.inspected : null
    // Publish value snapshots only when summaries change, never live world objects.
    if (JSON.stringify(stats) === JSON.stringify(state.stats) && JSON.stringify(inspection) === JSON.stringify(state.inspection) && inspected === state.inspected) return state
    return { stats, inspection, inspected }
  }),
}))
