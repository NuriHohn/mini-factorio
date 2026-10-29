import * as factoryApplication from '../factory/application'
import * as peteApplication from '../pete/application'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useGameStore } from './gameStore'
import { importantNotification, notificationText, worldInputBlocked } from './uiMetadata'
import { CONTROL_ROWS, technologyView } from '../factory/uiMetadata'
import { PLAYER_TOOLS } from './toolMetadata'
import { createResearch, RP_UNITS } from '../simulation/research'
import { createBareWorld } from '../simulation/testFixtures'
import { ResearchPanel } from '../game/ResearchPanel'
import { ConstructionResources } from '../game/ConstructionResources'
import { HelpContents } from '../game/HelpContents'
import { UtilityPanels } from '../game/UtilityPanels'
import App from '../App'
import { createPetesWorld } from '../simulation/petesWorld'
vi.mock('../game/GameCanvas', () => ({ GameCanvas: () => <div aria-label="Game canvas" /> }))
vi.mock('./gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('./gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign((selector?: (state: ReturnType<typeof store.getState>) => unknown) => selector ? selector(store.getState()) : store.getState(), store) }
})
beforeEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
describe('compact navigation and UI-only state', () => {
  it('starts with no utility panel and keeps manuals, management and large resource tables out of normal play', () => {
    const html = renderToStaticMarkup(<App initialParts={factoryApplication} />)
    expect(useGameStore.getState().uiPanel).toBeNull()
    expect(html).not.toContain('Import file'); expect(html).not.toContain('Toggle Mining machine')
    expect(html).not.toContain('Resource statistics'); expect(html).not.toContain('role="dialog" aria-modal="false"')
    for (const label of ['Game menu', 'Help', 'Research', 'Factory overview', 'Construction resources', 'Build toolbar']) expect(html).toContain(label)
  })
  it('keeps work diagnostics collapsed and detailed Pete status in inspection', () => {
    const w = createPetesWorld()
    useGameStore.setState({ tool: null })
    useGameStore.getState().publish(w)
    const hint = useGameStore.getState().miniHint!
    expect(hint.length).toBeGreaterThan(20)
    const initial = renderToStaticMarkup(<App initialParts={peteApplication} />)
    expect(initial).toContain('Arbeit und Warenfluss')
    expect(initial).not.toContain('class="pete-work-status" open')
    expect(initial).not.toContain('Pete ansehen')
    expect(initial).not.toContain('Research')
    useGameStore.getState().inspectPete(w)
    const html = renderToStaticMarkup(<App initialParts={peteApplication} />)
    expect(html).toContain('Pete ansehen')
    expect(html).toContain(hint)
    expect(html).not.toContain('mini-world-hint')
  })
  it.each(['menu', 'help', 'overview'] as const)('opens, switches and closes %s without cancelling the selected tool', panel => {
    const store = useGameStore.getState(); store.select('belt')
    store.togglePanel(panel)
    expect(worldInputBlocked(useGameStore.getState())).toBe(true)
    expect(renderToStaticMarkup(<UtilityPanels />)).toContain('role="dialog"')
    store.handleToolKey({ code: 'Digit1', repeat: false })
    expect(useGameStore.getState().tool).toBe('belt')
    store.handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState()).toMatchObject({ uiPanel: null, tool: 'belt' })
    expect(worldInputBlocked(useGameStore.getState())).toBe(false)
    store.handleToolKey({ code: 'Escape', repeat: false }); expect(useGameStore.getState().tool).toBeNull()
    store.togglePanel(panel); store.togglePanel(panel)
    expect(useGameStore.getState().uiPanel).toBeNull()
  })
  it('keeps menus, research and analytics mutually exclusive and keeps their state out of the world', () => {
    const w = createBareWorld(() => .5), before = structuredClone(w), store = useGameStore.getState()
    store.togglePanel('menu'); store.togglePanel('help')
    expect(useGameStore.getState().uiPanel).toBe('help')
    store.toggleResearch(); expect(useGameStore.getState()).toMatchObject({ uiPanel: null, researchOpen: true })
    expect(worldInputBlocked(useGameStore.getState())).toBe(true)
    useGameStore.setState({ research: createResearch(true) }); store.toggleAnalytics()
    expect(useGameStore.getState()).toMatchObject({ analyticsOpen: true, researchOpen: false, uiPanel: null })
    store.togglePanel('overview'); expect(useGameStore.getState().analyticsOpen).toBe(false)
    expect(w).toEqual(before)
  })
  it('shows save/load/import/export and confirmed new-game intent only in the game menu', () => {
    const store = useGameStore.getState(); store.togglePanel('menu')
    const html = renderToStaticMarkup(<UtilityPanels />)
    for (const label of ['Save Game', 'Load Game', 'Import file', 'Export file', 'Load Autosave', 'New game']) expect(html).toContain(label)
    store.requestSave({ kind: 'new' }); store.requestSave({ kind: 'save' })
    expect(useGameStore.getState().saveRequest).toEqual({ kind: 'new' })
  })
  it('documents every existing tool shortcut from the same metadata and explains real mouse behavior', () => {
    for (const t of PLAYER_TOOLS.filter(t => t.code)) expect(CONTROL_ROWS).toContainEqual({ keys: t.key, action: `Toggle ${t.label}` })
    for (const key of ['W A S D', 'Mouse wheel', 'R', 'P', 'Escape', 'Left click', 'Click and drag', 'Gift click']) expect(CONTROL_ROWS.some(r => r.keys === key)).toBe(true)
    const html = renderToStaticMarkup(<HelpContents />)
    expect(html).toContain('How to Play'); expect(html).toContain('Controls'); expect(html).toContain('20 Wood')
    expect(html).not.toContain('Toggle Mining machine')
  })
  it('displays exact global Wood only, with no invented industrial construction inventory', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 23; w.mined.iron = 800
    useGameStore.getState().publish(w)
    const html = renderToStaticMarkup(<ConstructionResources />)
    expect(html).toContain('23 Wood available'); expect(html).not.toContain('800')
    w.nature.wood = 3; useGameStore.getState().publish(w)
    expect(renderToStaticMarkup(<ConstructionResources />)).toContain('3 Wood available')
  })
})
describe('manual technology presentation', () => {
  it('distinguishes default, missing prerequisites, partial balance, affordable and pending purchases', () => {
    const r = createResearch()
    expect(technologyView(r, 'basicIndustry')).toMatchObject({ state: 'researched', progress: 100 })
    expect(technologyView(r, 'logistics2')).toMatchObject({ state: 'locked', progress: 0 })
    r.balanceUnits = (15n * RP_UNITS).toString()
    expect(technologyView(r, 'logistics1')).toMatchObject({ state: 'available', progress: 50 })
    r.balanceUnits = (30n * RP_UNITS - 1n).toString()
    expect(technologyView(r, 'logistics1')).toMatchObject({ state: 'available', progress: 99 })
    r.balanceUnits = (30n * RP_UNITS).toString()
    expect(technologyView(r, 'logistics1')).toMatchObject({ state: 'ready', progress: 100 })
    expect(technologyView(r, 'logistics1', 'logistics1').state).toBe('pending')
    expect(technologyView(r, 'logistics2').state).toBe('locked')
    useGameStore.setState({ research: r })
    const html = renderToStaticMarkup(<ResearchPanel />)
    expect(html).toContain('1 technologies ready to unlock')
    expect(html).toContain('Build your factory'); expect(html).toContain('balance toward cost')
    expect(html).toContain('not a timed research task')
  })
})
describe('calm single-slot notifications', () => {
  it('hides persistent tool instructions and duplicate combat text, retaining meaningful results and errors', () => {
    for (const text of ['Power first: place a generator.', 'Place miner · R rotates direction.', 'Exploring · Click a machine', 'Hit! -5 HP', 'Miss! Click the walker hitbox.']) expect(notificationText(text)).toBeNull()
    expect(importantNotification('Pete’s Treehouse costs 20 Wood · 0 available.')).toBe(true)
    expect(importantNotification('Requires Automation I.')).toBe(true)
    expect(importantNotification('Thanks, Pete! +2 Wood')).toBe(false)
    for (const text of ['Choose a tile inside the world.', 'Place mining machines on ore deposits.', 'Pete’s Treehouse costs 20 Wood · 0 available.', 'Thanks, Pete! +2 Wood', 'Requires Automation I.']) expect(notificationText(text)).toBe(text)
  })
})
