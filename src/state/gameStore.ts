import { peaceful } from '../simulation/peace'
import { natureTool } from './natureTools'
import type { BrushSize } from '../simulation/nature'
import { combatTool, createRevenge } from '../simulation/revenge'
import type { RevengeState } from '../simulation/revenge'
import { buildingTechnologyError, createResearch, hasTechnology, purchaseTechnology, researchRate, TECHNOLOGIES } from '../simulation/research'
import type { ResearchState, TechnologyId } from '../simulation/research'
import { analyticsSnapshot } from '../simulation/analytics'
import type { AnalyticsSnapshot } from '../simulation/analytics'
import type { SaveRequest, SaveStatus } from '../persistence/storage'
import { TOOL_HOTKEYS, toolMetadata } from './toolMetadata'
import type { BuildTab, Tool } from './toolMetadata'
export { TOOL_HOTKEYS } from './toolMetadata'
export type { Tool } from './toolMetadata'
import { releasePete } from '../simulation/police'
import { shootWeb } from '../simulation/webs'
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
  peaceful: boolean
  peaceActivity: string
  gifts: number
  wood: number
  brushSize: BrushSize
  setBrushSize: (size: BrushSize) => void
  revenge: RevengeState
  simulationTime: number
  research: ResearchState
  researchRate: number
  researchOpen: boolean
  researchRequest: TechnologyId | null
  researchFeedback: string
  toggleResearch: () => void
  requestResearch: (id: TechnologyId) => void
  applyResearch: (world: World) => void
  analytics: AnalyticsSnapshot
  analyticsOpen: boolean
  toggleAnalytics: () => void
  focusRequest: number | null
  focusBuilding: (index: number) => void
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
  useWebTool: (world: World, position: Position) => boolean
  inspect: (world: World, x: number, y: number) => void
  rotate: () => void
  publish: (world: World) => void
}
export const useGameStore = create<State>((set, get) => ({
  peaceful: false, peaceActivity: 'homeward', gifts: 0, wood: 0, brushSize: 3,
  setBrushSize: size => { if ([1, 3, 5].includes(size)) set({ brushSize: size }) },
  revenge: createRevenge(), simulationTime: 0,
  research: createResearch(), researchRate: 0, researchOpen: false, researchRequest: null, researchFeedback: '',
  toggleResearch: () => set(state => ({ researchOpen: !state.researchOpen, analyticsOpen: false, researchFeedback: '' })),
  requestResearch: id => set(state => state.researchRequest === null ? { researchRequest: id } : state),
  applyResearch: world => {
    const id = get().researchRequest
    if (id === null) return
    const error = purchaseTechnology(world, id)
    set({ researchRequest: null, researchFeedback: error ?? `${TECHNOLOGIES[id].name} researched.` })
    get().publish(world)
  },
  analytics: { timeMs: 0, produced: emptyInventory(), consumed: emptyInventory(), totalPerMinute: 0, utilization: 0, configuredMachines: 0, problems: [], history: [], recentItems: [] }, analyticsOpen: false,
  toggleAnalytics: () => set(state => hasTechnology(state.research, 'analytics1') ? { analyticsOpen: !state.analyticsOpen, researchOpen: false } : state),
  focusRequest: null,
  focusBuilding: index => { if (!hasTechnology(get().research, 'analytics1')) return; get().select(null); set({ focusRequest: index }) },
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
    set({ releaseRequest: null, message: released ? 'Pete released · eligible for arrest immediately.' : 'Pete is no longer held by this prison.' })
  },
  recipeRequest: null,
  requestRecipe: recipeMode => set(state => state.inspected !== null && (state.inspection?.kind === 'furnace' || state.inspection?.kind === 'assembler') ? { recipeRequest: { index: state.inspected, recipeMode } } : state),
  stats: { mined: emptyInventory(), produced: emptyInventory(), stored: emptyInventory(), maxMiningPerSec: 0, maxSmeltingPerSec: 0, miners: 0, furnaces: 0, assemblers: 0, inserters: 0, maxCraftingPerSec: 0 },
  electricity: { installedKw: 0, connectedKw: 0, requestedKw: 0, suppliedKw: 0, surplusKw: 0, deficitKw: 0, networks: 0 },
  powerOverlay: false, togglePowerOverlay: () => set(state => ({ powerOverlay: !state.powerOverlay })),
  tool: 'miner', direction: 'east', inspected: null, inspection: null,
  message: 'Power first: place a generator (5) and pole (6) within 3 tiles of your machines. P shows electricity.',
  select: requested => set(state => {
    const technologyError = requested && buildingTechnologyError(state.research, requested)
    if (technologyError) return { message: technologyError }
    const tool = requested !== null && state.tool === requested ? null : requested
    if (tool === null && state.tool === null) return state
    return { tool, focusRequest: null, buildTab: tool ? toolMetadata(tool).tab : state.buildTab, releaseRequest: null, inspected: null, inspection: null, recipeRequest: null, message: tool === 'treehouse' ? 'Pete’s Treehouse · 20 Wood · one home · peace begins immediately. No demolition refund.' : natureTool(tool) ? `${toolMetadata(tool).label} · ${toolMetadata(tool).hint}` : combatTool(tool) ? `${toolMetadata(tool).label} selected · Click the walker to attack. Ground clicks miss; all combat tools share a cooldown.` : tool === 'spiderWeb' ? 'Spider Web · Click Pete to scare him, or a tile to leave a ground web.' : tool === 'remove' ? 'Click a building to remove it. Contained resources will be discarded.' : tool === 'powerPole' ? 'Place a power pole · 3-tile coverage, 6-tile connections.' : tool === 'generator' ? 'Place a generator within 3 tiles of a pole · 100 kW.' : tool ? `Place ${tool} · R rotates direction.` : 'Exploring · Click a machine, generator, pole or storage chest to inspect it.' }
  }),
  handleToolKey: event => {
    if (get().researchOpen) { if (event.code === 'Escape') get().toggleResearch(); return }
    if (event.code === 'Escape') { get().select(null); return }
    if (event.repeat || event.editing) return
    if (Object.hasOwn(TOOL_HOTKEYS, event.code)) get().select(TOOL_HOTKEYS[event.code])
  },
  useWebTool: (world, position) => {
    if (get().tool !== 'spiderWeb') return false
    const result = shootWeb(world, position)
    set({ message: peaceful(world) && result === 'hit' ? 'Pete is peaceful. No need for webs!' : result === 'ground' ? 'Web fired · lands for 10 seconds. Click Pete directly to scare him.' : result === 'outside' ? 'Choose a tile inside the world.' : result === 'full' ? 'Too many active webs. Wait for some to expire.' : world.pete.water ? 'Pete is soaked! Let his water reaction finish.' : ['ARRESTED', 'TRANSPORTED', 'IMPRISONED'].includes(world.pete.mode) ? 'Pete is in police custody.' : 'Pete is frightened! He will cry in a safe corner, then return.' })
    return true
  },
  inspect: (world, x, y) => set(state => {
    if (state.tool !== null) return state
    const inspection = buildingAt(world, x, y) ? inspectBuilding(world, y * SIZE + x) : null
    return { inspected: inspection ? y * SIZE + x : null, inspection, recipeRequest: null, releaseRequest: null }
  }),
  rotate: () => set(state => ({ direction: rotate(state.direction) })),
  publish: world => set(state => {
    const revenge = structuredClone(world.revenge)
    const research = { ...world.research, unlocked: [...world.research.unlocked] }
    const rate = researchRate(world)
    const analytics = analyticsSnapshot(world)
    const stats = worldStats(world)
    const electricity = powerOverview(world)
    const inspection = inspectBuilding(world, state.inspected)
    const inspected = inspection ? state.inspected : null
    // Publish value snapshots only when summaries change, never live world objects.
    if (peaceful(world) === state.peaceful && world.peace.activity === state.peaceActivity && world.peace.gifts.length === state.gifts && world.nature.wood === state.wood && world.timeMs === state.simulationTime && JSON.stringify(revenge) === JSON.stringify(state.revenge) && JSON.stringify(research) === JSON.stringify(state.research) && rate === state.researchRate && JSON.stringify(analytics) === JSON.stringify(state.analytics) && JSON.stringify(electricity) === JSON.stringify(state.electricity) && JSON.stringify(stats) === JSON.stringify(state.stats) && JSON.stringify(inspection) === JSON.stringify(state.inspection) && inspected === state.inspected) return state
    return { peaceful: peaceful(world), peaceActivity: world.peace.activity, gifts: world.peace.gifts.length, wood: world.nature.wood, revenge, simulationTime: world.timeMs, stats, electricity, inspection, inspected, analytics, research, researchRate: rate, analyticsOpen: state.analyticsOpen && hasTechnology(research, 'analytics1') }
  }),
}))
