import { emptyInventory } from '../simulation/items'
import type { FurnaceRecipeMode } from '../simulation/recipes'
import { powerOverview } from '../simulation/power'
import type { PowerOverview } from '../simulation/power'
import { create } from 'zustand'
import { rotate } from '../simulation/world'
import type { BuildingKind, Direction, World } from '../simulation/world'
import { inspectBuilding, worldStats } from '../simulation/inspection'
import type { Inspection, WorldStats } from '../simulation/inspection'
export type Tool = BuildingKind | 'remove' | null
interface State {
  recipeRequest: { index: number; recipeMode: FurnaceRecipeMode } | null
  requestRecipe: (recipeMode: FurnaceRecipeMode) => void
  stats: WorldStats
  electricity: PowerOverview
  powerOverlay: boolean
  togglePowerOverlay: () => void
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
  recipeRequest: null,
  requestRecipe: recipeMode => set(state => state.inspected !== null && (state.inspection?.kind === 'furnace' || state.inspection?.kind === 'assembler') ? { recipeRequest: { index: state.inspected, recipeMode } } : state),
  stats: { mined: emptyInventory(), produced: emptyInventory(), stored: emptyInventory(), maxMiningPerSec: 0, maxSmeltingPerSec: 0, miners: 0, furnaces: 0, assemblers: 0, maxCraftingPerSec: 0 },
  electricity: { installedKw: 0, connectedKw: 0, requestedKw: 0, suppliedKw: 0, surplusKw: 0, deficitKw: 0, networks: 0 },
  powerOverlay: false, togglePowerOverlay: () => set(state => ({ powerOverlay: !state.powerOverlay })),
  tool: 'miner', direction: 'east', inspected: null, inspection: null,
  message: 'Power first: place a generator (5) and pole (6) within 3 tiles of your machines. P shows electricity.',
  select: tool => set({ tool, inspected: null, inspection: null, message: tool === 'remove' ? 'Click a building to remove it. Contained resources will be discarded.' : tool === 'powerPole' ? 'Place a power pole · 3-tile coverage, 6-tile connections.' : tool === 'generator' ? 'Place a generator within 3 tiles of a pole · 100 kW.' : tool ? `Place ${tool} · R rotates direction.` : 'Exploring · Click a machine, generator, pole or storage chest to inspect it.' }),
  rotate: () => set(state => ({ direction: rotate(state.direction) })),
  publish: world => set(state => {
    const stats = worldStats(world)
    const electricity = powerOverview(world)
    const inspection = inspectBuilding(world, state.inspected)
    const inspected = inspection ? state.inspected : null
    // Publish value snapshots only when summaries change, never live world objects.
    if (JSON.stringify(electricity) === JSON.stringify(state.electricity) && JSON.stringify(stats) === JSON.stringify(state.stats) && JSON.stringify(inspection) === JSON.stringify(state.inspection) && inspected === state.inspected) return state
    return { stats, electricity, inspection, inspected }
  }),
}))
