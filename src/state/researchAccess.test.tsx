import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useGameStore } from './gameStore'
import { BuildToolbar } from '../game/BuildToolbar'
import { AnalyticsPanel } from '../game/AnalyticsPanel'
import { createWorld, placeBuilding } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import { createResearch, RP_UNITS } from '../simulation/research'

beforeEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
describe('research access and command boundary', () => {
  it.each([['assembler', 'Digit7', 'Automation I'], ['inserter', 'Digit8', 'Logistics I'], ['splitter', 'Digit0', 'Logistics II']] as const)('keeps %s visible but disables selection and its hotkey before research', (tool, code, name) => {
    const html = renderToStaticMarkup(<BuildToolbar />)
    expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*title="Requires ${name}\\."[^>]*data-tool="${tool}"`))
    const previous = useGameStore.getState().tool
    useGameStore.getState().select(tool)
    expect(useGameStore.getState().tool).toBe(previous)
    useGameStore.getState().handleToolKey({ code, repeat: false })
    expect(useGameStore.getState()).toMatchObject({ tool: previous, message: `Requires ${name}.` })
  })
  it('revalidates queued purchases against the world and prevents duplicate deductions', () => {
    const world = createWorld(() => .5)
    world.research.balanceUnits = (30n * RP_UNITS).toString()
    useGameStore.getState().publish(world)
    useGameStore.getState().requestResearch('logistics1')
    useGameStore.getState().requestResearch('automation1')
    useGameStore.getState().applyResearch(world)
    expect(world.research).toEqual({ balanceUnits: '0', unlocked: ['basicIndustry', 'logistics1'] })
    expect(useGameStore.getState().researchFeedback).toBe('Logistics I researched.')
    useGameStore.getState().requestResearch('logistics1'); useGameStore.getState().applyResearch(world)
    expect(world.research.balanceUnits).toBe('0')
    expect(useGameStore.getState().researchFeedback).toBe('Already researched.')
    useGameStore.getState().handleToolKey({ code: 'Digit8', repeat: false })
    expect(useGameStore.getState().tool).toBe('inserter')
  })
  it('collects analytics while locked but blocks dashboard and focus actions', () => {
    const world = createWorld(() => .5)
    placeBuilding(world, 21, 18, 'generator', 'east'); placeBuilding(world, 21, 19, 'powerPole', 'east')
    placeBuilding(world, 20, 20, 'miner', 'east'); advanceWorld(world, 1000)
    useGameStore.getState().publish(world)
    useGameStore.getState().toggleAnalytics(); useGameStore.getState().focusBuilding(820)
    expect(useGameStore.getState()).toMatchObject({ analyticsOpen: false, focusRequest: null, analytics: { produced: { iron: 1 } } })
    expect(renderToStaticMarkup(<AnalyticsPanel />)).not.toContain('id="analytics-content"')
    world.research = createResearch(true); useGameStore.getState().publish(world)
    useGameStore.getState().toggleAnalytics()
    expect(useGameStore.getState().analyticsOpen).toBe(true)
    useGameStore.getState().toggleResearch()
    expect(useGameStore.getState()).toMatchObject({ analyticsOpen: false, researchOpen: true })
    useGameStore.getState().handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState().researchOpen).toBe(false)
    world.research = createResearch(); useGameStore.getState().publish(world)
    expect(useGameStore.getState().analyticsOpen).toBe(false)
  })
  it('publishes detached research snapshots and resets access on a new world', () => {
    const world = createWorld(() => .5)
    world.research = createResearch(true); useGameStore.getState().publish(world)
    world.research.unlocked.length = 1
    expect(useGameStore.getState().research.unlocked).toHaveLength(5)
    useGameStore.getState().publish(createWorld(() => .5))
    expect(useGameStore.getState().research).toEqual(createResearch())
  })
})
