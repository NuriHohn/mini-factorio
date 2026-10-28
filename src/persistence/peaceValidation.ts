import { COVER_MS } from '../simulation/coopCover'
import { PRESS_ACTIVITY_MS } from '../simulation/gearPress'
import { EXPERIMENT_ACTIVITY_MS } from '../simulation/experiment'
import { VERANDA_REST_MS } from '../simulation/veranda'
import { WORKSHOP_ACTIVITY_MS } from '../simulation/workshop'
import { TEND_MS } from '../simulation/ecoProjects'
import { CAMPFIRE_HAPPY_MS, COOKING_MS } from '../simulation/campfire'
import { EGG_COLLECT_MS } from '../simulation/poultry'
import { crateAtSpot, SUPPLY_INSPECTION_MS } from '../simulation/supplyCrate'
import { restoreRowboat } from './rowboatValidation'
import { BOARDING_MS } from '../simulation/rowboat'
import { dockAtSpot, FISHING_MS } from '../simulation/fishingDock'
import { createPeace, PROJECT_CHECK_MS, GIFT_MAX_MS, MAX_GIFTS, PEACE_ACTIVITIES } from '../simulation/peace'
import type { PeaceState } from '../simulation/peace'
import { neighboringTiles } from '../simulation/navigation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restorePeace(value: unknown, world: World, version: number): PeaceState {
  const s = v.object(value, 'game.peace', ['home', 'activity', 'sinceMs', 'untilMs', 'destination', 'nextGiftAtMs', 'nextId', 'seed', 'gifts', 'shutdown', 'reactionAtMs', ...(version >= 26 ? ['nextProjectCheckAtMs'] : [])], version >= 12 ? ['boat'] : [])
  const clock = (value: unknown, name: string, max: number) => {
    const n = v.count(value, `peace.${name}`, max)
    if (n % 50) v.invalid(`peace.${name}`, 'expected fixed-step clock')
    return n
  }
  const home = s.home === null ? null : v.tile(s.home, 'peace.home')
  const homes = world.buildings.filter(b => b?.kind === 'treehouse')
  const rebuildingHome = version >= 45 && !!world.miniFactory && home !== null && !world.buildings[home] && !!world.rebuilding?.jobs.some(j => j.tile === home && j.owner.type === 'home')
  if (homes.length !== (home === null || rebuildingHome ? 0 : 1) || (home !== null && !rebuildingHome && world.buildings[home]?.kind !== 'treehouse')) v.invalid('peace.home', 'treehouse and peace state disagree')
  const activity = v.choice(s.activity, 'peace.activity', PEACE_ACTIVITIES.slice(0, version >= 38 ? 41 : version >= 37 ? 37 : version >= 36 ? 30 : version >= 28 ? 26 : version >= 27 ? 24 : version >= 25 ? 22 : version >= 24 ? 21 : version >= 23 ? 19 : version >= 18 ? 17 : version >= 17 ? 14 : version >= 15 ? 12 : version >= 14 ? 11 : version >= 12 ? 9 : version >= 11 ? 8 : 6))
  const sinceMs = clock(s.sinceMs, 'sinceMs', world.timeMs)
  const untilMs = clock(s.untilMs, 'untilMs', world.timeMs + (version >= 11 ? FISHING_MS : 12000))
  const destination = s.destination === null ? null : v.tile(s.destination, 'peace.destination')
  const boat = Object.hasOwn(s, 'boat') ? restoreRowboat(s.boat, world, destination, sinceMs, untilMs) : undefined
  if ((activity === 'boating') !== !!boat) v.invalid('peace.boat', 'boat and activity disagree')
  const nextProjectCheckAtMs = version >= 26 ? clock(s.nextProjectCheckAtMs, 'nextProjectCheckAtMs', world.timeMs + PROJECT_CHECK_MS) : 0
  const nextGiftAtMs = clock(s.nextGiftAtMs, 'nextGiftAtMs', world.timeMs + (version >= 26 ? GIFT_MAX_MS * (world.miniFactory ? 2 : 1) : 600000))
  const nextId = v.number(s.nextId, 'peace.nextId', 1, Number.MAX_SAFE_INTEGER, true)
  let previous = 0
  const occupied = new Set<number>()
  const gifts = v.array(s.gifts, 'peace.gifts', undefined, MAX_GIFTS).map((entry, i) => {
    const name = `peace.gifts[${i}]`, g = v.object(entry, name, ['id', 'tile', 'kind', 'wood', 'atMs'])
    const id = v.number(g.id, `${name}.id`, 1, nextId - 1, true), tile = v.tile(g.tile, `${name}.tile`)
    const kind = v.choice(g.kind, `${name}.kind`, ['wood', 'flowers'] as const)
    const wood = v.count(g.wood, `${name}.wood`, 2), atMs = clock(g.atMs, `${name}.atMs`, world.timeMs)
    if (id <= previous || occupied.has(tile) || (kind === 'wood' ? wood < 1 : wood !== 0) || home === null || Math.max(Math.abs(tile % SIZE - home % SIZE), Math.abs(Math.floor(tile / SIZE) - Math.floor(home / SIZE))) > 3 || tile === home) v.invalid(name, 'invalid gift identity, reward or location')
    previous = id; occupied.add(tile)
    return { id, tile, kind, wood, atMs }
  })
  let shutdown: PeaceState['shutdown'] = null
  if (s.shutdown !== null) {
    const b = v.object(s.shutdown, 'peace.shutdown', ['position', 'atMs'])
    shutdown = { position: v.position(b.position, 'peace.shutdown.position'), atMs: clock(b.atMs, 'shutdown.atMs', world.timeMs) }
    if (home === null || world.timeMs - shutdown.atMs >= 6000) v.invalid('peace.shutdown', 'invalid shutdown lifetime')
  }
  const reactionAtMs = s.reactionAtMs === null ? null : clock(s.reactionAtMs, 'reactionAtMs', world.timeMs)
  const p = world.pete, r = world.revenge
  if (home === null) {
    if (nextProjectCheckAtMs !== 0 || activity !== 'homeward' || destination !== null || nextGiftAtMs !== 0 || gifts.length || shutdown || untilMs !== sinceMs) v.invalid('peace', 'conflict contains peaceful activity')
    if (reactionAtMs !== null && (world.timeMs - reactionAtMs >= 4000 || reactionAtMs !== sinceMs)) v.invalid('peace.reactionAtMs', 'expired reaction')
  } else {
    if (nextGiftAtMs <= world.timeMs || reactionAtMs !== null || p.mode !== 'WANDERING' || p.water || p.prison || p.pumpkin || p.webMs || p.trappedBy !== null || p.ignoredWebs.length || p.escape !== null || p.cryingMs || p.jailbreak || world.police.car || world.police.flash || world.police.retryAtMs !== 0 || r.boss || r.blast || !['idle', 'warning'].includes(r.stage)) v.invalid('peace', 'peace overlaps hostile or custody state')
    if (activity === 'flying' && ![6000, 12000].includes(untilMs - sinceMs)) v.invalid('peace.activity', 'invalid flight duration')
    const duration = activity === 'developmentWork' ? untilMs - sinceMs : activity === 'dismounting' ? 1000 : activity === 'flying' ? untilMs - sinceMs : activity === 'crashRest' || activity === 'storingTreasure' ? 2000 : activity === 'pickingTreasure' ? 1500 : ['covering', 'uncovering'].includes(activity) ? COVER_MS : activity === 'pressing' ? PRESS_ACTIVITY_MS : activity === 'experimenting' ? EXPERIMENT_ACTIVITY_MS : activity === 'verandaRest' ? VERANDA_REST_MS : activity === 'hammering' ? WORKSHOP_ACTIVITY_MS : activity === 'gardening' ? TEND_MS : activity === 'cooking' ? COOKING_MS : activity === 'campfireHappy' ? CAMPFIRE_HAPPY_MS : activity === 'collectingEgg' ? EGG_COLLECT_MS : activity === 'checkingCrate' ? SUPPLY_INSPECTION_MS : activity === 'boating' ? boat!.phase === 'rowing' ? 0 : BOARDING_MS : activity === 'fishing' ? FISHING_MS : activity === 'entering' ? 3000 : activity === 'resting' ? 12000 : activity === 'waving' ? 4000 : activity === 'flowers' ? 5000 : 0
    // Waves after walks last five seconds; recovery waves last four.
    if (activity === 'developmentWork' && ![1000, 1500, 2000, 4000, 6000, 12000].includes(duration)) v.invalid('peace.activity', 'invalid development duration')
    if (duration ? untilMs <= world.timeMs || (activity === 'waving' ? ![4000, 5000].includes(untilMs - sinceMs) : untilMs - sinceMs !== duration) : untilMs !== sinceMs) v.invalid('peace.activity', 'invalid activity clock')
    if (!['developmentward', 'cycling', 'treasureward', 'treasureHomeward', 'flightward', 'coverward', 'uncoverward', 'homeward', 'walking', 'dockward', 'crateward', 'project', 'eggward', 'campfireward', 'gardenward', 'workshopward', 'experimentward', 'pressward'].includes(activity) && ((!['developmentWork', 'dismounting', 'pickingTreasure', 'storingTreasure', 'covering', 'uncovering', 'fishing', 'boating', 'checkingCrate', 'collectingEgg', 'cooking', 'gardening', 'hammering', 'experimenting', 'pressing'].includes(activity) && destination !== null) || p.next !== null || p.path.length || p.travelMs !== 0)) v.invalid('peace.activity', 'stationary activity contains movement')
    if (['dockward', 'fishing', 'boating'].includes(activity) && (!dockAtSpot(world, destination) || (['fishing', 'boating'].includes(activity) && p.tile !== destination))) v.invalid('peace.destination', 'fishing requires a valid dock approach')
    if (['entering', 'resting', 'verandaRest'].includes(activity) && !neighboringTiles(home).includes(p.tile)) v.invalid('peace.activity', 'home activity is away from entrance')
    // A pending legacy 5–10-minute deadline remains valid after resaving as version 26.
    const house = world.buildings[home]!
    if (house?.kind === 'treehouse' && (sinceMs < house.placedAtMs || nextGiftAtMs < house.placedAtMs + 300000 || gifts.some(g => g.atMs < house.placedAtMs || nextGiftAtMs < g.atMs + 300000) || (shutdown && shutdown.atMs !== house.placedAtMs))) v.invalid('peace', 'activity predates home')
  }
  return { ...createPeace(), ...(boat ? { boat } : {}), home, activity, sinceMs, untilMs, destination, nextProjectCheckAtMs, nextGiftAtMs, nextId, seed: v.count(s.seed, 'peace.seed', 0xffffffff), gifts, shutdown, reactionAtMs }
}

// Owned service crossings are available only after the validated homestead has been restored.
export function validateSupplyVisit(world: World): void {
  const s = world.peace
  if (['crateward', 'checkingCrate'].includes(s.activity) && (!crateAtSpot(world, s.destination) || s.activity === 'checkingCrate' && world.pete.tile !== s.destination)) v.invalid('peace.destination', 'supply visit requires a valid crate approach')
}
