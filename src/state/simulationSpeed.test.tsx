import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SimulationSpeed } from '../game/SimulationSpeed'
import { simulationDelta, useSimulationSpeed } from './simulationSpeed'
import { placeBuilding } from '../simulation/world'
import { createBareWorld, poweredWorld } from '../simulation/testFixtures'
import { advanceWorld } from '../simulation/step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
afterEach(() => { useSimulationSpeed.setState({ speed: 1 }) })
describe('whole-world simulation pace', () => {
  it('offers pause and all five speeds without changing tools', () => {
    expect(renderToStaticMarkup(<SimulationSpeed />)).toContain('Game speed')
    for (const speed of [1, 2, 4, 8, 16] as const) {
      useSimulationSpeed.getState().setSpeed(speed)
      expect(useSimulationSpeed.getState().speed).toBe(speed)
      expect(renderToStaticMarkup(<SimulationSpeed />)).toContain(`Game speed ×${speed}`)
    }
    useSimulationSpeed.getState().setSpeed(4); expect(useSimulationSpeed.getState().speed).toBe(4)
    useSimulationSpeed.getState().setSpeed(0); expect(useSimulationSpeed.getState().speed).toBe(0)
    expect(renderToStaticMarkup(<SimulationSpeed />)).toContain('aria-pressed="true"')
  })
  it.each([34, 35])('loads a genuine version-%s world without new run or cover fields', version => {
    const world = createBareWorld(() => .4), view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
    const old = JSON.parse(encodeSave(world, view)); old.version = version
    expect(JSON.parse(encodeSave(decodeSave(JSON.stringify(old)).world, view, '2026-10-23T00:00:00.000Z'))).toEqual(JSON.parse(encodeSave(world, view, '2026-10-23T00:00:00.000Z')))
  })
  it.each([4, 8, 16] as const)('matches fixed-step world state at ×%i, including remainder and save continuation', speed => {
    const normal = poweredWorld(() => .4)
    normal.tiles[820] = 'iron'
    placeBuilding(normal, 20, 20, 'miner', 'east'); placeBuilding(normal, 21, 20, 'belt', 'east'); placeBuilding(normal, 22, 20, 'storage', 'east')
    const fast = structuredClone(normal)
    for (let i = 0; i < 400; i++) advanceWorld(normal, simulationDelta(17, 1))
    for (let i = 0; i < 400 / speed; i++) advanceWorld(fast, simulationDelta(17, speed))
    expect(fast).toEqual(normal)
    const chest = fast.buildings[822]
    expect(chest?.kind === 'storage' && chest.inventory.iron > 0).toBe(true)
    const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
    const restored = decodeSave(encodeSave(fast, view)).world
    const before = structuredClone(restored)
    advanceWorld(restored, simulationDelta(250, 0)); expect(restored).toEqual(before)
    advanceWorld(restored, simulationDelta(125, 2)); advanceWorld(fast, 250)
    expect(restored).toEqual(fast)
    expect(simulationDelta(10000, 4)).toBe(1000)
    expect(simulationDelta(10000, 16)).toBe(4000)
    expect(simulationDelta(NaN, 4)).toBe(0)
  })
})
