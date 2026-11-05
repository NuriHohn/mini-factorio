import { ownedConnections } from './infrastructureRules'
import { GATE_OPEN_MS } from './gardenGate'
import { SIZE, inside, offsets } from './grid'
import type { World } from './world'

const mineCrossingCache = new WeakMap<World, { revision: number; plan: NonNullable<World['homestead']>['expansion']['plan']; tiles: Set<number>; signature: string }>()
function mineCrossings(world: World): Set<number> {
  const h = world.homestead!, e = h.expansion
  const signature = `${e.miner}:${e.furnace}:${e.copperMiner}:${e.copperFurnace}:${e.coalMiner}:${e.fuelStore}`
  const cached = mineCrossingCache.get(world)
  if (cached?.revision === world.topologyRevision && cached.plan === e.plan && cached.signature === signature) return cached.tiles
  const tiles = new Set<number>(world.deposits?.retiring ?? [])
  const plans = [e.plan, world.warehousing?.resite?.to, ...(world.rebuilding?.jobs.flatMap(j => j.owner.type === 'chain' ? [j.owner.plan] : []) ?? [])]
  for (const plan of plans) if (plan && ['ironMining', 'copperMining', 'coalMining'].includes(plan.kind)) for (const tile of plan.route?.slice(1) ?? []) tiles.add(tile)
  for (const [source, target] of [[e.miner, e.furnace === null ? null : e.furnace - 1], [e.copperMiner, e.copperFurnace === null ? null : e.copperFurnace - 1], [e.coalMiner, e.fuelStore]]) {
    if (source === null || target === null) continue
    let tile = source
    for (let i = 0; i < 13; i++) {
      const b = world.buildings[tile]
      if (b?.kind !== 'miner' && b?.kind !== 'belt') break
      if (b.kind === 'belt') tiles.add(tile)
      if (tile === target) break
      const next = tile + offsets[b.direction].y * SIZE + offsets[b.direction].x
      if (!inside(next % SIZE, Math.floor(next / SIZE)) || Math.abs(next % SIZE - tile % SIZE) > 1) break
      tile = next
    }
  }
  mineCrossingCache.set(world, { revision: world.topologyRevision, plan: e.plan, tiles, signature })
  return tiles
}

export function neighboringTiles(tile: number): number[] {
  const x = tile % SIZE, y = Math.floor(tile / SIZE)
  return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].filter(([a, b]) => inside(a, b)).map(([a, b]) => b * SIZE + a)
}
export function walkableTile(world: World, tile: number, peteGates = false): boolean {
  if (peteGates && serviceCrossing(world, tile)) return true
  return tile >= 0 && tile < SIZE * SIZE && (world.water[tile] && world.buildings[tile]?.kind === 'footbridge' || (!world.water[tile] && (!world.buildings[tile] || (world.buildings[tile]?.kind === 'peteFence' && world.chickenRun?.tiles.slice(0, world.chickenRun.built).includes(tile)) || (world.buildings[tile]?.kind === 'peteGate' && (peteGates || world.buildings[tile].openMs === GATE_OPEN_MS)))))
}
export function serviceCrossing(world: World, tile: number): boolean {
  const s = world.homestead?.infrastructure, b = world.buildings[tile]
  const e = world.homestead?.expansion
  const boilerFeeder = b?.kind === 'inserter' && (e?.coalInserter === tile || e?.plan?.kind === 'coalFeed' && e.plan.anchor === tile)
  return !!s && !world.water[tile] && (b?.kind === 'belt' || b?.kind === 'inserter') && (boilerFeeder || b.kind === 'belt' && mineCrossings(world).has(tile) || ownedConnections(world).some(link => link.parts.some(p => p.tile === tile && p.kind === b.kind) || b.kind === 'belt' && !!link.inlet?.slice(link.inlet.indexOf(link.receiver ?? -1), -1).includes(tile)))
}
export function reachableTiles(world: World, start: number, footbridges = true, peteGates = false): Map<number, number> {
  const queue = [start], parents = new Map<number, number>([[start, -1]])
  for (let head = 0; head < queue.length; head++) for (const tile of neighboringTiles(queue[head])) {
    if ((footbridges ? walkableTile(world, tile, peteGates) : !world.water[tile] && !world.buildings[tile]) && !parents.has(tile)) { parents.set(tile, queue[head]); queue.push(tile) }
  }
  return parents
}
export function tilePath(parents: Map<number, number>, target: number): number[] | null {
  if (!parents.has(target)) return null
  const path: number[] = []
  for (let tile = target; parents.get(tile) !== -1; tile = parents.get(tile)!) path.unshift(tile)
  return path
}
export function edgeTile(tile: number): boolean {
  return tile % SIZE === 0 || tile % SIZE === SIZE - 1 || tile < SIZE || tile >= SIZE * (SIZE - 1)
}

// Pete may plan through his closed gate; movement still waits for the opening animation.
export function peteWalkableTile(world: World, tile: number): boolean { return walkableTile(world, tile, true) }
export function peteReachableTiles(world: World, start: number): Map<number, number> { return reachableTiles(world, start, true, true) }
