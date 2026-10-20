import { advanceWorld } from '../simulation/step'
import { removeBuilding } from '../simulation/world'
import { beforeEach, describe, expect, it } from 'vitest'
import { createWorld, placeBuilding, SIZE } from '../simulation/world'
import { TOOL_HOTKEYS, useGameStore } from './gameStore'

beforeEach(() => useGameStore.setState({ ...useGameStore.getInitialState(), tool: null }, true))
const key = (code: string, repeat = false) => useGameStore.getState().handleToolKey({ code, repeat })

describe('one authoritative tool mode', () => {
  it.each(Object.entries(TOOL_HOTKEYS))('toggles keyboard %s on and off', (code, tool) => {
    key(code); expect(useGameStore.getState().tool).toBe(tool)
    key(code); expect(useGameStore.getState().tool).toBe(null)
  })
  it.each(Object.values(TOOL_HOTKEYS))('toggles toolbar %s through the same store action', tool => {
    useGameStore.getState().select(tool); expect(useGameStore.getState().tool).toBe(tool)
    useGameStore.getState().select(tool); expect(useGameStore.getState().tool).toBe(null)
  })
  it('switches directly between toolbar and keyboard selections, including deletion', () => {
    useGameStore.getState().select('belt'); key('Digit4')
    expect(useGameStore.getState().tool).toBe('furnace')
    key('KeyX'); expect(useGameStore.getState().tool).toBe('remove')
    useGameStore.getState().select('inserter'); expect(useGameStore.getState().tool).toBe('inserter')
    key('Digit8'); expect(useGameStore.getState().tool).toBe(null)
  })
  it('cancels placement and removal with ESC and leaves normal mode unchanged', () => {
    key('Digit2'); key('Escape'); expect(useGameStore.getState().tool).toBe(null)
    const state = useGameStore.getState()
    key('Escape'); expect(useGameStore.getState()).toBe(state)
    key('KeyX'); key('Escape'); expect(useGameStore.getState().tool).toBe(null)
  })
  it.each(Object.entries(TOOL_HOTKEYS))('ESC cancels %s even with form focus or repeated keydown', (_code, tool) => {
    useGameStore.getState().select(tool)
    useGameStore.getState().handleToolKey({ code: 'Escape', repeat: true, editing: true })
    expect(useGameStore.getState().tool).toBe(null)
    const cancelled = useGameStore.getState()
    key('Escape')
    expect(useGameStore.getState()).toBe(cancelled)
  })
  it('protects form editing shortcuts while allowing ESC and subsequent direct switching', () => {
    key('Digit2')
    useGameStore.getState().handleToolKey({ code: 'Digit4', repeat: false, editing: true })
    expect(useGameStore.getState().tool).toBe('belt')
    useGameStore.getState().handleToolKey({ code: 'Escape', repeat: false, editing: true })
    key('Digit4'); expect(useGameStore.getState().tool).toBe('furnace')
    useGameStore.getState().select('belt'); expect(useGameStore.getState().tool).toBe('belt')
    key('Escape'); expect(useGameStore.getState().tool).toBe(null)
  })
  it('ignores key repeat and unrelated keys rather than repeatedly toggling', () => {
    key('Digit2'); key('Digit2', true); key('Space'); key('KeyW')
    expect(useGameStore.getState().tool).toBe('belt')
    key('Escape'); key('Digit4', true); expect(useGameStore.getState().tool).toBe(null)
  })
  it('keeps the overlay independent of the single placement/removal mode', () => {
    key('Digit4'); useGameStore.getState().togglePowerOverlay()
    expect(useGameStore.getState()).toMatchObject({ tool: 'furnace', powerOverlay: true })
    key('Escape'); expect(useGameStore.getState()).toMatchObject({ tool: null, powerOverlay: true })
  })
})

describe('normal selection and inspection', () => {
  it('opens copied inspections after cancellation without changing buildings', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 10, 10, 'furnace', 'east')
    const before = structuredClone(world)
    key('Digit2'); useGameStore.getState().inspect(world, 10, 10)
    expect(useGameStore.getState().inspection).toBe(null)
    key('Escape'); useGameStore.getState().inspect(world, 10, 10)
    expect(useGameStore.getState()).toMatchObject({ tool: null, inspected: 10 * SIZE + 10, inspection: { kind: 'furnace', recipeLocked: false } })
    const snapshot = useGameStore.getState().inspection
    key('Escape')
    expect(useGameStore.getState().inspection).toBe(snapshot)
    expect(world).toEqual(before)
  })
  it('clears inspection and queued recipe commands when a new tool activates', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 10, 10, 'assembler', 'east')
    useGameStore.getState().inspect(world, 10, 10)
    useGameStore.getState().requestRecipe('ironGear')
    expect(useGameStore.getState().recipeRequest).not.toBe(null)
    key('KeyX')
    expect(useGameStore.getState()).toMatchObject({ tool: 'remove', inspected: null, inspection: null, recipeRequest: null })
  })
  it('clears inspection for an empty or out-of-bounds tile without aliasing another row', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 39, 0, 'storage', 'east')
    useGameStore.getState().inspect(world, 39, 0)
    expect(useGameStore.getState().inspection?.kind).toBe('storage')
    useGameStore.getState().inspect(world, -1, 1)
    expect(useGameStore.getState().inspection).toBe(null)
    useGameStore.getState().inspect(world, 5, 5)
    expect(useGameStore.getState().inspected).toBe(null)
  })
})

describe('Pete click priority over every tool', () => {
  it.each([null, ...Object.values(TOOL_HOTKEYS)])('consumes Pete clicks while %s is selected without mutating buildings', tool => {
    const world = createWorld(() => .5)
    useGameStore.setState({ tool })
    const buildings = structuredClone(world.buildings)
    expect(useGameStore.getState().scarePete(world, world.pete)).toBe(true)
    expect(world.pete.mode).toBe('FLEEING')
    expect(world.buildings).toEqual(buildings)
    expect(useGameStore.getState().tool).toBe(tool)
    for (const mode of ['FLEEING', 'CRYING'] as const) {
      Object.assign(world.pete, { mode, webMs: 200 })
      const before = structuredClone(world.pete)
      expect(useGameStore.getState().scarePete(world, world.pete)).toBe(true)
      expect(world.pete).toEqual({ ...before, webMs: 700 })
      expect(useGameStore.getState().tool).toBe(tool)
      expect(useGameStore.getState().inspected).toBe(null)
      expect(world.buildings).toEqual(buildings)
    }
    expect(useGameStore.getState().scarePete(world, { x: 0, y: 0 })).toBe(false)
  })
})

describe('prison inspection and validated release commands', () => {
  function prisoner() {
    const world = createWorld(() => .5)
    Object.assign(world.pete, { x: 8, y: 8, tile: 328, mode: 'CRYING', cryingMs: 100000 })
    for (const [x, y, kind] of [[9, 8, 'radar'], [9, 7, 'powerPole'], [9, 6, 'generator']] as const) placeBuilding(world, x, y, kind, 'east')
    for (let i = 0; i < 1500 && world.pete.mode !== 'IMPRISONED'; i++) advanceWorld(world, 50)
    expect(world.pete.mode).toBe('IMPRISONED')
    const prison = world.pete.prison!
    return { world, prison }
  }
  it('allows prison clicks through Pete to inspect and release from a copied snapshot exactly once', () => {
    const { world, prison } = prisoner()
    expect(useGameStore.getState().scarePete(world, world.pete)).toBe(false)
    useGameStore.getState().inspect(world, prison.x, prison.y)
    expect(useGameStore.getState().inspection).toMatchObject({ kind: 'prison', occupied: true, remainingMs: 60000 })
    useGameStore.getState().requestRelease(); useGameStore.getState().requestRelease()
    const cooldown = world.pete.cooldownMs
    useGameStore.getState().applyRelease(world)
    expect(world.pete.mode).toBe('WANDERING'); expect(world.pete.cooldownMs).toBe(cooldown)
    const released = structuredClone(world)
    useGameStore.getState().applyRelease(world)
    expect(world).toEqual(released)
  })
  it('rejects a queued command for a prison removed before the scene applies it', () => {
    const { world, prison } = prisoner()
    useGameStore.getState().inspect(world, prison.x, prison.y)
    useGameStore.getState().requestRelease()
    removeBuilding(world, prison.x, prison.y)
    const freed = structuredClone(world)
    useGameStore.getState().applyRelease(world)
    expect(world).toEqual(freed)
    expect(useGameStore.getState().releaseRequest).toBe(null)
  })
  it('cancels a queued release when switching tools or inspecting another building', () => {
    const { world, prison } = prisoner()
    useGameStore.getState().inspect(world, prison.x, prison.y)
    useGameStore.getState().requestRelease()
    key('Digit9')
    expect(useGameStore.getState().releaseRequest).toBe(null)
    expect(useGameStore.getState().tool).toBe('radar')
    key('Escape')
    useGameStore.getState().inspect(world, prison.x, prison.y)
    useGameStore.getState().requestRelease()
    useGameStore.getState().inspect(world, 9, 8)
    expect(useGameStore.getState().releaseRequest).toBe(null)
    expect(useGameStore.getState().inspection?.kind).toBe('radar')
  })
})

describe('compact splitter toolbar and inspection', () => {
  it('rotates its placement direction, switches tools, cancels with ESC and inspects without building', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 22, 20, 'splitter', 'east')
    const before = structuredClone(world)
    key('Digit0'); expect(useGameStore.getState().tool).toBe('splitter')
    useGameStore.getState().rotate(); expect(useGameStore.getState().direction).toBe('south')
    useGameStore.getState().select('splitter'); expect(useGameStore.getState().tool).toBe(null)
    useGameStore.getState().inspect(world, 22, 20)
    expect(useGameStore.getState().inspection).toMatchObject({ kind: 'splitter', direction: 'east', nextOutput: 0 })
    useGameStore.getState().select('splitter'); key('KeyX')
    expect(useGameStore.getState().tool).toBe('remove')
    key('Digit0'); key('Escape'); key('Escape')
    expect(useGameStore.getState().tool).toBe(null)
    useGameStore.getState().inspect(world, 22, 20)
    expect(useGameStore.getState().inspection?.kind).toBe('splitter')
    expect(world).toEqual(before)
  })
})
