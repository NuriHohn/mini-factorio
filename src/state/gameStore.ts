import type { SaveRequest, SaveStatus } from '../persistence/storage'
import { TOOL_HOTKEYS, toolMetadata } from './toolMetadata'
import type { BuildTab, Tool } from './toolMetadata'
export { TOOL_HOTKEYS } from './toolMetadata'
export type { Tool } from './toolMetadata'
import { releasePete } from '../simulation/police'
import { clickPete } from '../simulation/pete'
import type { Position } from '../simulation/world'
import { emptyInventory } from '../simulation/items'
import type { FurnaceRecipeMode } from '../simulation/recipes'
import { powerOverview } from '../simulation/power'
import type { PowerOverview } from '../simulation/power'
import { create } from 'zustand'
import { buildingAt, rotate, SIZE } from '../simulation/world'
import type { Direction, World } from '../simulation/world'
import { inspectBuilding, worldStats } from '../simulation/inspection'
import type { Inspection, WorldStats } from '../simulation/inspection'
interface State {
  saveStatus: SaveStatus
  saveBusy: boolean
  saveRequest: SaveRequest | null
  requestSave: (request: SaveRequest) => void
  saveFeedback: (message: string, error?: boolean) => void
  buildTab: BuildTab
  setBuildTab: (tab: BuildTab) => void
  releaseRequest: { index: number; imprisonedAtMs: number } | null
  requestRelease: () => void
  applyRelease: (world: World) => void
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
  handleToolKey: (event: { code: string; repeat: boolean; editing?: boolean }) => void
  scarePete: (world: World, position: Position) => boolean
  inspect: (world: World, x: number, y: number) => void
  rotate: () => void
  publish: (world: World) => void
}
export const useGameStore = create<State>((set, get) => ({
  saveStatus: { manualAt: null, autoAt: null, message: '', error: false }, saveBusy: false, saveRequest: null,
  requestSave: request => set(state => state.saveBusy ? state : { saveRequest: request, saveBusy: true }),
  saveFeedback: (message, error = false) => set(state => ({ saveStatus: { ...state.saveStatus, message, error } })),
  buildTab: 'factory',
  setBuildTab: tab => {
    if (get().buildTab === tab) return
    get().select(null)
    set({ buildTab: tab })
  },
  releaseRequest: null,
  requestRelease: () => set(state => state.inspected !== null && state.inspection?.kind === 'prison' && state.inspection.imprisonedAtMs !== null ? { releaseRequest: { index: state.inspected, imprisonedAtMs: state.inspection.imprisonedAtMs } } : state),
  applyRelease: world => {
    const request = get().releaseRequest
    if (!request) return
    const released = releasePete(world, request.index, request.imprisonedAtMs)
    set({ releaseRequest: null, message: released ? 'Pumpkin Pete released · 10 seconds of radar grace.' : 'Pete is no longer held by this prison.' })
  },
  recipeRequest: null,
  requestRecipe: recipeMode => set(state => state.inspected !== null && (state.inspection?.kind === 'furnace' || state.inspection?.kind === 'assembler') ? { recipeRequest: { index: state.inspected, recipeMode } } : state),
  stats: { mined: emptyInventory(), produced: emptyInventory(), stored: emptyInventory(), maxMiningPerSec: 0, maxSmeltingPerSec: 0, miners: 0, furnaces: 0, assemblers: 0, inserters: 0, maxCraftingPerSec: 0 },
  electricity: { installedKw: 0, connectedKw: 0, requestedKw: 0, suppliedKw: 0, surplusKw: 0, deficitKw: 0, networks: 0 },
  powerOverlay: false, togglePowerOverlay: () => set(state => ({ powerOverlay: !state.powerOverlay })),
  tool: 'miner', direction: 'east', inspected: null, inspection: null,
  message: 'Power first: place a generator (5) and pole (6) within 3 tiles of your machines. P shows electricity.',
  select: requested => set(state => {
    const tool = requested !== null && state.tool === requested ? null : requested
    if (tool === null && state.tool === null) return state
    return { tool, buildTab: tool ? toolMetadata(tool).tab : state.buildTab, releaseRequest: null, inspected: null, inspection: null, recipeRequest: null, message: tool === 'remove' ? 'Click a building to remove it. Contained resources will be discarded.' : tool === 'powerPole' ? 'Place a power pole · 3-tile coverage, 6-tile connections.' : tool === 'generator' ? 'Place a generator within 3 tiles of a pole · 100 kW.' : tool ? `Place ${tool} · R rotates direction.` : 'Exploring · Click a machine, generator, pole or storage chest to inspect it.' }
  }),
  handleToolKey: event => {
    if (event.code === 'Escape') { get().select(null); return }
    if (event.repeat || event.editing) return
    if (Object.hasOwn(TOOL_HOTKEYS, event.code)) get().select(TOOL_HOTKEYS[event.code])
  },
  scarePete: (world, position) => {
    if (!clickPete(world, position)) return false
    set({ message: world.pete.mode === 'ARRESTED' || world.pete.mode === 'TRANSPORTED' ? 'Pete is in police custody.' : 'Pumpkin Pete is frightened! He will cry in a safe corner, then return.' })
    return true
  },
  inspect: (world, x, y) => set(state => {
    if (state.tool !== null) return state
    const inspection = buildingAt(world, x, y) ? inspectBuilding(world, y * SIZE + x) : null
    return { inspected: inspection ? y * SIZE + x : null, inspection, recipeRequest: null, releaseRequest: null }
  }),
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
