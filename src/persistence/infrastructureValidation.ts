import { productionEndpoints } from '../simulation/productionLogistics'
import { createInfrastructure, LINK_KINDS, feedLink, linkCurrency, linkCost, ecoLink } from '../simulation/infrastructureRules'
import type { Connection, Infrastructure, WheelSite } from '../simulation/infrastructureRules'
import type { LoadingSite } from '../simulation/infrastructureRules'
import { loadingParts } from '../simulation/loading'
import { facing, wheelParts, recurringOrderReady } from '../simulation/infrastructure'
import { inventoryTotal, ITEMS } from '../simulation/items'
import type { Homestead } from '../simulation/homestead'
import type { HomesteadExpansion } from '../simulation/homesteadExpansion'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'

export function restoreInfrastructure(value: unknown, world: World, version: number, store: number | null, e: HomesteadExpansion, mill: number | null = null): Infrastructure {
  if (version < 49) return createInfrastructure()
  const r = v.object(value, 'infrastructure', [...(version >= 52 ? ['pavilion'] : []), ...(version >= 51 ? ['industrial', 'cargoCycles'] : []), ...(version >= 50 ? ['inventor', 'loading', 'loadingPlan', 'loadingCargo'] : []), 'links', 'plan', 'built', 'repair', 'wheel', 'wheelPlan', 'eco', 'craftsman', 'order', 'nextOrderAtMs'])
  const l = version >= 50 && r.loading !== null ? v.object(r.loading, 'loading', ['input', 'output', 'pole']) : null
  const loadingRef = l ? { input: v.tile(l.input, 'loading.input'), output: v.tile(l.output, 'loading.output'), pole: v.tile(l.pole, 'loading.pole') } : null
  function connection(value: unknown): Connection {
    const p = v.object(value, 'connection', ['kind', 'source', 'target', 'parts'], version >= 51 ? ['receiver', 'inlet'] : version >= 50 ? ['receiver'] : [])
    const kind = v.choice(p.kind, 'connection.kind', version >= 52 ? LINK_KINDS : version >= 51 ? LINK_KINDS.slice(0, 11) : LINK_KINDS.slice(0, version >= 50 ? 6 : 3)), source = v.tile(p.source, 'connection.source'), target = v.tile(p.target, 'connection.target')
    const parts = v.array(p.parts, 'connection.parts', undefined, 21).map(value => {
      const b = v.object(value, 'connection.part', ['tile', 'kind', 'direction'])
      return { tile: v.tile(b.tile, 'connection.tile'), kind: v.choice(b.kind, 'connection.part.kind', ['belt', 'inserter', 'generator', 'powerPole'] as const), direction: v.direction(b.direction, 'connection.direction') }
    })
    if (parts.length < 4 || parts[0].kind !== 'powerPole' || parts[1].kind !== 'generator' || parts[2].kind !== 'inserter' || parts.slice(3).some(p => p.kind !== 'belt') || new Set(parts.map(p => p.tile)).size !== parts.length || parts.some(p => p.tile === source || p.tile === target)) v.invalid('connection', 'invalid ordered components')
    const [expectedSource, expectedTarget] = productionEndpoints(kind, store, e, loadingRef, mill)
    if (source !== expectedSource || target !== expectedTarget || source === target) v.invalid('connection', 'connection must retain its original machines')
    const distance = (a: number, b: number) => Math.abs(a % SIZE - b % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE))
    const arm = parts[2], start = parts[3]
    if (distance(source, arm.tile) !== 1 || distance(arm.tile, start.tile) !== 1 || facing(source, arm.tile) !== arm.direction || facing(arm.tile, start.tile) !== arm.direction || !feedLink(kind) && kind !== 'loadingReturn' && !(ecoLink(kind) && kind !== 'crateReturn') && arm.direction !== 'east' || Math.max(Math.abs(parts[0].tile % SIZE - arm.tile % SIZE), Math.abs(Math.floor(parts[0].tile / SIZE) - Math.floor(arm.tile / SIZE))) > 3 || distance(parts[0].tile, parts[1].tile) !== 1) v.invalid('connection', 'invalid pickup or electrical geometry')
    const receiver = p.receiver === undefined ? target : v.tile(p.receiver, 'connection.receiver')
    if (receiver !== target && (feedLink(kind) || parts.some(p => p.tile === receiver))) v.invalid('connection.receiver', 'only incoming connections can reuse a terminal')
    for (let i = 3; i < parts.length; i++) {
      const b = parts[i], end = parts[i + 1]?.tile ?? receiver
      if (distance(b.tile, end) !== 1 || b.direction !== facing(b.tile, end)) v.invalid('connection', 'invalid cardinal belt route')
    }
    if (feedLink(kind) && parts.at(-1)!.tile === target + 1) v.invalid('connection', 'gear ingredients cannot enter against the assembler output')
    const inlet = p.inlet === undefined ? undefined : v.array(p.inlet, 'connection.inlet', undefined, 13).map(t => v.tile(t, 'connection.inlet.tile'))
    if (inlet && (kind !== 'loadingReturn' || inlet.length < 3 || inlet[0] !== e.coalMiner || inlet.at(-1) !== e.fuelStore || !inlet.slice(1, -1).includes(receiver) || new Set(inlet).size !== inlet.length || inlet.some((t, i) => i > 0 && distance(t, inlet[i - 1]) !== 1) || parts.some(p => inlet.includes(p.tile)) || parts.at(-1)!.direction === ({ east: 'west', west: 'east', north: 'south', south: 'north' } as const)[facing(receiver, inlet[inlet.indexOf(receiver) + 1])] )) v.invalid('connection.inlet', 'invalid original coal inlet')
    return { kind, source, target, ...(receiver === target ? {} : { receiver }), ...(inlet ? { inlet } : {}), parts }
  }
  function wheel(value: unknown): WheelSite | null {
    if (value === null) return null
    const p = v.object(value, 'wheel', ['tile', 'direction', 'poles'])
    const tile = v.tile(p.tile, 'wheel.tile'), direction = v.direction(p.direction, 'wheel.direction'), poles = v.array(p.poles, 'wheel.poles', undefined, 2).map(t => v.tile(t, 'wheel.pole'))
    const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0, dy = direction === 'south' ? 1 : direction === 'north' ? -1 : 0
    if (tile % SIZE + dx < 0 || tile % SIZE + dx >= SIZE || Math.floor(tile / SIZE) + dy < 0 || Math.floor(tile / SIZE) + dy >= SIZE || poles.includes(tile) || new Set(poles).size !== poles.length || poles.some((p, i) => i === poles.length - 1 ? Math.abs(tile % SIZE - p % SIZE) + Math.abs(Math.floor(tile / SIZE) - Math.floor(p / SIZE)) !== 1 : Math.max(Math.abs(p % SIZE - poles[i + 1] % SIZE), Math.abs(Math.floor(p / SIZE) - Math.floor(poles[i + 1] / SIZE))) > 6)) v.invalid('wheel', 'invalid shore geometry')
    return { tile, direction, poles }
  }
  const links = v.array(r.links, 'infrastructure.links', undefined, version >= 52 ? 14 : version >= 51 ? 11 : version >= 50 ? 6 : 3).map(connection)
  const validReceiver = (p: Connection) => p.receiver === undefined || p.inlet !== undefined || links.some(l => l !== p && l.receiver === undefined && !feedLink(l.kind) && l.target === p.target && l.parts.some(b => b.kind === 'belt' && b.tile === p.receiver && p.parts.at(-1)!.direction !== ({ east: 'west', west: 'east', north: 'south', south: 'north' } as const)[b.direction]))
  if (links.some(p => !validReceiver(p))) v.invalid('connection.receiver', 'shared terminal needs an original incoming connection')
  const occupied = links.flatMap(p => p.parts.map(p => p.tile)), ownedWheel = wheel(r.wheel)
  if (new Set(links.map(p => p.kind)).size !== links.length || new Set(occupied).size !== occupied.length || ownedWheel && wheelParts(ownedWheel).some(p => occupied.includes(p.tile))) v.invalid('infrastructure', 'overlapping or duplicate ownership')
  const plan = r.plan === null ? null : connection(r.plan), wheelPlan = wheel(r.wheelPlan), repair = v.boolean(r.repair, 'infrastructure.repair')
  if (plan && !validReceiver(plan)) v.invalid('connection.receiver', 'unknown shared terminal')
  if (plan && (repair ? !links.some(p => JSON.stringify(p) === JSON.stringify(plan)) : links.some(p => p.kind === plan.kind || p.parts.some(b => plan.parts.some(a => a.tile === b.tile))))) v.invalid('infrastructure.plan', 'unknown repair or duplicate new connection')
  if (wheelPlan && ownedWheel && JSON.stringify(wheelPlan) !== JSON.stringify(ownedWheel)) v.invalid('wheelPlan', 'repair must retain the original wheel')
  if (plan && ownedWheel && plan.parts.some(p => wheelParts(ownedWheel).some(w => w.tile === p.tile)) || wheelPlan && wheelParts(wheelPlan).some(p => occupied.includes(p.tile))) v.invalid('infrastructure', 'overlapping wheel and transport plans')
  function loading(value: unknown): LoadingSite | null {
    if (value === null || version < 50) return null
    const l = v.object(value, 'loading', ['input', 'output', 'pole'])
    const input = v.tile(l.input, 'loading.input'), output = v.tile(l.output, 'loading.output'), pole = v.tile(l.pole, 'loading.pole'), hoist = e.steamHoist
    const adjacent = (t: number) => hoist !== null && Math.abs(t % SIZE - hoist % SIZE) + Math.abs(Math.floor(t / SIZE) - Math.floor(hoist / SIZE)) === 1
    const reachableBuffer = (t: number) => hoist !== null && (t % SIZE === hoist % SIZE || Math.floor(t / SIZE) === Math.floor(hoist / SIZE)) && Math.abs(t % SIZE - hoist % SIZE) + Math.abs(Math.floor(t / SIZE) - Math.floor(hoist / SIZE)) >= 1 && Math.abs(t % SIZE - hoist % SIZE) + Math.abs(Math.floor(t / SIZE) - Math.floor(hoist / SIZE)) <= 2
    if (hoist === null || input === output || !reachableBuffer(input) || !reachableBuffer(output) || !adjacent(pole) || pole === input || pole === output || [input, output, pole].some(t => occupied.includes(t) || ownedWheel && wheelParts(ownedWheel).some(p => p.tile === t))) v.invalid('loading', 'invalid owned hoist geometry')
    return { input, output, pole }
  }
  const ownedLoading = version >= 50 ? loading(r.loading) : null, loadingPlan = version >= 50 ? loading(r.loadingPlan) : null
  if (ownedLoading && plan && plan.parts.some(p => loadingParts(ownedLoading).some(l => l.tile === p.tile))) v.invalid('loading', 'connection overlaps owned loading footprint')
  if (ownedLoading && wheelPlan && wheelParts(wheelPlan).some(p => loadingParts(ownedLoading).some(l => l.tile === p.tile))) v.invalid('loading', 'wheel overlaps owned loading footprint')
  if (loadingPlan && ownedLoading && JSON.stringify(loadingPlan) !== JSON.stringify(ownedLoading)) v.invalid('loading', 'repair must preserve original geometry')
  const loadingCargo = version < 50 || r.loadingCargo === null ? null : v.choice(r.loadingCargo, 'loadingCargo', ['coal', 'coalBriquette'] as const)
  if (loadingCargo && (!ownedLoading || e.steamHoist === null || world.buildings[e.steamHoist]?.kind !== 'steamHoist')) v.invalid('loadingCargo', 'requires an owned standing hoist')
  const built = v.count(r.built, 'infrastructure.built', plan ? plan.parts.length : wheelPlan ? wheelParts(wheelPlan).length : loadingPlan ? 3 : 0)
  const nextOrderAtMs = v.count(r.nextOrderAtMs, 'infrastructure.nextOrderAtMs', world.timeMs + 300000)
  if (nextOrderAtMs % 50 || repair && !plan) v.invalid('infrastructure', 'invalid work clock')
  const pv = version >= 52 && r.pavilion !== null ? v.object(r.pavilion, 'pavilion', ['tile', 'spot', 'stage', 'repair']) : null
  const pavilion = pv ? { tile: v.tile(pv.tile, 'pavilion.tile'), spot: v.tile(pv.spot, 'pavilion.spot'), stage: v.count(pv.stage, 'pavilion.stage', 3), repair: v.boolean(pv.repair, 'pavilion.repair') } : null
  if (pavilion) {
    const orchard = world.orchardProject, t = pavilion.tile
    if (orchard?.phase !== 'complete' || Math.max(Math.abs(t % SIZE - orchard.tiles[0] % SIZE), Math.abs(Math.floor(t / SIZE) - Math.floor(orchard.tiles[0] / SIZE))) > 3 || Math.abs(t % SIZE - pavilion.spot % SIZE) + Math.abs(Math.floor(t / SIZE) - Math.floor(pavilion.spot / SIZE)) !== 1 || t === orchard.tiles[0] || occupied.includes(t) || plan?.parts.some(p => p.tile === t) || wheelPlan && wheelParts(wheelPlan).some(p => p.tile === t) || loadingPlan && loadingParts(loadingPlan).some(p => p.tile === t) || ownedWheel && wheelParts(ownedWheel).some(p => p.tile === t) || ownedLoading && loadingParts(ownedLoading).some(p => p.tile === t) || pavilion.repair && !pavilion.stage) v.invalid('pavilion', 'invalid owned orchard site')
  }
  return { pavilion, industrial: version >= 51 ? v.count(r.industrial, 'infrastructure.industrial', 3) : 0, cargoCycles: version >= 51 ? v.count(r.cargoCycles, 'infrastructure.cargoCycles', Number.MAX_SAFE_INTEGER) : 0, inventor: version >= 50 ? v.count(r.inventor, 'infrastructure.inventor', 3) : 0, loading: ownedLoading, loadingPlan, loadingCargo, links, plan, wheel: ownedWheel, wheelPlan, built, repair, eco: v.count(r.eco, 'infrastructure.eco', 3), craftsman: v.count(r.craftsman, 'infrastructure.craftsman', 3), order: r.order === null ? null : v.choice(r.order, 'infrastructure.order', version >= 51 ? ['eco', 'craftsman', 'inventor', 'industrial'] as const : version >= 50 ? ['eco', 'craftsman', 'inventor'] as const : ['eco', 'craftsman'] as const), nextOrderAtMs }
}
export function validateInfrastructureTask(h: Homestead, world: World): void {
  const s = h.infrastructure, task = h.task
  if ((task === 'buildConnection') !== (s.plan !== null) || (task === 'buildWheel') !== (s.wheelPlan !== null) || (task === 'finishOrder') !== (s.order !== null) || (task === 'buildLoading') !== (s.loadingPlan !== null)) v.invalid('infrastructure', 'plan must match active task')
  const amount = inventoryTotal(h.carried)
  const pavilion = s.pavilion
  if ((task === 'buildPavilion' && (!pavilion || h.target !== pavilion.tile || amount > 0 && (h.carried.woodPanel !== 4 || h.carried.woodenCrate !== 2 || amount !== 6) || h.elapsedMs > 8000 || h.elapsedMs > 0 && !amount || pavilion.stage >= 3 && !pavilion.repair)) || pavilion?.repair && task !== 'buildPavilion') v.invalid('pavilion', 'invalid paid pavilion work')
  if (pavilion && (s.eco < 3 || world.personality.paths.eco.level < 5 || world.produced.woodenCrate < 8)) v.invalid('pavilion', 'requires completed Eco development and real crate production')
  if (world.buildings.some((b, t) => b?.kind === 'petePavilion' && (pavilion?.tile !== t || !pavilion.stage))) v.invalid('pavilion', 'structure without completed stage')
  if ((s.cargoCycles > 0 || s.industrial > 0) && (!s.loading || h.expansion.steamHoist === null) || s.industrial > 0 && (s.cargoCycles < 10 || h.expansion.steamWorkshop === null)) v.invalid('infrastructure', 'Industrial work requires its original hosts and real cargo')
  if (s.eco > 0 && world.coopProject?.phase !== 'complete' || s.craftsman > 0 && world.workshopProject?.phase !== 'complete') v.invalid('infrastructure', 'development stages require their original host')
  if (task === 'parkBicycle' && (!h.cargoBicycle || amount || h.elapsedMs || h.target === null)) v.invalid('infrastructure', 'invalid physical parking task')
  const validInvoice = (invoice: Partial<Homestead['carried']>) => !amount || ITEMS.every(i => h.carried[i] === (invoice[i] ?? 0))
  if (task === 'buildConnection' && (h.target !== h.store || !validInvoice({ [linkCurrency(s.plan!.kind)]: s.repair ? 1 : linkCost(s.plan!.kind) }) || h.elapsedMs > 4000 || h.elapsedMs > 0 && !amount || !s.repair && s.built > 0 && !amount)) v.invalid('infrastructure', 'invalid paid connection work')
  if (task === 'buildWheel' && (h.target !== h.store || !validInvoice({ wood: 10 }) || h.elapsedMs > 4000 || h.elapsedMs > 0 && !amount && world.buildings[s.wheelPlan!.tile]?.kind !== 'waterwheel' && s.wheel?.tile !== s.wheelPlan!.tile)) v.invalid('infrastructure', 'invalid paid wheel work')
  if (s.inventor > 0 && world.experimentProject?.phase !== 'complete' || s.inventor > 1 && world.flightProject?.phase !== 'complete') v.invalid('infrastructure', 'inventor stages require their original hosts')
  if (task === 'buildLoading' && (h.target !== h.store || !validInvoice({ coal: 6 }) || h.elapsedMs > 4000 || h.elapsedMs > 0 && !amount && world.buildings[s.loadingPlan!.input]?.kind !== 'fuelDepot')) v.invalid('loading', 'invalid commissioning stock')
  if (task === 'fetchLoading' || task === 'takeLoading') {
    if (!s.loading || amount || h.elapsedMs || h.target !== (task === 'fetchLoading' ? s.links.some(p => p.kind === 'loadingFeed') ? h.expansion.briquetteAssembler : h.expansion.fuelStore : s.loading.output)) v.invalid('loading', 'invalid pickup')
  }
  if (task === 'feedLoading' && (!s.loading || h.target !== s.loading.input || amount < 1 || amount > 2 || amount !== h.carried.coal + h.carried.coalBriquette || h.elapsedMs)) v.invalid('loading', 'invalid fuel delivery')
  if (task === 'finishOrder') {
    const path = s.order!
    if (path === 'industrial') {
      const target = s.industrial === 0 ? h.expansion.steamWorkshop : h.expansion.steamHoist
      if (s.industrial >= 3 && !recurringOrderReady(world, path) || s.cargoCycles < 10 || h.target !== target || !validInvoice({ coalBriquette: 6 }) || h.elapsedMs > 8000 || h.elapsedMs > 0 && !amount) v.invalid('infrastructure', 'invalid paid Industrial order')
      return
    }
    const project = path === 'eco' ? world.coopProject : path === 'inventor' ? (s.inventor === 0 ? world.experimentProject : world.flightProject) : world.workshopProject
    if (s[path] >= 3 && !recurringOrderReady(world, path) || h.target !== project?.tiles[0] || project.phase !== 'complete' || !validInvoice(path === 'eco' ? { woodenCrate: 2 } : path === 'inventor' ? { copperCable: 4, electronicCircuit: 2 } : { ironGear: 4 }) || h.elapsedMs > 8000 || h.elapsedMs > 0 && !amount) v.invalid('infrastructure', 'invalid paid development order')
  }
}
