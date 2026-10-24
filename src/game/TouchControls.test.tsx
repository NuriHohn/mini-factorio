import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TouchControls } from './TouchControls'
import { useGameStore } from '../state/gameStore'
vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign(() => store.getState(), store) }
})
it('shows the selected tool in touch mode without introducing a confirm bar', () => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  useGameStore.setState({ touchActive: true, tool: 'storage' })
  const html = renderToStaticMarkup(<TouchControls />)
  expect(html).toContain('Storage chest'); expect(html).toContain('Tools'); expect(html).not.toContain('Confirm')
})
it('keeps inspection controls unobstructed including buildings on tile zero', () => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  useGameStore.setState({ touchActive: true, inspected: 0 })
  expect(renderToStaticMarkup(<TouchControls />)).toBe('')
})
it('leaves the desktop interface free of touch overlays', () => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  useGameStore.setState({ touchActive: false })
  expect(renderToStaticMarkup(<TouchControls />)).toBe('')
})
