import { expansionLayout, CHAIN_KINDS, IMPROVEMENTS } from '../simulation/homesteadExpansion'
import { emptyInventory, inventoryTotal, ITEMS } from '../simulation/items'
import { PETE_PROJECTS } from '../simulation/projectRegistry'
import { rebuildCost, rebuildParts } from '../simulation/rebuilding'
import type { Rebuilding, RebuildOwner } from '../simulation/rebuilding'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreRebuilding(value: unknown): Rebuilding {
  const r = v.object(value, 'rebuilding', ['jobs', 'active', 'rewarded'])
  const jobs = v.array(r.jobs, 'rebuilding.jobs', undefined, SIZE * SIZE).map(value => {
    const j = v.object(value, 'rebuilding.job', ['tile', 'owner', 'paid', 'funded', 'elapsedMs', 'gather'])
    const o = v.object(j.owner, 'rebuilding.owner', ['type'], ['id', 'plan'])
    const type = v.choice(o.type, 'rebuilding.owner.type', ['project', 'chain', 'home', 'store', 'mill', 'prototype'] as const)
    let owner: RebuildOwner
    if (type === 'project') {
      if (o.plan !== undefined) v.invalid('rebuilding.owner', 'unexpected plan')
      owner = { type, id: v.choice(o.id, 'rebuilding.owner.id', PETE_PROJECTS.filter(p => !p.repeatable && p.id !== 'veranda').map(p => p.id as Exclude<typeof p.id, 'harvesting' | 'feeding' | 'gardenCare' | 'reforestation'>)) }
    } else if (type === 'chain') {
      if (o.id !== undefined) v.invalid('rebuilding.owner', 'unexpected project id')
      const p = v.object(o.plan, 'rebuilding.plan', ['kind', 'anchor', 'direction', 'built'], ['route'])
      const plan = { kind: v.choice(p.kind, 'rebuilding.plan.kind', CHAIN_KINDS), anchor: v.tile(p.anchor, 'rebuilding.plan.anchor'), direction: v.direction(p.direction, 'rebuilding.plan.direction'), built: v.count(p.built, 'rebuilding.plan.built', 15), ...(p.route === undefined ? {} : { route: v.array(p.route, 'rebuilding.plan.route', undefined, 13).map(i => v.tile(i, 'rebuilding.plan.route.tile')) }) }
      if (plan.route && (plan.kind !== 'ironMining' || plan.route.length < 2 || plan.route[0] !== plan.anchor || new Set(plan.route).size !== plan.route.length || plan.route.some((tile, i) => i && Math.abs(tile % SIZE - plan.route![i - 1] % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(plan.route![i - 1] / SIZE)) !== 1))) v.invalid('rebuilding.plan.route', 'invalid route')
      const parts = expansionLayout(plan)
      if ((plan.kind === 'ironMining' && !plan.route) || (plan.kind !== 'forestry' && !['north', 'south'].includes(plan.direction)) || parts.some(p => p.tile < 0 || p.tile >= SIZE * SIZE || Math.abs(p.tile % SIZE - plan.anchor % SIZE) > (plan.kind === 'ironMining' ? 13 : 2)) || new Set(parts.map(p => p.tile)).size !== parts.length || plan.built > parts.length) v.invalid('rebuilding.plan', 'invalid geometry')
      owner = { type, plan }
    } else {
      if (o.id !== undefined || o.plan !== undefined) v.invalid('rebuilding.owner', 'unexpected ownership fields')
      owner = { type }
    }
    const elapsedMs = v.count(j.elapsedMs, 'rebuilding.elapsedMs', 5950), gather = j.gather === null ? null : v.tile(j.gather, 'rebuilding.gather')
    const paid = v.inventory(j.paid, 'rebuilding.paid'), funded = v.boolean(j.funded, 'rebuilding.funded')
    if (elapsedMs % 50 || (owner.type !== 'store' && gather !== null) || (funded && gather !== null) || (funded && elapsedMs >= 4000)) v.invalid('rebuilding', 'invalid work stage or clock')
    return { tile: v.tile(j.tile, 'rebuilding.tile'), owner, paid, funded, elapsedMs, gather }
  })
  const active = r.active === null ? null : v.tile(r.active, 'rebuilding.active')
  if (new Set(jobs.map(j => j.tile)).size !== jobs.length || (active !== null && !jobs.some(j => j.tile === active))) v.invalid('rebuilding', 'duplicate targets or missing active job')
  const rewardIds = ['store', 'mill', 'roof', ...IMPROVEMENTS.map(id => `improvement:${id}`), ...['forestry', 'assembler', 'furnace', 'miner', 'copperFurnace', 'cableAssembler'].map(id => `chain:${id}`)]
  const rewarded = v.array(r.rewarded, 'rebuilding.rewarded', undefined, rewardIds.length).map(id => v.choice(id, 'rebuilding.rewarded.id', rewardIds))
  if (new Set(rewarded).size !== rewarded.length) v.invalid('rebuilding.rewarded', 'duplicate historical rewards')
  return { jobs, active, rewarded }
}
export function validateRebuilding(world: World): void {
  const r = world.rebuilding, h = world.homestead
  if (!r) return
  if (!world.miniFactory || !h) v.invalid('rebuilding', 'requires Petes Welt')
  for (const job of r.jobs) {
    const part = rebuildParts(world, job.owner).find(p => p.tile === job.tile)
    if (!part || world.buildings[job.tile]) v.invalid('rebuilding', 'target must be a missing owned component')
    if (job.owner.type === 'chain') {
      const p = job.owner.plan, e = h.expansion
      const key = ({ forestry: 'forestry', crates: 'assembler', iron: 'furnace', ironMining: 'miner', copper: 'copperFurnace', cables: 'cableAssembler' } as const)[p.kind]
      if (e[key] !== p.anchor && !(e.plan?.kind === p.kind && e.plan.anchor === p.anchor)) v.invalid('rebuilding', 'unknown chain owner')
      if (p.kind === 'ironMining' && (e.furnace === null || p.route?.at(-1) !== e.furnace - 1)) v.invalid('rebuilding', 'miner route must retain its furnace')
    }
    const expected = rebuildCost(world, job)
    if (job.owner.type === 'store') {
      const raw = ['wood', 'iron', 'copper'] as const
      if (ITEMS.some(i => !raw.includes(i as typeof raw[number]) && job.paid[i]) || raw.filter(i => job.paid[i]).length > 1 || raw.some(i => job.paid[i] % 3) || inventoryTotal(job.paid) > 6 || (job.funded && inventoryTotal(job.paid) !== 6)) v.invalid('rebuilding.paid', 'invalid physical store funding')
    } else if (ITEMS.some(i => job.paid[i] !== (job.funded ? expected[i] : emptyInventory()[i])) || (!job.funded && job.elapsedMs)) v.invalid('rebuilding.paid', 'funding disagrees with component cost')
  }
}
