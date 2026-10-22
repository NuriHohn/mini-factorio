import { birdStepMs, CHICK_DELAY_MS, eggAt, MAX_EGGS, nearCoop, poultryActive, poultryGround } from '../simulation/poultry'
import type { Bird, Poultry } from '../simulation/poultry'
import { neighboringTiles } from '../simulation/navigation'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restorePoultry(value: unknown, world: World, version: number): Poultry | null {
  if (value === undefined) {
    if (['eggward', 'collectingEgg'].includes(world.peace.activity)) v.invalid('poultry', 'missing egg collection state')
    return null
  }
  const r = v.object(value, 'game.poultry', ['coop', 'populatedAtMs', 'chicksAtMs', 'chicksSpawned', 'birds', 'eggs', 'nextEggAtMs', 'nextEggId', 'collected', 'seed', ...(version >= 18 ? ['eaten'] : [])])
  const clock = (n: unknown, path: string, max: number) => { const t = v.count(n, path, max); if (t % 50) v.invalid(path, 'expected fixed-step clock'); return t }
  const coop = v.tile(r.coop, 'poultry.coop'), populatedAtMs = clock(r.populatedAtMs, 'poultry.populatedAtMs', world.timeMs)
  if (world.coopProject?.phase !== 'complete' || world.coopProject.tiles[0] !== coop) v.invalid('poultry.coop', 'population requires a completed coop project')
  const chicksAtMs = clock(r.chicksAtMs, 'poultry.chicksAtMs', world.timeMs + CHICK_DELAY_MS), chicksSpawned = v.boolean(r.chicksSpawned, 'poultry.chicksSpawned')
  if (chicksAtMs !== populatedAtMs + CHICK_DELAY_MS || (chicksSpawned && world.timeMs < chicksAtMs)) v.invalid('poultry.chicksAtMs', 'invalid chick schedule')
  const birds: Bird[] = v.array(r.birds, 'poultry.birds', chicksSpawned ? 5 : 3).map((entry, i) => {
    const path = `poultry.birds[${i}]`, b = v.object(entry, path, ['id', 'kind', 'mode', 'tile', 'next', 'travelMs', 'untilMs', 'facing'])
    const id = v.count(b.id, `${path}.id`, 4), kind = v.choice(b.kind, `${path}.kind`, ['adult', 'chick'] as const), mode = v.choice(b.mode, `${path}.mode`, ['inside', 'walking', 'pecking'] as const)
    const tile = b.tile === null ? null : v.tile(b.tile, `${path}.tile`), next = b.next === null ? null : v.tile(b.next, `${path}.next`)
    const facing = v.choice(b.facing, `${path}.facing`, ['east', 'west'] as const), travelMs = clock(b.travelMs, `${path}.travelMs`, (kind === 'adult' ? 900 : 650) - 50), untilMs = clock(b.untilMs, `${path}.untilMs`, world.timeMs + 7000)
    if (id !== i || kind !== (i < 3 ? 'adult' : 'chick') || (mode === 'inside' ? tile !== null || next !== null || travelMs !== 0 : tile === null) || (mode === 'walking' ? next === null || tile === null || !neighboringTiles(tile).includes(next) || untilMs !== 0 : next !== null || travelMs !== 0)) v.invalid(path, 'invalid bird identity, phase or movement')
    return { id, kind, mode, tile, next, travelMs, untilMs, facing }
  })
  const nextEggId = v.number(r.nextEggId, 'poultry.nextEggId', 1, Number.MAX_SAFE_INTEGER, true)
  const seen = new Set<number>(); let lastId = 0
  const eggs = v.array(r.eggs, 'poultry.eggs', undefined, MAX_EGGS).map((entry, i) => {
    const path = `poultry.eggs[${i}]`, e = v.object(entry, path, ['id', 'tile', 'laidAtMs', 'laidBy'])
    const id = v.number(e.id, `${path}.id`, 1, nextEggId - 1, true), tile = v.tile(e.tile, `${path}.tile`), laidAtMs = clock(e.laidAtMs, `${path}.laidAtMs`, world.timeMs), laidBy = v.count(e.laidBy, `${path}.laidBy`, 2)
    if (id <= lastId || seen.has(tile) || !nearCoop(coop, tile) || tile === coop || laidAtMs < populatedAtMs + 45000) v.invalid(path, 'invalid egg identity, time or location')
    seen.add(tile); lastId = id
    return { id, tile, laidAtMs, laidBy }
  })
  const collected = v.count(r.collected, 'poultry.collected'), eaten = version >= 18 ? v.count(r.eaten, 'poultry.eaten', collected) : 0
  const state: Poultry = { eaten, collected, coop, populatedAtMs, chicksAtMs, chicksSpawned, birds, eggs, nextEggAtMs: clock(r.nextEggAtMs, 'poultry.nextEggAtMs', world.timeMs + 65000), nextEggId, seed: v.count(r.seed, 'poultry.seed', 0xffffffff) }
  if (state.collected + eggs.length > nextEggId - 1 || state.nextEggAtMs < populatedAtMs + 45000) v.invalid('poultry', 'invalid egg accounting or schedule')
  const candidate = { ...world, poultry: state }, active = poultryActive(candidate), ground = active ? poultryGround(candidate, coop) : new Map<number, number>()
  if (active && ((!chicksSpawned && world.timeMs >= chicksAtMs) || state.nextEggAtMs <= world.timeMs)) v.invalid('poultry', 'expired active schedule')
  for (const b of birds) if ((active && b.mode !== 'walking' && b.untilMs <= world.timeMs) || (b.tile !== null && !ground.has(b.tile)) || (b.next !== null && !ground.has(b.next)) || (b.mode === 'walking' && b.travelMs >= birdStepMs(b))) v.invalid('poultry.birds', 'bird is outside reachable dry coop ground')
  if (!active && eggs.length) v.invalid('poultry.eggs', 'eggs without a coop')
  if (['eggward', 'collectingEgg'].includes(world.peace.activity) && (!eggAt(candidate, world.peace.destination) || (world.peace.activity === 'collectingEgg' && world.pete.tile !== world.peace.destination))) v.invalid('peace.destination', 'invalid egg collection target')
  return state
}
