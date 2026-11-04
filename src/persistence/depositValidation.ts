import { createDeposits, DEPOSIT_CAPACITY } from '../simulation/deposits'
import type { Deposits } from '../simulation/deposits'
import type { World } from '../simulation/world'
import * as v from './validation'

export function restoreDeposits(value: unknown, world: World): Deposits {
  if (!world.miniFactory) v.invalid('deposits', 'finite deposits require Petes Welt')
  const r = v.object(value, 'deposits', ['remaining', 'retiring'])
  if (!r.remaining || typeof r.remaining !== 'object' || Array.isArray(r.remaining)) v.invalid('deposits.remaining', 'expected tile quantities')
  const result = createDeposits()
  for (const [key, quantity] of Object.entries(r.remaining)) {
    if (!/^(0|[1-9][0-9]*)$/.test(key)) v.invalid('deposits.remaining', 'invalid tile key')
    const tile = v.tile(Number(key), 'deposits.remaining.tile')
    if (!world.tiles[tile]) v.invalid('deposits.remaining', 'quantity without ore')
    result.remaining[tile] = v.number(quantity, 'deposits.remaining.quantity', 1, DEPOSIT_CAPACITY, true)
  }
  result.retiring = v.array(r.retiring, 'deposits.retiring').map(tile => v.tile(tile, 'deposits.retiring.tile'))
  if (new Set(result.retiring).size !== result.retiring.length || result.retiring.some(tile => !['miner', 'belt'].includes(world.buildings[tile]?.kind ?? ''))) v.invalid('deposits.retiring', 'duplicate or non-mining component')
  return result
}

export function validateDeposits(world: World): void {
  const d = world.deposits, h = world.homestead
  if (h?.task === 'retireMine' && !d) v.invalid('homestead.retireMine', 'requires finite deposit ownership')
  if (!d || !h) return
  const e = h.expansion
  if (d.retiring.some(tile => [e.miner, e.copperMiner, e.coalMiner].includes(tile) || h.infrastructure.links.some(link => link.parts.some(p => p.tile === tile) || link.inlet?.includes(tile)))) v.invalid('deposits.retiring', 'retired part still has active ownership')
  if (h.task === 'retireMine' && (h.target === null || !d.retiring.includes(h.target) || h.elapsedMs >= 4000 || Object.values(h.carried).some(n => n !== 0))) v.invalid('homestead.retireMine', 'invalid retirement work')
}
