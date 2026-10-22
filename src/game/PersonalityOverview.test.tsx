import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { awardActivity, createPersonality } from '../simulation/personality'
import { PersonalityOverview } from './PersonalityOverview'
import { BuildingInspection } from './BuildingInspection'
import { createBareWorld } from '../simulation/testFixtures'
import { placeBuilding } from '../simulation/world'
import { inspectBuilding } from '../simulation/inspection'
import { useGameStore } from '../state/gameStore'
vi.mock('../state/gameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../state/gameStore')>()
  const store = actual.useGameStore
  return { ...actual, useGameStore: Object.assign(() => store.getState(), store) }
})
it('shows every path, cumulative XP, level progress and recent dominant personality read-only', () => {
  const s = createPersonality()
  awardActivity(s, { path: 'inventor', xp: 80 })
  const before = structuredClone(s), html = renderToStaticMarkup(<PersonalityOverview personality={s} />)
  for (const label of ['Eco', 'Craftsman', 'Inventor', 'Industrial']) expect(html).toContain(label)
  expect(html).toContain('Personality · Inventor'); expect(html).toContain('Lv 3'); expect(html).toContain('80 XP / 200')
  expect(html).toContain('max="120" value="0"'); expect(html).not.toContain('<button')
  expect(s).toEqual(before)
  awardActivity(s, { path: 'inventor', xp: 370 })
  expect(renderToStaticMarkup(<PersonalityOverview personality={s} />)).toContain('450 XP · Max')
})
it('exposes a detached progression snapshot in Pete’s existing treehouse inspector', () => {
  const w = createBareWorld(() => .5); w.nature.wood = 100
  placeBuilding(w, 20, 20, 'treehouse', 'east')
  const inspection = inspectBuilding(w, 820)
  expect(inspection?.kind).toBe('treehouse')
  if (inspection?.kind !== 'treehouse') throw Error('fixture')
  awardActivity(w.personality, { path: 'industrial', xp: 20 })
  expect(inspection.personality.paths.industrial.xp).toBe(0)
  useGameStore.getState().select(null); useGameStore.getState().inspect(w, 20, 20)
  const html = renderToStaticMarkup(<BuildingInspection />)
  expect(html).toContain('Pete’s personality and XP'); expect(html).toContain('Personality · Industrial')
  expect(html.indexOf('Personality ·')).toBeLessThan(html.indexOf('<details'))
  useGameStore.setState({ inspected: null, inspection: null })
})
