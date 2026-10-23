import { TEND_MS } from '../simulation/ecoProjects'
import { CAMPFIRE_HAPPY_MS, COOKING_MS } from '../simulation/campfire'
import { EGG_COLLECT_MS } from '../simulation/poultry'
import { crateAtSpot, SUPPLY_INSPECTION_MS } from '../simulation/supplyCrate'
import { restoreRowboat } from './rowboatValidation'
import { BOARDING_MS } from '../simulation/rowboat'
import { dockAtSpot, FISHING_MS } from '../simulation/fishingDock'
import { createPeace, GIFT_MIN_MS, GIFT_MAX_MS, MAX_GIFTS, PEACE_ACTIVITIES } from '../simulation/peace'
import type { PeaceState } from '../simulation/peace'
import { neighboringTiles } from '../simulation/navigation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restorePeace(value: unknown, world: World, version: number): PeaceState {
  const s = v.object(value, 'game.peace', ['home', 'activity', 'sinceMs', 'untilMs', 'destination', 'nextGiftAtMs', 'nextId', 'seed', 'gifts', 'shutdown', 'reactionAtMs'], version >= 12 ? ['boat'] : [])
  const clock = (value: unknown, name: string, max: number) => {
    const n = v.count(value, `peace.${name}`, max)
    if (n % 50) v.invalid(`peace.${name}`, 'expected fixed-step clock')
    return n
  }
  const home = s.home === null ? null : v.tile(s.home, 'peace.home')
  const homes = world.buildings.filter(b => b?.kind === 'treehouse')
  if (homes.length !== (home === null ? 0 : 1) || (home !== null && world.buildings[home]?.kind !== 'treehouse')) v.invalid('peace.home', 'treehouse and peace state disagree')
  const activity = v.choice(s.activity, 'peace.activity', PEACE_ACTIVITIES.slice(0, version >= 23 ? 19 : version >= 18 ? 17 : version >= 17 ? 14 : version >= 15 ? 12 : version >= 14 ? 11 : version >= 12 ? 9 : version >= 11 ? 8 : 6))
  const sinceMs = clock(s.sinceMs, 'sinceMs', world.timeMs)
  const untilMs = clock(s.untilMs, 'untilMs', world.timeMs + (version >= 11 ? FISHING_MS : 12000))
  const destination = s.destination === null ? null : v.tile(s.destination, 'peace.destination')
  const boat = Object.hasOwn(s, 'boat') ? restoreRowboat(s.boat, world, destination, sinceMs, untilMs) : undefined
  if ((activity === 'boating') !== !!boat) v.invalid('peace.boat', 'boat and activity disagree')
  const nextGiftAtMs = clock(s.nextGiftAtMs, 'nextGiftAtMs', world.timeMs + GIFT_MAX_MS)
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
    if (activity !== 'homeward' || destination !== null || nextGiftAtMs !== 0 || gifts.length || shutdown || untilMs !== sinceMs) v.invalid('peace', 'conflict contains peaceful activity')
    if (reactionAtMs !== null && (world.timeMs - reactionAtMs >= 4000 || reactionAtMs !== sinceMs)) v.invalid('peace.reactionAtMs', 'expired reaction')
  } else {
    if (nextGiftAtMs <= world.timeMs || reactionAtMs !== null || p.mode !== 'WANDERING' || p.water || p.prison || p.pumpkin || p.webMs || p.trappedBy !== null || p.ignoredWebs.length || p.escape !== null || p.cryingMs || p.jailbreak || world.police.car || world.police.flash || world.police.retryAtMs !== 0 || r.boss || r.blast || !['idle', 'warning'].includes(r.stage)) v.invalid('peace', 'peace overlaps hostile or custody state')
    const duration = activity === 'gardening' ? TEND_MS : activity === 'cooking' ? COOKING_MS : activity === 'campfireHappy' ? CAMPFIRE_HAPPY_MS : activity === 'collectingEgg' ? EGG_COLLECT_MS : activity === 'checkingCrate' ? SUPPLY_INSPECTION_MS : activity === 'boating' ? boat!.phase === 'rowing' ? 0 : BOARDING_MS : activity === 'fishing' ? FISHING_MS : activity === 'entering' ? 3000 : activity === 'resting' ? 12000 : activity === 'waving' ? 4000 : activity === 'flowers' ? 5000 : 0
    // Waves after walks last five seconds; recovery waves last four.
    if (duration ? untilMs <= world.timeMs || (activity === 'waving' ? ![4000, 5000].includes(untilMs - sinceMs) : untilMs - sinceMs !== duration) : untilMs !== sinceMs) v.invalid('peace.activity', 'invalid activity clock')
    if (!['homeward', 'walking', 'dockward', 'crateward', 'project', 'eggward', 'campfireward', 'gardenward'].includes(activity) && ((!['fishing', 'boating', 'checkingCrate', 'collectingEgg', 'cooking', 'gardening'].includes(activity) && destination !== null) || p.next !== null || p.path.length || p.travelMs !== 0)) v.invalid('peace.activity', 'stationary activity contains movement')
    if (['dockward', 'fishing', 'boating'].includes(activity) && (!dockAtSpot(world, destination) || (['fishing', 'boating'].includes(activity) && p.tile !== destination))) v.invalid('peace.destination', 'fishing requires a valid dock approach')
    if (['crateward', 'checkingCrate'].includes(activity) && (!crateAtSpot(world, destination) || (activity === 'checkingCrate' && p.tile !== destination))) v.invalid('peace.destination', 'supply visit requires a valid crate approach')
    if (['entering', 'resting'].includes(activity) && !neighboringTiles(home).includes(p.tile)) v.invalid('peace.activity', 'home activity is away from entrance')
    const house = world.buildings[home]!
    if (house.kind === 'treehouse' && (sinceMs < house.placedAtMs || nextGiftAtMs < house.placedAtMs + GIFT_MIN_MS || gifts.some(g => g.atMs < house.placedAtMs || nextGiftAtMs < g.atMs + GIFT_MIN_MS) || (shutdown && shutdown.atMs !== house.placedAtMs))) v.invalid('peace', 'activity predates home')
  }
  return { ...createPeace(), ...(boat ? { boat } : {}), home, activity, sinceMs, untilMs, destination, nextGiftAtMs, nextId, seed: v.count(s.seed, 'peace.seed', 0xffffffff), gifts, shutdown, reactionAtMs }
}
