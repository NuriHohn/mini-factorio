import { create } from 'zustand'
import type { GraphicsMode } from '../game/framePacing'
export const GRAPHICS_KEY = 'mini-factorio.graphics-mode'
export function readGraphicsMode(storage?: Pick<Storage, 'getItem'>): GraphicsMode {
  try { return storage?.getItem(GRAPHICS_KEY) === 'energy-saving' ? 'energy-saving' : 'standard' } catch { return 'standard' }
}
function initialMode(): GraphicsMode {
  try { return readGraphicsMode(typeof window === 'undefined' ? undefined : window.localStorage) } catch { return 'standard' }
}
export interface PerformanceStats { fps: number; frameMs: number; workMs: number; tickMs: number; buildings: number }
export const useGraphicsSettings = create<{
  mode: GraphicsMode
  diagnostics: boolean
  stats: PerformanceStats | null
  setMode: (mode: GraphicsMode) => void
  toggleDiagnostics: () => void
}>((set) => ({
  mode: initialMode(), diagnostics: false, stats: null,
  setMode: mode => {
    if (mode !== 'standard' && mode !== 'energy-saving') return
    try { window.localStorage.setItem(GRAPHICS_KEY, mode) } catch { /* The session setting still works without storage. */ }
    set({ mode })
  },
  toggleDiagnostics: () => set(state => ({ diagnostics: !state.diagnostics, stats: null })),
}))
