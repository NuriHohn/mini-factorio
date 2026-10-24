import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { createPetesWorld } from '../simulation/petesWorld'
import { emptyInventory } from '../simulation/items'
import type { SupplyCrate } from '../simulation/world'
import { drawHomestead } from './homesteadVisuals'
import { drawSupplyCrate, visibleStoreStock } from './supplyCrateVisuals'

function graphics() {
  const calls: { name: string; args: unknown[] }[] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push({ name: String(name), args }); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
it('shows real positive materials in stable order and bounded filling stages', () => {
  const crate: SupplyCrate = { kind: 'supplyCrate', x: 10, y: 10, inventory: emptyInventory(), wood: 24, storeTier: 0 }
  crate.inventory.iron = 8; crate.inventory.copper = 3; crate.inventory.woodPanel = 1
  expect(visibleStoreStock(crate)).toEqual([{ item: 'wood', count: 24, height: 3 }, { item: 'iron', count: 8, height: 2 }, { item: 'copper', count: 3, height: 1 }, { item: 'woodPanel', count: 1, height: 1 }])
  const before = structuredClone(crate), { g, calls } = graphics()
  drawSupplyCrate(g, crate, 32)
  const open = [...calls]
  crate.storeTier = 1; calls.length = 0; drawSupplyCrate(g, crate, 32)
  expect(calls.length).toBeGreaterThan(open.length)
  crate.storeTier = 0; expect(crate).toEqual(before)
  crate.wood = 0; expect(visibleStoreStock(crate).map(s => s.item)).not.toContain('wood')
})
it('draws carried materials and work from authoritative progress without changing it', () => {
  const w = createPetesWorld(), h = w.homestead!
  h.task = 'buildStore'; h.target = 738; h.carried.wood = 6; h.elapsedMs = 2500
  const before = structuredClone(w), { g, calls } = graphics()
  drawHomestead(g, w, 32)
  expect(calls.some(c => c.name === 'strokeRect')).toBe(true)
  expect(calls.some(c => c.name === 'fillCircle')).toBe(true)
  expect(w).toEqual(before)
  calls.length = 0; drawHomestead(g, w, 32, { x: 5000, y: 5000, width: 10, height: 10 })
  expect(calls).toEqual([])
})
