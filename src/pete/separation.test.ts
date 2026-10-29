import { afterEach, expect, it, vi } from 'vitest'
import { createPetesWorld, advancePetesWorld } from './simulation'
import { createWorld, placeBuilding } from '../simulation/world'
import { placeIron } from '../simulation/petesWorld'
import { advancePeace } from '../simulation/peace'
import { peteSave } from './save'
import { factorySave } from '../factory/save'
import { advanceFactoryWorld } from '../factory/simulation'
import * as defense from '../factory/revengeSystem'
import * as police from '../factory/policeSystem'
import * as sprinklers from '../factory/sprinklerSystem'
import * as analytics from '../factory/analytics'
import { useGameStore } from '../state/gameStore'
import { configureFactoryState } from '../core/factoryState'
import { installFactoryState } from '../factory/state'
import { SaveSession, MANUAL_SAVE_KEY } from '../persistence/storage'

const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const stamp = '2026-10-29T00:00:00.000Z'
afterEach(() => { vi.restoreAllMocks(); installFactoryState(); useGameStore.setState(useGameStore.getInitialState(), true) })

it('advances real powered Pete production without Factory research, observation or defense hooks', () => {
  const w = createPetesWorld()
  const observers = [vi.spyOn(defense, 'advanceRevenge'), vi.spyOn(police, 'advancePolice'), vi.spyOn(sprinklers, 'advanceSprinklers'), vi.spyOn(analytics, 'observeMachines')]
  expect(placeIron(w, 26, 18)).toBeNull()
  expect(placeBuilding(w, 26, 18, 'miner', 'east')).toBe(true)
  expect(placeBuilding(w, 27, 18, 'belt', 'east')).toBe(true)
  expect(placeBuilding(w, 27, 19, 'powerPole', 'east')).toBe(true)
  expect(placeBuilding(w, 28, 19, 'generator', 'east')).toBe(true)
  const research = structuredClone(w.research)
  advancePetesWorld(w, 5000)
  expect(w.mined.iron).toBeGreaterThan(0)
  expect(w.research).toEqual(research)
  expect(w.analytics.machines).toEqual({})
  observers.forEach(observer => expect(observer).not.toHaveBeenCalled())
  expect(() => advanceFactoryWorld(w, 50)).toThrow('requires Factory')
  expect(() => advancePetesWorld(createWorld(() => .5), 50)).toThrow('requires Petes Welt')
})

it('retains fixed-step partitions and exact save continuation with resource-led work', () => {
  const whole = createPetesWorld(), split = createPetesWorld()
  for (const w of [whole, split]) expect(placeIron(w, 26, 18)).toBeNull()
  advancePetesWorld(whole, 30000.5)
  for (let n = 0; n < 600; n++) { advancePetesWorld(split, 13); advancePetesWorld(split, 37) }
  advancePetesWorld(split, .5)
  expect(JSON.parse(peteSave.write(split, view, stamp))).toEqual(JSON.parse(peteSave.write(whole, view, stamp)))
  const loaded = peteSave.read(peteSave.write(split, view, stamp)).world
  for (const w of [whole, loaded]) advancePetesWorld(w, 5000)
  expect(JSON.parse(peteSave.write(loaded, view, stamp))).toEqual(JSON.parse(peteSave.write(whole, view, stamp)))
})

it('starts available material work during an unfinished cosmetic pause', () => {
  const w = createPetesWorld()
  expect(placeIron(w, 26, 18)).toBeNull()
  Object.assign(w.peace, { activity: 'waving', sinceMs: 0, untilMs: 5000, destination: null })
  advancePeace(w, 50)
  expect(w.homestead!.task).not.toBeNull()
  expect(w.timeMs).toBe(0)
  expect(w.peace.activity).not.toBe('waving')
})

it('preserves the peaceful Factory homeward movement outside Pete work scheduling', () => {
  const w = createWorld(() => .5, { nature: false, water: false })
  w.nature.wood = 20
  expect(placeBuilding(w, 20, 20, 'treehouse', 'east')).toBe(true)
  expect(w.homestead).toBeUndefined()
  expect(w.peace.activity).toBe('homeward')
  advanceFactoryWorld(w, 50)
  expect(w.pete.next).not.toBeNull()
  expect(w.pete.travelMs).toBeGreaterThan(0)
})

it('keeps old Pete machine diagnostics loadable after their observation has stopped', () => {
  const w = createPetesWorld()
  expect(placeIron(w, 26, 18)).toBeNull()
  expect(placeBuilding(w, 26, 18, 'miner', 'east')).toBe(true)
  w.timeMs = 50
  analytics.observeMachines(w, 50)
  expect(Object.keys(w.analytics.machines)).toHaveLength(1)
  const loaded = peteSave.read(peteSave.write(w, view, stamp)).world
  for (const world of [w, loaded]) advancePetesWorld(world, 2000)
  expect(w.analytics.machines).toEqual({})
  expect(JSON.parse(peteSave.write(loaded, view, stamp))).toEqual(JSON.parse(peteSave.write(w, view, stamp)))
})

it('rejects Factory commands and projections in Pete even with injected stale requests', () => {
  const w = createPetesWorld(), before = structuredClone({ research: w.research, revenge: w.revenge, police: w.police })
  const purchase = vi.fn(), release = vi.fn(), web = vi.fn(), observe = vi.fn()
  configureFactoryState({ purchase, release, web, analytics: observe, researchRate: observe })
  useGameStore.getState().publish(w)
  useGameStore.getState().toggleResearch(); useGameStore.getState().toggleAnalytics()
  useGameStore.setState({ researchRequest: 'logistics1', releaseRequest: { index: 0, imprisonedAtMs: 0 }, tool: 'spiderWeb' })
  useGameStore.getState().applyResearch(w); useGameStore.getState().applyRelease(w)
  expect(useGameStore.getState().useWebTool(w, { x: 20, y: 21 })).toBe(false)
  useGameStore.getState().publish(w)
  for (const action of [purchase, release, web, observe]) expect(action).not.toHaveBeenCalled()
  expect(useGameStore.getState()).toMatchObject({ researchOpen: false, analyticsOpen: false, goals: [], researchRate: 0 })
  expect({ research: w.research, revenge: w.revenge, police: w.police }).toEqual(before)
})

it('isolates save adapters and rejects valid opposite-mode data in a slot without writes', () => {
  const pete = createPetesWorld(), factory = createWorld(() => .5)
  const text = peteSave.write(pete, view, stamp)
  expect(() => factorySave.read(text)).toThrow('belongs to Petes Welt')
  expect(() => peteSave.read(factorySave.write(factory, view, stamp))).toThrow('belongs to Factory')
  const data = new Map([[MANUAL_SAVE_KEY, text]])
  const session = new SaveSession({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
  const before = [...data]
  expect(() => session.load('manual')).toThrow('does not match')
  expect(() => session.save(pete, view, 'manual')).toThrow('does not match')
  expect(() => peteSave.read('{')).toThrow('Invalid save JSON')
  expect([...data]).toEqual(before)
  session.setMode('petesWorld'); session.save(pete, view, 'manual')
  expect(session.load('manual').world.homestead).toEqual(pete.homestead)
  expect(data.get(MANUAL_SAVE_KEY)).toBe(text)
})
