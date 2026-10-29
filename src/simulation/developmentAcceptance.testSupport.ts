import { expect } from 'vitest'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { peteStatus } from './peteStatus'
import { PERSONALITY_PATHS } from './personality'
import type { PersonalityPath } from './personality'
import { advanceWorld } from './step'
import { removeBuilding, SIZE } from './world'
import type { World } from './world'

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
  for (let ms = 0; ms < 600000; ms += 50) {
    advanceWorld(w, 50)
    actions.add(w.homestead!.task ?? w.peace.activity)
  }
  expect(actions.size).toBeGreaterThan(1)
  expect(w.peace.gifts.length).toBeLessThanOrEqual(1)
  expect(status().completion.state).toBe('complete')
  for (const p of PERSONALITY_PATHS) expect(w.homestead!.infrastructure[p]).toBe(stages[p])
  expect(decodeSave(snapshot(w)).world.timeMs).toBe(w.timeMs)

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
