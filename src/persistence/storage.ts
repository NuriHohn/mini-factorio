import { decodeSave, encodeSave } from './saveGame'
import type { LoadedGame, ViewState } from './saveGame'
import type { World } from '../simulation/world'

export const MANUAL_SAVE_KEY = 'mini-factorio.manual-save'
export const AUTOSAVE_KEY = 'mini-factorio.autosave'
export const AUTOSAVE_INTERVAL_MS = 120000
export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type SaveSlot = 'manual' | 'auto'
export interface SaveStatus { manualAt: string | null; autoAt: string | null; message: string; error: boolean }
export type SaveRequest = { kind: 'save' | 'load' | 'load-auto' | 'export' | 'new' } | { kind: 'import'; text: string }
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === 'QuotaExceededError' ? 'Browser storage is full. Export JSON to keep a local backup.' : error.name === 'SecurityError' ? 'Browser storage is unavailable. JSON export/import still works.' : error.message
  return 'Save operation failed. Your current factory was kept.'
}
export class SaveSession {
  status: SaveStatus = { manualAt: null, autoAt: null, message: '', error: false }
  private activeMs = 0
  private busy = false
  private storage: SaveStorage
  private now: () => string
  private intervalMs: number
  constructor(storage: SaveStorage, now = () => new Date().toISOString(), intervalMs = AUTOSAVE_INTERVAL_MS) {
    this.storage = storage
    this.now = now
    this.intervalMs = intervalMs
  }
  initialize(): SaveStatus {
    for (const slot of ['manual', 'auto'] as const) {
      try {
        const text = this.storage.getItem(slot === 'manual' ? MANUAL_SAVE_KEY : AUTOSAVE_KEY)
        if (text !== null) this.status[slot === 'manual' ? 'manualAt' : 'autoAt'] = decodeSave(text).savedAt
      } catch (error) { this.feedback(`${slot === 'manual' ? 'Manual save' : 'Autosave'} unavailable: ${errorMessage(error)}`, true) }
    }
    return { ...this.status }
  }
  feedback(message: string, error = false): SaveStatus { this.status = { ...this.status, message, error }; return { ...this.status } }
  resetAutosave(): void { this.activeMs = 0 }
  save(world: World, view: ViewState, slot: SaveSlot): string {
    if (this.busy) throw new Error('A save operation is already in progress.')
    this.busy = true
    try {
      const savedAt = this.now(), text = encodeSave(world, view, savedAt)
      this.storage.setItem(slot === 'manual' ? MANUAL_SAVE_KEY : AUTOSAVE_KEY, text)
      this.status = { ...this.status, [slot === 'manual' ? 'manualAt' : 'autoAt']: savedAt, message: slot === 'manual' ? 'Game saved locally.' : 'Autosaved locally.', error: false }
      return text
    } finally { this.busy = false }
  }
  load(slot: SaveSlot): LoadedGame {
    const text = this.storage.getItem(slot === 'manual' ? MANUAL_SAVE_KEY : AUTOSAVE_KEY)
    if (text === null) throw new Error(slot === 'manual' ? 'No manual save exists yet.' : 'No autosave exists yet.')
    return decodeSave(text)
  }
  tick(activeMs: number, world: World, view: ViewState, ready = true): SaveStatus | null {
    if (!ready || this.busy || !Number.isFinite(activeMs) || activeMs <= 0) return null
    this.activeMs += activeMs
    if (this.activeMs < this.intervalMs) return null
    this.activeMs %= this.intervalMs
    try { this.save(world, view, 'auto') } catch (error) { this.feedback(`Autosave failed: ${errorMessage(error)}`, true) }
    return { ...this.status }
  }
}
