import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { PeteInspection } from '../game/PeteInspection'
import { nextDevelopments } from './nextDevelopment'
import { peteStatus } from './peteStatus'
import { awardActivity } from './personality'
import { createPetesWorld } from './petesWorld'
import { PETE_PROJECTS } from './projectRegistry'
import { createBareWorld } from './testFixtures'

function craftsman() {
  const w = createPetesWorld(), h = w.homestead!, s = h.infrastructure
  for (const d of PETE_PROJECTS.filter(p => p.path === 'craftsman' && !p.repeatable)) {
    Object.assign(w, { [d.state]: { home: w.peace.home!, tiles: [702], spots: [703], phase: 'complete', built: 1, carried: 0, crate: null, elapsedMs: 0, direction: 'east', kind: d.id } })
  }
  h.expansion.furnace = 710; h.expansion.miner = 711; h.expansion.gearAssembler = 712; h.cargoBicycle = true; s.craftsman = 3
  s.links = (['iron', 'gearFeed', 'gearReturn'] as const).map(kind => ({ kind, source: 710, target: 712, parts: [] }))
  awardActivity(w.personality, { path: 'craftsman', xp: 200 })
  return w
}

describe('finite development completion', () => {
  it('distinguishes a level maximum from still missing construction in all four paths', () => {
    const w = createPetesWorld()
    for (const path of ['eco', 'craftsman', 'inventor', 'industrial'] as const) awardActivity(w.personality, { path, xp: 450 })
    const before = structuredClone(w), status = peteStatus(w)
    for (const next of status.next!) {
      expect(next.completion).toMatchObject({ level: 5, maxLevel: 5, state: 'developing' })
      expect(next.completion.finished).toBeLessThan(next.completion.total)
    }
    const html = renderToStaticMarkup(createElement(PeteInspection, { status }))
    expect(html).toContain('Levelmaximum erreicht'); expect(html).toContain('Ausbau offen')
    expect(html).not.toContain('Ausbau abgeschlossen')
    expect(w).toEqual(before)
  })
  it('requires level five after all builds, excludes recurring work and derives completion without saved markers', () => {
    const w = craftsman()
    const next = () => nextDevelopments(w, []).find(p => p.path === 'craftsman')!
    expect(next().name).toBe('Level 5 erreichen')
    expect(next().completion.finished).toBe(next().completion.total)
    expect(next().completion.state).toBe('developing')
    awardActivity(w.personality, { path: 'craftsman', xp: 250 })
    const before = structuredClone(w)
    expect(next().completion.state).toBe('complete')
    expect(next().name).toBe('Entwicklung abgeschlossen')
    expect(w).toEqual(before)
    next().completion.level = 99
    expect(w.personality.paths.craftsman.level).toBe(5)
    w.houseProject!.phase = 'collecting'
    expect(next().completion.state).toBe('developing')
  })
  it('reports damaged owned water and loading parts before declaring construction finished', () => {
    const w = createPetesWorld(), h = w.homestead!
    h.infrastructure.wheel = { tile: 900, direction: 'east', poles: [] }
    expect(nextDevelopments(w, []).find(p => p.path === 'eco')).toMatchObject({ name: 'Wiederaufbau: Wasserrad', target: 900, completion: { state: 'rebuilding' } })
    h.infrastructure.wheel = null
    h.waterworks.dock = { kind: 'dock', tile: 940, direction: 'east' }
    expect(nextDevelopments(w, []).find(p => p.path === 'eco')?.completion.state).toBe('rebuilding')
    h.infrastructure.loading = { input: 700, output: 701, pole: 702 }
    expect(nextDevelopments(w, []).find(p => p.path === 'industrial')?.completion.state).toBe('rebuilding')
  })
  it('keeps an active paid link repair separate from completed historical construction', () => {
    const w = craftsman(), s = w.homestead!.infrastructure
    awardActivity(w.personality, { path: 'craftsman', xp: 250 })
    s.plan = { kind: 'iron', source: 710, target: 712, parts: [{ tile: 750, kind: 'belt', direction: 'east' }] }
    s.repair = true
    w.homestead!.task = 'buildConnection'
    const next = nextDevelopments(w, []).find(p => p.path === 'craftsman')!
    expect(next.completion.finished).toBe(next.completion.total)
    expect(next.completion.state).toBe('rebuilding')
    expect(next.phase).toBe('Wiederaufbau')
  })
  it('does not introduce Pete completion into Factory mode', () => {
    expect(nextDevelopments(createBareWorld(), [])).toEqual([])
  })
})
