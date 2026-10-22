import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type Phaser from 'phaser'
import { BuildingInspection } from './BuildingInspection'
import { drawSupplyCrate, drawCrateInspection } from './supplyCrateVisuals'
import { useGameStore } from '../state/gameStore'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import type { SupplyCrate } from '../simulation/world'
import { inspectBuilding } from '../simulation/inspection'
import { advanceWorld } from '../simulation/step'
import { inspectionSummary } from './inspectionSummary'

vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign(() => store.getState(), store) }
})

describe('supply crate presentation', () => {
  it('shows all material quantities and capacity without hiding inventory in technical details', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 20
    placeBuilding(w, 20, 20, 'supplyCrate', 'east')
    const b = w.buildings[820] as SupplyCrate; b.inventory.iron = 150; b.inventory.ironGear = 50
    const inspection = inspectBuilding(w, 820)!
    expect(inspectionSummary(inspection).state).toContain('200 / 200')
    const initial = useGameStore.getState()
    try {
      useGameStore.setState({ inspected: 820, inspection })
      const html = renderToStaticMarkup(<BuildingInspection />)
      expect(html).toContain('Pete’s Supply Crate'); expect(html).toContain('150'); expect(html).toContain('Electronic circuit')
      expect(html.indexOf('Iron gear')).toBeLessThan(html.indexOf('<details'))
      expect(html).toContain('full crates stop incoming items')
    } finally { useGameStore.setState(initial, true) }
  })
  it('renders cozy wood and a timed, culled inspection gesture without changing materials or state', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 50
    placeBuilding(w, 20, 20, 'treehouse', 'east'); placeBuilding(w, 24, 20, 'supplyCrate', 'east')
    for (let t = 0; t < 180000 && w.peace.activity !== 'checkingCrate'; t += 50) advanceWorld(w, 50)
    expect(w.peace.activity).toBe('checkingCrate')
    const calls: [string, unknown[]][] = []
    const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
    const before = structuredClone(w)
    drawSupplyCrate(g, w.buildings[824] as SupplyCrate, 32); expect(calls.some(c => c[0] === 'fillRoundedRect')).toBe(true)
    calls.length = 0; drawCrateInspection(g, w, 32, { x: 2000, y: 2000, width: 100, height: 100 }); expect(calls).toEqual([])
    drawCrateInspection(g, w, 32); expect(calls.length).toBeGreaterThan(0)
    const pose = [...calls]; calls.length = 0; drawCrateInspection(g, w, 32); expect(calls).toEqual(pose)
    expect(w).toEqual(before)
  })
})
