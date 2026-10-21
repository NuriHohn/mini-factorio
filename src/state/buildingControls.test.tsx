import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useGameStore } from './gameStore'
import { toolHintId, TOOL_HINTS } from './toolHints'
import { BuildToolbar } from '../game/BuildToolbar'
import { HelpContents } from '../game/HelpContents'
import { BuildingInspection } from '../game/BuildingInspection'
import { inspectionSummary } from '../game/inspectionSummary'
import { createBareWorld, poweredWorld } from '../simulation/testFixtures'
import { inspectBuilding } from '../simulation/inspection'
import { placeBuilding } from '../simulation/world'
import { allocatePower } from '../simulation/power'
import { changeCraftingRecipe } from '../simulation/crafting'
import { ConstructionDrag } from '../game/constructionDrag'
vi.mock('./gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('./gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign(() => store.getState(), store) }
})
beforeEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
describe('single-layer cancellation and session-only hints', () => {
  it('Escape cancels the pending drag, then the menu, then the selected tool one press at a time', () => {
    const store = useGameStore.getState()
    store.select('belt'); store.togglePanel('menu'); useGameStore.setState({ dragActive: true })
    const press = () => store.handleToolKey({ code: 'Escape', repeat: false })
    press(); expect(useGameStore.getState()).toMatchObject({ dragActive: false, uiPanel: 'menu', tool: 'belt', dragCancelToken: 1 })
    press(); expect(useGameStore.getState()).toMatchObject({ uiPanel: null, tool: 'belt' })
    press(); expect(useGameStore.getState().tool).toBeNull()
  })
  it('closes the selected inspection before Analytics, preserving the world and other tool state', () => {
    const w = createBareWorld(() => .5)
    placeBuilding(w, 10, 10, 'belt', 'east')
    const before = structuredClone(w), store = useGameStore.getState()
    store.select(null); store.inspect(w, 10, 10)
    useGameStore.setState({ analyticsOpen: true })
    store.handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState()).toMatchObject({ inspection: null, analyticsOpen: true })
    store.handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState().analyticsOpen).toBe(false)
    expect(w).toEqual(before)
  })
  it('cancellation drops the gesture with no placement or resource mutation', () => {
    const w = createBareWorld(() => .5), before = structuredClone(w), drag = new ConstructionDrag()
    drag.begin(w, { x: 10, y: 10 }, 'belt', 'east'); drag.move({ x: 20, y: 10 })
    const unsubscribe = useGameStore.subscribe((s, old) => { if (s.dragCancelToken !== old.dragCancelToken) drag.cancel() })
    useGameStore.setState({ dragActive: true }); useGameStore.getState().handleToolKey({ code: 'Escape', repeat: false }); unsubscribe()
    expect(drag.finish(w)).toBeNull(); expect(w).toEqual(before)
  })
  it('shows one relevant hint, hides after three successful gestures, and keeps the instructions in Help', () => {
    const store = useGameStore.getState(); store.select('belt')
    expect(renderToStaticMarkup(<BuildToolbar />)).toContain('Drag to build or reverse belts along their axis. Crossings stay blocked.')
    for (let i = 0; i < 3; i++) store.recordToolUse('belt')
    expect(renderToStaticMarkup(<BuildToolbar />)).not.toContain('Drag to build or reverse belts along their axis. Crossings stay blocked.')
    expect(renderToStaticMarkup(<HelpContents />)).toContain('Drag to build or reverse belts along their axis. Crossings stay blocked.')
    store.select('powerPole'); expect(renderToStaticMarkup(<BuildToolbar />)).toContain('Drag to connect power around obstacles. Blue rings reuse existing poles.')
    store.recordToolUse('powerPole'); expect(useGameStore.getState().hintUses).toEqual({ belt: 3, powerPole: 1 })
    for (const tool of ['axe', 'plantOak', 'flowers', 'spiderWeb', 'flySwatter', 'miner'] as const) expect(TOOL_HINTS[toolHintId(tool)!].length).toBeGreaterThan(5)
  })
})
describe('existing authoritative inspection, explained simply', () => {
  it('reports disconnected, producing, blocked and sabotaged miners in copied snapshots', () => {
    const w = poweredWorld(() => .5); placeBuilding(w, 20, 20, 'miner', 'east'); allocatePower(w)
    const inspect = () => inspectionSummary(inspectBuilding(w, 820)!)
    expect(inspect().state).toBe('Working normally.')
    const b = w.buildings[820]!
    if (b.kind !== 'miner') throw Error('fixture')
    b.item = 'iron'; allocatePower(w); expect(inspect().state).toBe('Output is full.')
    b.sabotageUntilMs = 10000; allocatePower(w); expect(inspect().state).toBe('Temporarily disabled.')
    const bare = createBareWorld(() => .5); placeBuilding(bare, 20, 20, 'miner', 'east'); allocatePower(bare)
    expect(inspectionSummary(inspectBuilding(bare, 820)!).state).toBe('Needs electricity.')
  })
  it('uses actual recipe needs, offers existing settings secondarily, and now inspects belts', () => {
    const w = poweredWorld(() => .5); placeBuilding(w, 20, 20, 'assembler', 'east'); allocatePower(w)
    expect(inspectionSummary(inspectBuilding(w, 820)!).state).toBe('Choose a recipe first.')
    changeCraftingRecipe(w, 20, 20, 'ironGear'); allocatePower(w)
    expect(inspectionSummary(inspectBuilding(w, 820)!).state).toBe('Waiting for iron plate.')
    useGameStore.getState().select(null); useGameStore.getState().inspect(w, 20, 20)
    const html = renderToStaticMarkup(<BuildingInspection />)
    expect(html).toContain('Waiting for iron plate.'); expect(html).toContain('Details and settings'); expect(html).toContain('Assembler recipe')
    placeBuilding(w, 10, 10, 'belt', 'east')
    expect(inspectBuilding(w, 410)).toMatchObject({ kind: 'belt', direction: 'east', item: null })
    expect(inspectionSummary(inspectBuilding(w, 410)!).state).toBe('Waiting for items.')
  })
})
