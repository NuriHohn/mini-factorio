import { arrived, begin, finish, freeSite, materialStore } from './homestead'
import { inventoryTotal } from './items'
import { neighboringTiles, peteReachableTiles, peteWalkableTile } from './navigation'
import { awardActivity } from './personality'
import { projectCandidates } from './secretProject'
import { SIZE } from './world'
import type { Pavilion } from './infrastructureRules'
import type { World } from './world'

function pavilionSite(world: World): Pavilion | null {
  const orchard = world.orchardProject?.tiles[0]
  if (orchard === undefined) return null
  const paths = peteReachableTiles(world, world.pete.tile)
  for (let radius = 1; radius <= 3; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue
    const x = orchard % SIZE + dx, y = Math.floor(orchard / SIZE) + dy, tile = y * SIZE + x
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || world.tiles[tile] || !freeSite(world, [tile])) continue
    const spot = neighboringTiles(tile).find(t => paths.has(t) && peteWalkableTile(world, t) && !world.buildings[t] && !world.water[t])
    if (spot !== undefined) return { tile, spot, stage: 0, repair: false }
  }
  return null
}
export function choosePavilion(world: World): boolean {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  if (!store || world.personality.paths.eco.level < 5 || world.orchardProject?.phase !== 'complete' || s.eco < 3 || world.produced.woodenCrate < 8) return false
  const old = s.pavilion, repair = !!old && old.stage > 0 && !world.buildings[old.tile]
  if (!repair && (old?.stage === 3 || world.timeMs < s.nextOrderAtMs || projectCandidates(world).some(p => !p.definition.repeatable && !['yard', 'run'].includes(p.definition.id)))) return false
  if (store.inventory.woodPanel < 4 || store.inventory.woodenCrate < 2 || store.wood < 12) return false
  const site = old ?? pavilionSite(world)
  if (!site) return false
  s.pavilion = site; site.repair = repair
  begin(world, 'buildPavilion', site.tile)
  return true
}
export function advancePavilion(world: World, delta: number): boolean {
  const h = world.homestead
  if (h?.task !== 'buildPavilion') return false
  const site = h.infrastructure.pavilion!, store = materialStore(world)
  if (!store) return true
  if (!inventoryTotal(h.carried)) {
    if (!arrived(world, h.store, delta)) return true
    if (store.inventory.woodPanel < 4 || store.inventory.woodenCrate < 2 || store.wood < 12) { site.repair = false; finish(world); return true }
    store.inventory.woodPanel -= 4; store.inventory.woodenCrate -= 2
    h.carried.woodPanel = 4; h.carried.woodenCrate = 2
  }
  const orchard = world.orchardProject
  if (orchard?.phase !== 'complete' || world.buildings[orchard.tiles[0]]?.kind !== 'peteDevelopment') return true
  const building = world.buildings[site.tile]
  if (building && building.kind !== 'petePavilion' || world.water[site.tile] || !arrived(world, site.tile, delta, true)) return true
  if (!building && !freeSite(world, [site.tile], true)) return true
  h.elapsedMs = Math.min(8000, h.elapsedMs + delta)
  if (h.elapsedMs < 8000) return true
  if (!building) { world.buildings[site.tile] = { kind: 'petePavilion', x: site.tile % SIZE, y: Math.floor(site.tile / SIZE) }; world.topologyRevision++ }
  if (!site.repair) { site.stage++; awardActivity(world.personality, { path: 'eco', xp: 8 }); h.infrastructure.nextOrderAtMs = world.timeMs + 300000 }
  site.repair = false; h.carried.woodPanel = 0; h.carried.woodenCrate = 0; finish(world)
  return true
}
