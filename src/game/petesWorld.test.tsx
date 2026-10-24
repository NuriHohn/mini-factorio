import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BuildToolbar } from './BuildToolbar'
import { HelpContents } from './HelpContents'
import { useGameStore } from '../state/gameStore'

vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign((selector?: (s: ReturnType<typeof store.getState>) => unknown) => selector ? selector(store.getState()) : store.getState(), store) }
})
afterEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
it('shows only resource placement and contextual help in Petes Welt', () => {
  useGameStore.setState({ playMode: 'petesWorld', buildTab: 'nature', tool: null })
  const html = renderToStaticMarkup(<BuildToolbar />)
  expect(html).toContain('Waldgruppe')
  expect(html).not.toContain('data-tool="miner"')
  expect(html).not.toContain('data-tool="assembler"')
  expect(html).not.toContain('id="tab-factory"')
  const help = renderToStaticMarkup(<HelpContents />)
  expect(help).toContain('Pete baut seine Welt')
  expect(help).toContain('noch einmal antippen')
  expect(help).not.toContain('help-goals-tab')
})
it('retains normal Factory construction and keeps its grove tool hidden', () => {
  useGameStore.setState({ playMode: 'factory', buildTab: 'factory' })
  const html = renderToStaticMarkup(<BuildToolbar />)
  expect(html).toContain('data-tool="forester"')
  expect(html).toContain('data-tool="sawmill"')
  expect(html).toContain('data-tool="miner"')
  useGameStore.setState({ buildTab: 'nature' })
  expect(renderToStaticMarkup(<BuildToolbar />)).not.toContain('data-tool="placeGrove"')
})
