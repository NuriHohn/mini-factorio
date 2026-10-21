import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawTree, NatureVisuals, stumpVisual } from './natureVisuals'
import { chopTree, MATURE_TREE_MS, paintLandscape, plantTree } from '../simulation/nature'
import { createWorld, placeBuilding, removeBuilding } from '../simulation/world'
import type { Tree } from '../simulation/world'
function graphics() {
  const calls: { name: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push({ name: String(name), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
const bare = () => createWorld(() => .5, { nature: false, water: false })
describe('observational nature rendering', () => {
  it('distinguishes species/stages and freezes when simulation time is unchanged', () => {
    const w = bare(), { g, calls } = graphics()
    plantTree(w, 5, 5, 'oak')
    const tree = w.buildings[205] as Tree, styles = new Set<string>()
    for (const age of [0, 121500, MATURE_TREE_MS + 1500]) for (const species of ['oak', 'pine', 'birch'] as const) {
      w.timeMs = age; tree.species = species
      calls.length = 0; const before = structuredClone(w)
      drawTree(g, w, tree, 32)
      const rendered = JSON.stringify(calls); styles.add(rendered)
      calls.length = 0; drawTree(g, w, tree, 32)
      expect(JSON.stringify(calls)).toBe(rendered); expect(w).toEqual(before)
    }
    expect(styles.size).toBe(9)
  })
  it('caches stable decoration, hides it below occupancy and restores it after demolition', () => {
    const w = bare(), visuals = new NatureVisuals(), { g, calls } = graphics()
    paintLandscape(w, { x: 5, y: 5 }, { x: 5, y: 5 }, 'flowers', 1)
    const before = structuredClone(w)
    visuals.drawDecorations(g, w, 32)
    const rendered = JSON.stringify(calls)
    expect(calls.some(c => c.name === 'fillCircle')).toBe(true)
    expect(w).toEqual(before)
    calls.length = 0; visuals.drawDecorations(g, w, 32); expect(calls).toHaveLength(0)
    placeBuilding(w, 5, 5, 'storage', 'east')
    visuals.drawDecorations(g, w, 32)
    expect(calls).toEqual([{ name: 'clear', args: [] }])
    expect(w.nature.decorations[205]).toBe('flowers')
    calls.length = 0; removeBuilding(w, 5, 5); w.nature.seed++
    visuals.drawDecorations(g, w, 32)
    expect(JSON.stringify(calls)).toBe(rendered) // No dependence on the evolving RNG stream.
  })
  it('shows a nonblocking stump for two simulation seconds, freezes during pause and clears on load', () => {
    const w = bare(), visuals = new NatureVisuals(), { g, calls } = graphics()
    plantTree(w, 5, 5, 'birch'); w.timeMs = MATURE_TREE_MS
    const chopped = chopTree(w, 5, 5)!
    visuals.fell(w, chopped.tree)
    const before = structuredClone(w)
    visuals.drawEffects(g, w, 32)
    expect(calls.some(c => c.name === 'fillRoundedRect')).toBe(true)
    expect(w).toEqual(before)
    const frozen = JSON.stringify(calls); calls.length = 0
    visuals.drawEffects(g, w, 32); expect(JSON.stringify(calls)).toBe(frozen)
    expect(stumpVisual(1950)).toMatchObject({ visible: true, alpha: .1 })
    expect(stumpVisual(2000).visible).toBe(false)
    calls.length = 0; w.timeMs += 2000; visuals.drawEffects(g, w, 32)
    expect(calls).toHaveLength(0); expect(w.nature.wood).toBe(3)
    visuals.fell(w, chopped.tree); visuals.drawEffects(g, structuredClone(w), 32)
    expect(calls).toHaveLength(0)
    expect(placeBuilding(w, 5, 5, 'storage', 'east')).toBe(true)
  })
})
