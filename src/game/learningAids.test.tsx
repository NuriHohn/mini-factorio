import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LittleGoals, PinnedGoal, ProcessCards, SupplyAssistant } from './LearningAids'
import { useGameStore } from '../state/gameStore'
vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>(), store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign(() => store.getState(), store) }
})
it('shows optional goals and a dismissible pin without timers or reward buttons', () => {
  useGameStore.setState(useGameStore.getInitialState(), true)
  useGameStore.setState({ goals: [{ id: 'ore', title: 'Mine your first iron', hint: 'Power a miner', value: 3, target: 5, complete: false }], pinnedGoal: 'ore' })
  const html = renderToStaticMarkup(<LittleGoals />)
  expect(html).toContain('No timer, penalties or extra rewards'); expect(html).toContain('3/5')
  expect(renderToStaticMarkup(<PinnedGoal />)).toContain('Unpin learning goal')
  useGameStore.setState({ pinnedGoal: null }); expect(renderToStaticMarkup(<PinnedGoal />)).toBe('')
})
it('marks only the current actual stage and presents bounded stock', () => {
  useGameStore.setState({ processes: [{ title: 'Fruit journey', steps: ['Pick fruit', 'Store fruit'], active: 1, stock: '2 carried' }] })
  const html = renderToStaticMarkup(<ProcessCards />)
  expect(html.match(/aria-current="step"/g)).toHaveLength(1); expect(html).toContain('2 carried')
})
it('disables empty supply offers instead of offering free materials', () => {
  useGameStore.setState({ inspected: 824, supplies: [{ id: 'fence', name: 'Fence', free: 200, transferable: 0, amounts: [{ material: 'wood', label: 'Wood', required: 6, stored: 0, available: 0 }] }], supplyRequest: null })
  const html = renderToStaticMarkup(<SupplyAssistant />)
  expect(html).toContain('6 missing'); expect(html).toContain('disabled=""'); expect(html).toContain('does not create items')
})
