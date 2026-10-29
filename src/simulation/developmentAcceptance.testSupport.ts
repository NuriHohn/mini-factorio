import { expect } from 'vitest'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { peteStatus } from './peteStatus'
import { PERSONALITY_PATHS } from './personality'
import type { PersonalityPath } from './personality'
import { advancePetesWorld as advanceWorld } from '../pete/simulation'
import { removeBuilding, SIZE } from './world'
import type { World } from './world'
import { inventoryTotal } from './items'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-10-29T00:00:00.000Z'
const snapshot = (w: World) => encodeSave(w, view, stamp)

// Reuse the fully material-funded world from each path's existing acceptance.
export function acceptCompletedPath(w: World, path: PersonalityPath) {
  const status = () => peteStatus(w).next!.find(p => p.path === path)!
  expect(status().completion).toMatchObject({ level: 5, state: 'complete' })
  expect(status().completion.finished).toBe(status().completion.total)
  expect(status().name).toBe('Entwicklung abgeschlossen')
  const foreign = PERSONALITY_PATHS.filter(p => p !== path)
  for (const p of foreign) expect(w.personality.paths[p].xp, p).toBe(0)
  const material = { eco: 'wood', craftsman: 'iron', inventor: 'copper', industrial: 'coal' } as const
  for (const p of foreign) expect(w.mined[material[p]], p).toBe(0)
  const loaded = decodeSave(snapshot(w)).world
  for (let ms = 0; ms < 30000; ms += 50) { advanceWorld(w, 50); advanceWorld(loaded, 50) }
  expect(JSON.parse(snapshot(loaded))).toEqual(JSON.parse(snapshot(w)))
  const actions = new Set<string>()
  const stages = structuredClone(w.homestead!.infrastructure)
  const projectRewards = [...w.personality.rewardedProjects]
  let activeOrder: World | null = null, checkedOrder = false, continuationMs = 0
  let completedOrders = 0
  for (let ms = 0; ms < 600000; ms += 50) {
    const paying = w.homestead!.task === 'finishOrder' && w.homestead!.infrastructure.order === path && inventoryTotal(w.homestead!.carried) > 0
    advanceWorld(w, 50)
    if (paying && w.homestead!.task !== 'finishOrder') {
      completedOrders++
      expect(w.homestead!.infrastructure.nextOrderAtMs).toBe(w.timeMs + 60000)
    }
    if (activeOrder && continuationMs < 10000) {
      advanceWorld(activeOrder, 50); continuationMs += 50
      if (continuationMs === 10000) expect(JSON.parse(snapshot(activeOrder))).toEqual(JSON.parse(snapshot(w)))
    }
    const h = w.homestead!
    if (!checkedOrder && h.task === 'finishOrder' && h.infrastructure.order === path && inventoryTotal(h.carried)) {
      expect(inventoryTotal(h.carried)).toBe(path === 'eco' ? 2 : path === 'inventor' || path === 'industrial' ? 6 : 4)
      expect(h.infrastructure[path]).toBe(3)
      activeOrder = decodeSave(snapshot(w)).world; checkedOrder = true
    }
    actions.add(w.homestead!.task ?? w.peace.activity)
  }
  expect(checkedOrder, `${path} must perform a real paid recurring order after completion`).toBe(true)
  expect(completedOrders, `${path} should supply its existing buildings after completion`).toBeGreaterThanOrEqual(1)
  expect(continuationMs).toBe(10000)
  expect(actions.size).toBeGreaterThan(1)
  expect(w.peace.gifts.length).toBeLessThanOrEqual(1)
  expect(status().completion.state).toBe('complete')
  for (const p of PERSONALITY_PATHS) expect(w.homestead!.infrastructure[p]).toBe(stages[p])
  expect(w.personality.rewardedProjects).toEqual(projectRewards)
  expect(decodeSave(snapshot(w)).world.timeMs).toBe(w.timeMs)

  // Keep the original ten-minute acceptance above. A real Industrial refill can
  // take longer than the minimum cooldown: require a second paid cycle too.
  for (let ms = 0; ms < 600000 && completedOrders < 2; ms += 50) {
    const h = w.homestead!, paying = h.task === 'finishOrder' && h.infrastructure.order === path && inventoryTotal(h.carried) > 0
    advanceWorld(w, 50)
    if (paying && h.task !== 'finishOrder') {
      completedOrders++
      expect(h.infrastructure.nextOrderAtMs).toBe(w.timeMs + 60000)
    }
  }
  expect(completedOrders, `${path} must repeat paid supply when real stock is replenished`).toBeGreaterThanOrEqual(2)
  for (const p of PERSONALITY_PATHS) expect(w.homestead!.infrastructure[p]).toBe(stages[p])
  expect(w.personality.rewardedProjects).toEqual(projectRewards)

  // Damage a real, completed owned machine, then let Pete repair it naturally.
  const key = path === 'eco' ? 'assembler' : path === 'craftsman' ? 'furnace' : path === 'inventor' ? 'circuitAssembler' : 'steamWorkshop'
  const tile = w.homestead!.expansion[key]!, kind = w.buildings[tile]!.kind
  removeBuilding(w, tile % SIZE, Math.floor(tile / SIZE))
  expect(status().completion.state).toBe('rebuilding')
  const rewards = [...w.rebuilding!.rewarded]
  for (let ms = 0; ms < 600000 && w.buildings[tile]?.kind !== kind; ms += 50) advanceWorld(w, 50)
  expect(w.buildings[tile]?.kind, `Restore ${path} at ${tile}`).toBe(kind)
  expect(w.rebuilding!.rewarded).toEqual(rewards)
  expect(status().completion.state).toBe('complete')
  expect(() => decodeSave(snapshot(w))).not.toThrow()
}
