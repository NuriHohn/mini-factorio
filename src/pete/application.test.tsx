import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeaderActions, WorldHeading, Panels, Toolbar } from './application'
import { useGameStore } from '../state/gameStore'
import { entryMode } from '../core/entry'

vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign((selector?: (s: ReturnType<typeof store.getState>) => unknown) => selector ? selector(store.getState()) : store.getState(), store) }
})
afterEach(() => useGameStore.setState(useGameStore.getInitialState(), true))

it('starts Pete at the main address and gives each game a fixed entry', () => {
  expect(entryMode('/mini-factorio/')).toBe('petesWorld')
  expect(entryMode('/mini-factorio/', '?mode=pete')).toBe('petesWorld')
  expect(entryMode('/mini-factorio/', '?mode=factory')).toBe('factory')
  expect(entryMode('/mini-factorio/pete.html', '?mode=factory')).toBe('petesWorld')
  expect(entryMode('/mini-factorio/factory.html', '?mode=pete')).toBe('factory')
})

it('keeps both game menus confined to their own saves and new worlds', () => {
  for (const playMode of ['petesWorld', 'factory'] as const) {
    useGameStore.setState({ playMode, uiPanel: 'menu' })
    const html = renderToStaticMarkup(<Panels />)
    expect(html).toContain(playMode === 'petesWorld' ? 'Spielstände für Petes Welt.' : 'Spielstände für Factory.')
    for (const absent of ['Andere Spielweise', 'Neue Factory', 'Neue Petes Welt']) expect(html).not.toContain(absent)
    useGameStore.getState().requestSave({ kind: 'new', mode: playMode === 'factory' ? 'petesWorld' : 'factory' })
    expect(useGameStore.getState().saveRequest).toBeNull()
    expect(useGameStore.getState().saveBusy).toBe(false)
    expect(useGameStore.getState().saveStatus.error).toBe(true)
    useGameStore.getState().requestSave({ kind: 'new' })
    expect(useGameStore.getState().saveRequest).toEqual({ kind: 'new' })
    useGameStore.setState(useGameStore.getInitialState(), true)
  }
})

it('composes Pete controls and help without Factory panels or combat', () => {
  useGameStore.setState({ playMode: 'petesWorld', tool: null, buildTab: 'nature', uiPanel: 'help' })
  const html = renderToStaticMarkup(<><HeaderActions /><WorldHeading /><Panels /><Toolbar /></>)
  expect(html).toContain('Waldgruppe')
  expect(html).toContain('Eisenvorkommen')
  expect(html).toContain('Pete baut seine Welt')
  for (const absent of ['data-tool="miner"', 'data-tool="assembler"', 'data-tool="spiderWeb"', 'Research', 'Analytics', 'Revenge', 'Factory overview']) expect(html).not.toContain(absent)
})

it('keeps shared water brushes and touch palette controls in Pete', () => {
  useGameStore.setState({ playMode: 'petesWorld', tool: 'createWater', touchActive: true })
  const html = renderToStaticMarkup(<Toolbar />)
  expect(html).toContain('Brush size')
  expect(html).toContain('5×5')
  expect(html).toContain('Close tools')
  expect(html).toContain('data-tool="restoreLand"')
})
