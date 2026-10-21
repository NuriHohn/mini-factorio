import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BuildToolbar } from '../game/BuildToolbar'
import { RevengeHUD } from '../game/RevengeHUD'
import { useGameStore } from './gameStore'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding, removeBuilding } from '../simulation/world'
// Render the current published snapshot without a browser subscription or SSR's
// immutable initial-state getter. Commands still use the real Zustand store.
vi.mock('./gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('./gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign(() => store.getState(), store) }
})
beforeEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
describe('treehouse toolbar and copied peace status', () => {
  it('shows cost, affordability, one-home limit and restored availability after demolition', () => {
    const w = createBareWorld(() => .5), store = useGameStore.getState()
    store.setBuildTab('nature'); store.publish(w)
    expect(renderToStaticMarkup(<BuildToolbar />)).toMatch(/disabled=""[^>]*title="20 Wood required · 0 available"[^>]*data-tool="treehouse"/)
    w.nature.wood = 40; store.publish(w)
    expect(renderToStaticMarkup(<BuildToolbar />)).toMatch(/<button class="building" title="20 Wood[^>]*data-tool="treehouse"/)
    store.select('treehouse'); expect(useGameStore.getState().tool).toBe('treehouse')
    placeBuilding(w, 18, 23, 'treehouse', 'east'); store.publish(w)
    expect(renderToStaticMarkup(<BuildToolbar />)).toMatch(/disabled=""[^>]*title="Only one treehouse/)
    expect(renderToStaticMarkup(<RevengeHUD />)).toContain('Pete is peaceful')
    expect(useGameStore.getState()).toMatchObject({ peaceful: true, wood: 20 })
    removeBuilding(w, 18, 23); store.publish(w)
    expect(useGameStore.getState().peaceful).toBe(false)
    expect(renderToStaticMarkup(<BuildToolbar />)).not.toContain('Only one treehouse')
  })
  it('keeps existing hotkeys, cancellation, inspection and category selection', () => {
    const store = useGameStore.getState()
    store.select('treehouse'); store.select('treehouse'); expect(useGameStore.getState().tool).toBeNull()
    store.select('treehouse'); store.handleToolKey({ code: 'Digit1', repeat: false })
    expect(useGameStore.getState()).toMatchObject({ tool: 'miner', buildTab: 'factory' })
    store.select('treehouse'); store.handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState()).toMatchObject({ tool: null, buildTab: 'nature' })
  })
})
