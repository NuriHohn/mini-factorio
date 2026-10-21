import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GRAPHICS_KEY, readGraphicsMode, useGraphicsSettings } from './graphicsSettings'
import { GraphicsOptions, PerformanceOverlay } from '../game/GraphicsOptions'
vi.mock('./graphicsSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('./graphicsSettings')>()
  const store = actual.useGraphicsSettings
  return { ...actual, useGraphicsSettings: Object.assign((selector: (state: ReturnType<typeof store.getState>) => unknown) => selector(store.getState()), store) }
})
beforeEach(() => useGraphicsSettings.setState(useGraphicsSettings.getInitialState(), true))
describe('graphics preferences', () => {
  it('defaults to standard and validates stored preferences without requiring browser storage', () => {
    expect(readGraphicsMode()).toBe('standard')
    for (const value of [null, '', 'broken', 'standard']) expect(readGraphicsMode({ getItem: () => value })).toBe('standard')
    expect(readGraphicsMode({ getItem: key => key === GRAPHICS_KEY ? 'energy-saving' : null })).toBe('energy-saving')
    expect(readGraphicsMode({ getItem: () => { throw Error('denied') } })).toBe('standard')
  })
  it('offers both limits and changes the session preference even without localStorage', () => {
    useGraphicsSettings.getState().setMode('energy-saving')
    const html = renderToStaticMarkup(<GraphicsOptions />)
    expect(html).toContain('Standard · 60 FPS'); expect(html).toContain('Energy Saving · 30 FPS')
    expect(html).toContain('value="energy-saving" selected=""')
    useGraphicsSettings.getState().setMode('standard')
  })
  it('keeps diagnostics off by default, then displays explicitly labeled batched measurements', () => {
    expect(renderToStaticMarkup(<PerformanceOverlay />)).toBe('')
    useGraphicsSettings.getState().toggleDiagnostics()
    useGraphicsSettings.setState({ stats: { fps: 30, frameMs: 33.33, workMs: 2, tickMs: .4, buildings: 18 } })
    const html = renderToStaticMarkup(<PerformanceOverlay />)
    expect(html).toContain('30.0 rendered FPS'); expect(html).toContain('batch average'); expect(html).toContain('18 buildings drawn')
    useGraphicsSettings.getState().toggleDiagnostics()
  })
})
