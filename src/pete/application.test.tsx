import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeaderActions, WorldHeading, Panels, Toolbar } from './application'
import { useGameStore } from '../state/gameStore'
import { entryMode } from '../core/entry'
import { peteText } from './text'

vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign((selector?: (s: ReturnType<typeof store.getState>) => unknown) => selector ? selector(store.getState()) : store.getState(), store) }
})
afterEach(() => useGameStore.setState(useGameStore.getInitialState(), true))

it('localizes Pete menus while retaining Factory language and save operations', () => {
  useGameStore.setState({ playMode: 'petesWorld', uiPanel: 'menu' })
  const pete = renderToStaticMarkup(<Panels />)
  for (const label of ['Spielmenü', 'Speichern', 'Spielstand laden', 'Neue Welt', 'Grafikmodus', 'Leistungsanzeige', 'Stromversorgung']) expect(pete).toContain(label)
  for (const absent of ['Save Game', 'New game', 'Power coverage', 'Andere Spielweise', 'FACTORY']) expect(pete).not.toContain(absent)
  useGameStore.setState({ playMode: 'factory' })
  const factory = renderToStaticMarkup(<Panels />)
  expect(factory).toContain('Save Game'); expect(factory).toContain('Power coverage')
})

it('shows actual work, supply blockers and recurring demand without manufacturing progress', () => {
  useGameStore.setState({ playMode: 'petesWorld', workStatus: { activity: 'Ich baue meine Materialverbindung', connections: [{ name: 'Eisenlieferung zum Lager', target: 900, reason: 'Der Greifer erhält keinen Strom.' }], orders: ['craftsman'], nextOrderSeconds: 50 } })
  const before = structuredClone(useGameStore.getState().workStatus)
  const html = renderToStaticMarkup(<WorldHeading />)
  for (const label of ['Arbeit und Warenfluss', 'Eisenlieferung', 'keinen Strom', 'Handwerker', '50 s', 'Ziel zeigen']) expect(html).toContain(label)
  expect(useGameStore.getState().workStatus).toEqual(before)
})

it('translates variable material prerequisites and preserves existing German words', () => {
  expect(peteText('I need 8 Iron plate in one reachable supply crate.')).toBe('Im erreichbaren Materiallager fehlen: 8 Eisenplatte.')
  expect(peteText('Produktion und Verbindung bleiben erhalten.')).toBe('Produktion und Verbindung bleiben erhalten.')
  expect(peteText('off')).toBe('aus')
  expect(peteText('12 / 400 items.')).toBe('12 / 400 Gegenstände.')
  expect(peteText('Invalid save at world: unknown field')).toBe('Die Spielstanddatei ist ungültig. Deine aktuelle Welt bleibt erhalten.')
  expect(peteText('Harvests mature trees within 3 tiles. Replants its harvested plots using 1 Wood; new trees mature in 5 minutes. Needs 30 kW.')).toContain('Erntet ausgewachsene Bäume')
})

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
  expect(html).toContain('Pinselgröße')
  expect(html).toContain('5×5')
  expect(html).toContain('Werkzeuge schließen')
  expect(html).toContain('data-tool="restoreLand"')
})
