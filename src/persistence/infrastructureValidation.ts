import { createInfrastructure, LINK_KINDS } from '../simulation/infrastructureRules'
import type { Connection, Infrastructure, WheelSite } from '../simulation/infrastructureRules'
import { facing, wheelParts } from '../simulation/infrastructure'
import { inventoryTotal, ITEMS } from '../simulation/items'
import type { Homestead } from '../simulation/homestead'
import type { HomesteadExpansion } from '../simulation/homesteadExpansion'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'

export function restoreInfrastructure(value: unknown, world: World, version: number, store: number | null, e: HomesteadExpansion): Infrastructure {
  if (version < 49) return createInfrastructure()
  const r = v.object(value, 'infrastructure', ['links', 'plan', 'built', 'repair', 'wheel', 'wheelPlan', 'eco', 'craftsman', 'order', 'nextOrderAtMs'])
  function connection(value: unknown): Connection {
    const p = v.object(value, 'connection', ['kind', 'source', 'target', 'parts'])
    const kind = v.choice(p.kind, 'connection.kind', LINK_KINDS), source = v.tile(p.source, 'connection.source'), target = v.tile(p.target, 'connection.target')
    const parts = v.array(p.parts, 'connection.parts', undefined, 21).map(value => {
      const b = v.object(value, 'connection.part', ['tile', 'kind', 'direction'])
      return { tile: v.tile(b.tile, 'connection.tile'), kind: v.choice(b.kind, 'connection.part.kind', ['belt', 'inserter', 'generator', 'powerPole'] as const), direction: v.direction(b.direction, 'connection.direction') }
    })
    if (parts.length < 4 || parts[0].kind !== 'powerPole' || parts[1].kind !== 'generator' || parts[2].kind !== 'inserter' || parts.slice(3).some(p => p.kind !== 'belt') || new Set(parts.map(p => p.tile)).size !== parts.length || parts.some(p => p.tile === source || p.tile === target)) v.invalid('connection', 'invalid ordered components')
    const expectedSource = kind === 'iron' ? e.furnace : kind === 'gearFeed' ? store : e.gearAssembler, expectedTarget = kind === 'gearFeed' ? e.gearAssembler : store
    if (source !== expectedSource || target !== expectedTarget || source === target) v.invalid('connection', 'connection must retain its original machines')
    const distance = (a: number, b: number) => Math.abs(a % SIZE - b % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE))
    const arm = parts[2], start = parts[3]
    if (distance(source, arm.tile) !== 1 || distance(arm.tile, start.tile) !== 1 || facing(source, arm.tile) !== arm.direction || facing(arm.tile, start.tile) !== arm.direction || kind !== 'gearFeed' && arm.direction !== 'east' || Math.max(Math.abs(parts[0].tile % SIZE - arm.tile % SIZE), Math.abs(Math.floor(parts[0].tile / SIZE) - Math.floor(arm.tile / SIZE))) > 3 || distance(parts[0].tile, parts[1].tile) !== 1) v.invalid('connection', 'invalid pickup or electrical geometry')
    for (let i = 3; i < parts.length; i++) {
      const b = parts[i], end = parts[i + 1]?.tile ?? target
      if (distance(b.tile, end) !== 1 || b.direction !== facing(b.tile, end)) v.invalid('connection', 'invalid cardinal belt route')
    }
    if (kind === 'gearFeed' && parts.at(-1)!.tile === target + 1) v.invalid('connection', 'gear ingredients cannot enter against the assembler output')
    return { kind, source, target, parts }
  }
  function wheel(value: unknown): WheelSite | null {
    if (value === null) return null
    const p = v.object(value, 'wheel', ['tile', 'direction', 'poles'])
    const tile = v.tile(p.tile, 'wheel.tile'), direction = v.direction(p.direction, 'wheel.direction'), poles = v.array(p.poles, 'wheel.poles', undefined, 2).map(t => v.tile(t, 'wheel.pole'))
    const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0, dy = direction === 'south' ? 1 : direction === 'north' ? -1 : 0
    if (tile % SIZE + dx < 0 || tile % SIZE + dx >= SIZE || Math.floor(tile / SIZE) + dy < 0 || Math.floor(tile / SIZE) + dy >= SIZE || poles.includes(tile) || new Set(poles).size !== poles.length || poles.some((p, i) => i === poles.length - 1 ? Math.abs(tile % SIZE - p % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(p / SIZE)) !== 1 : Math.max(Math.abs(p % SIZE - poles[i + 1] % SIZE), Math.abs(Math.floor(p / SIZE) - Math.floor(poles[i + 1] / SIZE))) > 6)) v.invalid('wheel', 'invalid shore geometry')
    return { tile, direction, poles }
  }
  const links = v.array(r.links, 'infrastructure.links', undefined, 3).map(connection)
  const occupied = links.flatMap(p => p.parts.map(p => p.tile)), ownedWheel = wheel(r.wheel)
  if (new Set(links.map(p => p.kind)).size !== links.length || new Set(occupied).size !== occupied.length || ownedWheel && wheelParts(ownedWheel).some(p => occupied.includes(p.tile))) v.invalid('infrastructure', 'overlapping or duplicate ownership')
  const plan = r.plan === null ? null : connection(r.plan), wheelPlan = wheel(r.wheelPlan), repair = v.boolean(r.repair, 'infrastructure.repair')
  if (plan && (repair ? !links.some(p => JSON.stringify(p) === JSON.stringify(plan)) : links.some(p => p.kind === plan.kind || p.parts.some(b => plan.parts.some(a => a.tile === b.tile))))) v.invalid('infrastructure.plan', 'unknown repair or duplicate new connection')
  if (wheelPlan && ownedWheel && JSON.stringify(wheelPlan) !== JSON.stringify(ownedWheel)) v.invalid('wheelPlan', 'repair must retain the original wheel')
  if (plan && ownedWheel && plan.parts.some(p => wheelParts(ownedWheel).some(w => w.tile === p.tile)) || wheelPlan && wheelParts(wheelPlan).some(p => occupied.includes(p.tile))) v.invalid('infrastructure', 'overlapping wheel and transport plans')
  const built = v.count(r.built, 'infrastructure.built', plan ? plan.parts.length : wheelPlan ? wheelParts(wheelPlan).length : 0)
  const nextOrderAtMs = v.count(r.nextOrderAtMs, 'infrastructure.nextOrderAtMs', world.timeMs + 300000)
  if (nextOrderAtMs % 50 || repair && !plan) v.invalid('infrastructure', 'invalid work clock')
  return { links, plan, wheel: ownedWheel, wheelPlan, built, repair, eco: v.count(r.eco, 'infrastructure.eco', 3), craftsman: v.count(r.craftsman, 'infrastructure.craftsman', 3), order: r.order === null ? null : v.choice(r.order, 'infrastructure.order', ['eco', 'craftsman'] as const), nextOrderAtMs }
}
export function validateInfrastructureTask(h: Homestead, world: World): void {
  const s = h.infrastructure, task = h.task
  if ((task === 'buildConnection') !== (s.plan !== null) || (task === 'buildWheel') !== (s.wheelPlan !== null) || (task === 'finishOrder') !== (s.order !== null)) v.invalid('infrastructure', 'plan must match active task')
  const amount = inventoryTotal(h.carried)
  if (s.eco > 0 && world.coopProject?.phase !== 'complete' || s.craftsman > 0 && world.workshopProject?.phase !== 'complete') v.invalid('infrastructure', 'development stages require their original host')
  if (task === 'parkBicycle' && (!h.cargoBicycle || amount || h.elapsedMs || h.target === null)) v.invalid('infrastructure', 'invalid physical parking task')
  const validInvoice = (invoice: Partial<Homestead['carried']>) => !amount || ITEMS.every(i => h.carried[i] === (invoice[i] ?? 0))
  if (task === 'buildConnection' && (h.target !== h.store || !validInvoice({ ironPlate: s.repair ? 1 : 8 }) || h.elapsedMs > 4000 || h.elapsedMs > 0 && !amount || !s.repair && s.built > 0 && !amount)) v.invalid('infrastructure', 'invalid paid connection work')
  if (task === 'buildWheel' && (h.target !== h.store || !validInvoice({ wood: 10 }) || h.elapsedMs > 4000 || h.elapsedMs > 0 && !amount && world.buildings[s.wheelPlan!.tile]?.kind !== 'waterwheel' && s.wheel?.tile !== s.wheelPlan!.tile)) v.invalid('infrastructure', 'invalid paid wheel work')
  if (task === 'finishOrder') {
    const path = s.order!, project = path === 'eco' ? world.coopProject : world.workshopProject
    if (s[path] >= 3 || h.target !== project?.tiles[0] || project.phase !== 'complete' || !validInvoice(path === 'eco' ? { woodenCrate: 2 } : { ironGear: 4 }) || h.elapsedMs > 8000 || h.elapsedMs > 0 && !amount) v.invalid('infrastructure', 'invalid paid development order')
  }
}
