import { createUnlockedWorld } from '../simulation/testFixtures'
import { describe, expect, it } from 'vitest'
import {  } from '../simulation/world'
import { AUTOSAVE_INTERVAL_MS, AUTOSAVE_KEY, MANUAL_SAVE_KEY, SaveSession, errorMessage } from './storage'
import type { SaveStorage } from './storage'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const date = '2026-10-20T12:00:00.000Z'
function setup() {
  const data = new Map<string, string>()
  const storage: SaveStorage = { getItem: key => data.get(key) ?? null, setItem: (key, text) => { data.set(key, text) } }
  return { data, storage, session: new SaveSession(storage, () => date), world: createUnlockedWorld(() => .5) }
}
describe('offline manual and automatic slots', () => {
  it('keeps independent slots and restores metadata after a fresh session', () => {
    const { session, world, data, storage } = setup()
    session.save(world, view, 'manual'); world.mined.iron = 12
    session.save(world, view, 'auto')
    expect(session.load('manual').world.mined.iron).toBe(0)
    expect(session.load('auto').world.mined.iron).toBe(12)
    expect(data.size).toBe(2)
    expect(new SaveSession(storage).initialize()).toMatchObject({ manualAt: date, autoAt: date })
  })
  it('autosaves at 120 seconds of active gameplay without overwriting manual saves', () => {
    const { session, world, data } = setup()
    session.save(world, view, 'manual'); const manual = data.get(MANUAL_SAVE_KEY)
    expect(session.tick(119950, world, view)).toBeNull()
    expect(session.tick(90000, world, view, false)).toBeNull()
    expect(data.has(AUTOSAVE_KEY)).toBe(false)
    world.mined.copper = 7
    expect(session.tick(50, world, view)).toMatchObject({ autoAt: date, error: false })
    expect(data.get(MANUAL_SAVE_KEY)).toBe(manual)
    expect(session.load('auto').world.mined.copper).toBe(7)
    expect(session.tick(AUTOSAVE_INTERVAL_MS - 50, world, view)).toBeNull()
  })
  it('resets the autosave cadence on a successful restore and ignores invalid deltas', () => {
    const { session, world } = setup()
    session.tick(119950, world, view); session.resetAutosave()
    for (const ms of [NaN, Infinity, -1, 0]) expect(session.tick(ms, world, view)).toBeNull()
    expect(session.tick(50, world, view)).toBeNull()
    expect(session.tick(119950, world, view)).not.toBeNull()
  })
  it('rejects missing, corrupt and incompatible slots without deleting them or changing the world', () => {
    const { session, world, data } = setup(), before = structuredClone(world)
    expect(() => session.load('manual')).toThrow('No manual save')
    data.set(MANUAL_SAVE_KEY, '{'); data.set(AUTOSAVE_KEY, '{"version":100}')
    expect(session.initialize().error).toBe(true)
    expect(() => session.load('manual')).toThrow('Invalid save JSON')
    expect(data.get(MANUAL_SAVE_KEY)).toBe('{'); expect(world).toEqual(before)
  })
  it('handles unavailable storage and quota errors, preserving the last successful save and timestamp', () => {
    const { session, world, storage, data } = setup()
    session.save(world, view, 'manual'); const before = data.get(MANUAL_SAVE_KEY)
    storage.setItem = () => { throw new DOMException('quota reached', 'QuotaExceededError') }
    expect(() => session.save(world, view, 'manual')).toThrow('quota reached')
    expect(data.get(MANUAL_SAVE_KEY)).toBe(before); expect(session.status.manualAt).toBe(date)
    expect(session.tick(120000, world, view)).toMatchObject({ error: true, autoAt: null })
    expect(session.status.message).toContain('storage is full')
    storage.getItem = () => { throw new DOMException('denied', 'SecurityError') }
    expect(new SaveSession(storage).initialize().message).toContain('storage is unavailable')
    expect(errorMessage('unknown')).toContain('current factory was kept')
  })
  it('prevents reentrant saves and never writes an invalid snapshot', () => {
    const { session, world, storage, data } = setup()
    const write = storage.setItem
    storage.setItem = (key, text) => {
      expect(() => session.save(world, view, 'auto')).toThrow('already in progress')
      expect(session.tick(120000, world, view)).toBeNull()
      write(key, text)
    }
    session.save(world, view, 'manual')
    expect(data.size).toBe(1)
    world.mined.iron = -1
    expect(() => session.save(world, view, 'manual')).toThrow()
    expect(session.load('manual').world.mined.iron).toBe(0)
  })
})
