import { CHAIN_KINDS, expansionLayout } from '../simulation/homesteadExpansion'
import type { ExpansionPlan } from '../simulation/homesteadExpansion'
import { LINK_KINDS, linkCost, linkCurrency } from '../simulation/infrastructureRules'
import type { Connection } from '../simulation/infrastructureRules'
import type { ConstructionResite, StoreMove } from '../simulation/storageRecovery'
import { restoreInfrastructure } from './infrastructureValidation'
import { restoreExpansion } from './homesteadValidation'
import { ITEMS, inventoryTotal } from '../simulation/items'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/grid'
import * as v from './validation'

function plan(value: unknown, version: number): ExpansionPlan {
  const p = v.object(value, 'warehousing.resite.to', ['kind', 'anchor', 'direction', 'built'], ['route', 'reuse'])
  const result: ExpansionPlan = { kind: v.choice(p.kind, 'resite.kind', CHAIN_KINDS.filter(k => version >= 61 || k !== 'transport')), anchor: v.tile(p.anchor, 'resite.anchor'), direction: v.direction(p.direction, 'resite.direction'), built: v.count(p.built, 'resite.built', 64) }
  if (p.route !== undefined) result.route = v.array(p.route, 'resite.route', undefined, 32).map(t => v.tile(t, 'resite.route.tile'))
  if (p.reuse !== undefined) result.reuse = v.array(p.reuse, 'resite.reuse', undefined, 32).map(t => v.tile(t, 'resite.reuse.tile'))
  return result
}
function connections(value: unknown, version: number): Connection[] {
  return v.array(value, 'warehousing.move.connections', undefined, version >= 61 ? LINK_KINDS.length : version >= 60 ? 15 : 14).map(value => {
    const p = v.object(value, 'move.connection', ['kind', 'source', 'target', 'parts'], ['receiver', 'inlet'])
    const kind = v.choice(p.kind, 'move.connection.kind', version >= 61 ? LINK_KINDS : LINK_KINDS.slice(0, version >= 60 ? 15 : 14)), source = v.tile(p.source, 'move.source'), target = v.tile(p.target, 'move.target')
    const parts = v.array(p.parts, 'move.parts', undefined, 64).map(value => {
      const part = v.object(value, 'move.part', ['tile', 'kind', 'direction'])
      return { tile: v.tile(part.tile, 'move.part.tile'), kind: v.choice(part.kind, 'move.part.kind', ['belt', 'inserter', 'powerPole', 'generator'] as const), direction: v.direction(part.direction, 'move.part.direction') }
    })
    return { kind, source, target, ...(p.receiver === undefined || p.receiver === target ? {} : { receiver: v.tile(p.receiver, 'move.receiver') }), ...(p.inlet === undefined ? {} : { inlet: v.array(p.inlet, 'move.inlet', undefined, 13).map(t => v.tile(t, 'move.inlet.tile')) }), parts }
  })
}
export function restoreStorageRecovery(r: Record<string, unknown>, world: World, version: number): { resite?: ConstructionResite; move?: StoreMove; recoveryAtMs?: number } {
  const result: { resite?: ConstructionResite; move?: StoreMove; recoveryAtMs?: number } = {}
  if (r.resite !== undefined) {
    const s = v.object(r.resite, 'warehousing.resite', ['to', 'index', 'held', 'elapsedMs'], ['waiting', 'rollback'])
    let held: ConstructionResite['held'] = null
    if (s.held !== null) {
      if (!s.held || typeof s.held !== 'object' || Array.isArray(s.held)) v.invalid('resite.held', 'expected a component')
      const raw = s.held as Record<string, unknown>
      const x = v.count(raw.x, 'resite.held.x', SIZE - 1), y = v.count(raw.y, 'resite.held.y', SIZE - 1)
      const b = v.building(s.held, 'resite.held', y * SIZE + x, world.timeMs, version)
      if (!b || b.kind !== 'belt' && b.kind !== 'inserter' && b.kind !== 'powerPole' && b.kind !== 'generator') v.invalid('resite.held', 'unsupported component')
      held = b
    }
    for (const key of ['waiting', 'rollback']) if (Object.hasOwn(s, key) && s[key] !== true) v.invalid('resite.' + key, 'expected true flag')
    result.resite = { to: plan(s.to, version), index: v.count(s.index, 'resite.index', 64), held, elapsedMs: v.count(s.elapsedMs, 'resite.elapsedMs', 4000), ...(s.waiting === true ? { waiting: true } : {}), ...(s.rollback === true ? { rollback: true } : {}) }
  }
  if (r.move !== undefined) {
    const m = v.object(r.move, 'warehousing.move', ['from', 'to', 'tier', 'goal', 'previous', 'links', 'cost', 'paid', 'phase', 'index', 'elapsedMs', 'salvage'], ['waiting'])
    if (Object.hasOwn(m, 'waiting') && m.waiting !== true) v.invalid('move.waiting', 'expected true flag')
    result.move = {
      from: v.tile(m.from, 'move.from'), to: v.tile(m.to, 'move.to'),
      tier: v.count(m.tier, 'move.tier', 2) as 0 | 1 | 2,
      goal: m.goal === null ? null : v.choice(m.goal, 'move.goal', CHAIN_KINDS.filter(k => version >= 61 || k !== 'transport')),
      previous: connections(m.previous, version), links: connections(m.links, version),
      cost: v.inventory(m.cost, 'move.cost'), paid: v.inventory(m.paid, 'move.paid'),
      phase: v.choice(m.phase, 'move.phase', ['fund', 'store', 'retire', 'connect', 'empty', 'remove'] as const),
      index: v.count(m.index, 'move.index', 1024), elapsedMs: v.count(m.elapsedMs, 'move.elapsedMs', 4000),
      salvage: m.salvage === null ? null : v.choice(m.salvage, 'move.salvage', ITEMS),
      ...(m.waiting === true ? { waiting: true } : {}),
    }
  }
  if (r.recoveryAtMs !== undefined) {
    result.recoveryAtMs = v.count(r.recoveryAtMs, 'warehousing.recoveryAtMs', world.timeMs + 300000)
    if (result.recoveryAtMs % 50) v.invalid('warehousing.recoveryAtMs', 'invalid clock')
  }
  if (result.move && result.resite) v.invalid('warehousing', 'multiple recovery owners')
  return result
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export function validateStorageRecovery(world: World, version: number): void {
  const s = world.warehousing, h = world.homestead
  if (!s || !h) return
  const r = s.resite
  if (r) {
    const from = h.expansion.plan
    if (h.task !== 'buildChain' || !h.paused || !from || !inventoryTotal(h.carried) || r.elapsedMs % 50 || r.to.kind !== from.kind || r.to.built !== from.built || r.index > from.built || r.rollback && r.index >= from.built) v.invalid('warehousing.resite', 'invalid retained construction')
    restoreExpansion({ ...h.expansion, plan: r.to }, world, version)
    const old = expansionLayout(from), target = expansionLayout(r.to)
    if (old.slice(0, from.built).some((p, i) => !['powerPole', 'generator', 'belt', 'inserter'].includes(p.kind) || target[i]?.kind !== p.kind)) v.invalid('warehousing.resite', 'unsupported prefix')
    for (let i = 0; i < from.built; i++) {
      if (i === r.index && r.held) {
        const t = r.held.y * SIZE + r.held.x
        if (r.held.kind !== old[i].kind || t !== old[i].tile && t !== target[i].tile) v.invalid('resite.held', 'component does not belong to the prefix')
        continue
      }
      const part = i < r.index || i === r.index && r.rollback ? target[i] : old[i]
      const b = world.buildings[part.tile]
      if (!b || b.kind !== part.kind) v.invalid('warehousing.resite', 'missing paid component')
    }
    if (r.held && r.index >= from.built) v.invalid('resite.held', 'completed prefix still held')
  }
  const m = s.move
  if (!m) return
  if (m.from === m.to || m.elapsedMs % 50) v.invalid('warehousing.move', 'invalid destination or clock')
  const before = ['fund', 'store', 'retire', 'connect'].includes(m.phase)
  if (h.store !== (before ? m.from : m.to)) v.invalid('warehousing.move', 'main-store role disagrees')
  const newKinds = new Set(m.links.map(p => p.kind)), oldKinds = new Set(m.previous.map(p => p.kind))
  const continuing = h.infrastructure.links.filter(p => !newKinds.has(p.kind) && !oldKinds.has(p.kind))
  const raw = { ...h.infrastructure, plan: null, built: 0, repair: false }
  const old = restoreInfrastructure({ ...raw, links: [...continuing, ...m.previous] }, world, version, m.from, h.expansion, h.millAnchor)
  const next = restoreInfrastructure({ ...raw, links: [...continuing, ...m.links] }, world, version, m.to, h.expansion, h.millAnchor)
  const live = before ? old.links : next.links
  if (!same([...live].sort((a, b) => a.kind.localeCompare(b.kind)), [...h.infrastructure.links].sort((a, b) => a.kind.localeCompare(b.kind)))) v.invalid('warehousing.move', 'retained connection registry disagrees')
  const base = { ...m.cost }
  for (const p of m.links) base[linkCurrency(p.kind)] -= linkCost(p.kind)
  if (m.tier >= 1) base.woodPanel -= 8
  if (m.tier === 2) base.woodenCrate -= 4
  const items = ITEMS.filter(i => base[i])
  if (items.length !== 1 || base[items[0]] !== (items[0] === 'woodenCrate' ? 2 : 6) || ITEMS.some(i => m.paid[i] > m.cost[i] || m.phase !== 'fund' && m.paid[i] !== m.cost[i])) v.invalid('warehousing.move', 'invalid paid relocation invoice')
  if ((m.phase === 'fund' || m.phase === 'store' || m.phase === 'empty' || m.phase === 'remove') && m.index) v.invalid('move.index', 'invalid stage progress')
  if (m.phase === 'connect' && m.index > m.links.reduce((n, p) => n + p.parts.length, 0)) v.invalid('move.index', 'invalid connection prefix')
  if (m.salvage && m.phase !== 'retire') v.invalid('move.salvage', 'cargo outside retirement')
}
