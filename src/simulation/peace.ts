import { advanceRebuilding } from './rebuilding'
import { advanceHomestead, createHomestead, HOMESTEAD_REST_INTERVAL_MS } from './homestead'
import { advanceMiniFactory } from './petesWorld'
import { beginDevelopmentWork, developmentDecision, finishDevelopment, refreshDevelopment } from './peteDevelopments'
import { beginLeisureWork, finishLeisure, leisureDecision, leisureSpot, refreshLeisure } from './peteLeisure'
import { coverSpot, COVER_MS } from './coopCover'
import { pressReady, pressSpot, refreshPress, finishPress, PRESS_ACTIVITY_MS } from './gearPress'
import { experimentSpot, refreshExperiment, finishExperiment, EXPERIMENT_ACTIVITY_MS } from './experiment'
import { hasVeranda, VERANDA_REST_MS } from './veranda'
import { workshopSpot, refreshWorkshop, finishWorkshop, WORKSHOP_ACTIVITY_MS } from './workshop'
import { gardenSpot, refreshGardening, TEND_MS, TEND_COOLDOWN_MS } from './ecoProjects'
import { preparePeteGate } from './gardenGate'
import { CAMPFIRE_HAPPY_MS, COOKING_MS, finishCooking, reachableCampfire, refreshCooking } from './campfire'
import { collectEgg, eggAt, EGG_COLLECT_MS, reachableEgg, refreshPoultry } from './poultry'
import { advanceSecretProject, currentProject, projectPlansConflict, trySecretProject } from './secretProject'
import { planYard } from './yard'
import { crateAtSpot, reachableCrateSpot, SUPPLY_INSPECTION_MS } from './supplyCrate'
import { BOARDING_MS, moveRowboat, planRowboat, rowboatValid } from './rowboat'
import type { RowboatTrip } from './rowboat'
import { dockAtSpot, FISHING_MS, reachableFishingSpot } from './fishingDock'
import { neighboringTiles, peteReachableTiles as reachableTiles, tilePath, peteWalkableTile as walkableTile } from './navigation'
import { PETE_COOLDOWN_MS, PETE_WALK_MS } from './pete'
import { WARNING_MS } from './revenge'
import { SIZE } from './world'
import type { FishingDock, Position, World } from './world'

export const TREEHOUSE_WOOD = 20
export const GIFT_MIN_MS = 900000
export const GIFT_MAX_MS = 1500000
export const PROJECT_CHECK_MS = 5000
export const MAX_GIFTS = 3
export const PEACE_ACTIVITIES = ['homeward', 'entering', 'resting', 'walking', 'waving', 'flowers', 'dockward', 'fishing', 'boating', 'crateward', 'checkingCrate', 'project', 'eggward', 'collectingEgg', 'campfireward', 'cooking', 'campfireHappy', 'gardenward', 'gardening', 'workshopward', 'hammering', 'verandaRest', 'experimentward', 'experimenting', 'pressward', 'pressing', 'coverward', 'covering', 'uncoverward', 'uncovering', 'treasureward', 'pickingTreasure', 'treasureHomeward', 'storingTreasure', 'flightward', 'flying', 'crashRest', 'developmentward', 'developmentWork', 'cycling', 'dismounting'] as const
export type PeaceActivity = typeof PEACE_ACTIVITIES[number]
export interface Gift { id: number; tile: number; kind: 'wood' | 'flowers'; wood: number; atMs: number }
export interface PeaceState {
  home: number | null
  boat?: RowboatTrip
  activity: PeaceActivity
  sinceMs: number
  untilMs: number
  destination: number | null
  nextProjectCheckAtMs: number
  nextGiftAtMs: number
  nextId: number
  seed: number
  gifts: Gift[]
  shutdown: { position: Position; atMs: number } | null
  reactionAtMs: number | null
}
export function createPeace(): PeaceState {
  return { home: null, activity: 'homeward', sinceMs: 0, untilMs: 0, destination: null, nextProjectCheckAtMs: 0, nextGiftAtMs: 0, nextId: 1, seed: 0x686f6d65, gifts: [], shutdown: null, reactionAtMs: null }
}
export function peaceful(world: World): boolean { return world.peace.home !== null }
function random(world: World): number {
  const p = world.peace
  p.seed = (Math.imul(1664525, p.seed) + 1013904223) >>> 0
  return p.seed / 4294967296
}
function scheduleGift(world: World): void {
  world.peace.nextGiftAtMs = world.timeMs + (GIFT_MIN_MS + Math.floor(random(world) * ((GIFT_MAX_MS - GIFT_MIN_MS) / 50 + 1)) * 50) * (world.homestead ? 2 : 1)
}
function reserved(world: World, tile: number): boolean {
  return world.buildings.some(b => b?.kind === 'prison' && b.exit === tile)
}
function resetPete(world: World): void {
  const p = world.pete
  // Custody can place Pete on a prison tile; choose the nearest free legal cell.
  const origin = p.tile
  const tile = world.buildings.flatMap((b, i) => !b && !world.water[i] ? [i] : []).sort((a, b) => Math.abs(a % SIZE - origin % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(origin / SIZE)) - Math.abs(b % SIZE - origin % SIZE) - Math.abs(Math.floor(b / SIZE) - Math.floor(origin / SIZE)) || a - b)[0]
  Object.assign(p, { tile, x: tile % SIZE, y: Math.floor(tile / SIZE), next: null, travelMs: 0, mode: 'WANDERING', prison: null, imprisonedAtMs: null, graceUntilMs: world.timeMs, jailbreak: null, pumpkin: null, webMs: 0, water: null, trappedBy: null, ignoredWebs: [], path: [], pathRevision: -1, escape: null, cryingMs: 0, cooldownMs: PETE_COOLDOWN_MS })
  world.police.car = null; world.police.flash = null; world.police.retryAtMs = 0
}
function activity(world: World, name: PeaceActivity, duration = 0, destination: number | null = null): void {
  Object.assign(world.peace, { activity: name, sinceMs: world.timeMs, untilMs: world.timeMs + duration, destination })
  world.pete.path = []; world.pete.pathRevision = -1
}
export function beginPeace(world: World, home: number): void {
  if (peaceful(world) || world.buildings[home]?.kind !== 'treehouse') return
  const r = world.revenge
  world.peace.home = home
  world.peace.nextProjectCheckAtMs = 0
  if (r.boss) {
    world.peace.shutdown = { position: { x: r.boss.x, y: r.boss.y }, atMs: world.timeMs }
    world.pete.tile = r.boss.tile // Emerge from the walker, not Pete's frozen pre-flight tile.
  }
  // Cancel the encounter, never invoke combat defeat (which changes escalation).
  if (r.stage !== 'idle') { r.stage = r.arrests >= r.threshold ? 'warning' : 'idle'; r.untilMs = r.stage === 'warning' ? world.timeMs + WARNING_MS : 0 }
  r.boss = null; r.blast = null
  resetPete(world)
  activity(world, 'homeward')
  world.peace.reactionAtMs = null
  scheduleGift(world)
}
export function endPeace(world: World): void {
  if (!peaceful(world)) return
  delete world.peace.boat
  Object.assign(world.peace, { home: null, gifts: [], nextProjectCheckAtMs: 0, nextGiftAtMs: 0, shutdown: null, reactionAtMs: world.timeMs })
  resetPete(world)
  activity(world, 'homeward')
  if (world.revenge.stage === 'warning') world.revenge.untilMs = world.timeMs + WARNING_MS
}
function localTiles(world: World, parents: Map<number, number>): number[] {
  const home = world.peace.home!
  return [...parents.keys()].filter(i => !world.water[i] && !world.buildings[i] && !reserved(world, i) && Math.max(Math.abs(i % SIZE - home % SIZE), Math.abs(Math.floor(i / SIZE) - Math.floor(home / SIZE))) <= 3)
}
function plan(world: World): void {
  const p = world.pete, s = world.peace, parents = reachableTiles(world, p.tile)
  const local = localTiles(world, parents)
  const entrances = neighboringTiles(s.home!).filter(i => parents.has(i) && !world.water[i] && !world.buildings[i] && !reserved(world, i))
  if (s.activity === 'developmentward' || s.activity === 'cycling') {
    const target = world.developmentLife?.target
    if (target === null || target === undefined || !parents.has(target)) { if (world.developmentLife) { world.developmentLife.task = null; world.developmentLife.target = null; world.developmentLife.plant = null } activity(world, 'homeward'); plan(world); return }
    s.destination = target
  } else if (s.activity === 'treasureward' || s.activity === 'treasureHomeward' || s.activity === 'flightward') {
    const target = s.activity === 'treasureward' ? world.leisure?.pending?.tile ?? null : leisureSpot(world, s.activity === 'flightward' ? 'flightpad' : 'treasure')
    if (target === null || !parents.has(target)) { if (world.leisure) world.leisure.pending = null; activity(world, 'homeward'); plan(world); return }
    s.destination = target
  } else if (s.activity === 'coverward' || s.activity === 'uncoverward') {
    const spot = coverSpot(world)
    if (spot === null) { if (world.poultry) delete world.poultry.cover; activity(world, 'homeward'); plan(world); return }
    s.destination = spot
  } else if (s.activity === 'pressward') {
    if (!pressReady(world) || pressSpot(world) !== s.destination) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'experimentward') {
    if (experimentSpot(world) !== s.destination) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'workshopward') {
    if (workshopSpot(world) !== s.destination) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'gardenward') {
    if (gardenSpot(world) !== s.destination) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'campfireward') {
    if (reachableCampfire(world) !== s.destination) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'eggward') {
    if (!eggAt(world, s.destination) || !parents.has(s.destination!)) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'crateward') {
    if (!crateAtSpot(world, s.destination) || !parents.has(s.destination!)) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'dockward') {
    if (!dockAtSpot(world, s.destination) || !parents.has(s.destination!)) { activity(world, 'homeward'); plan(world); return }
  } else if (s.activity === 'homeward') {
    const candidates = entrances.length ? entrances : local.length ? local : [p.tile]
    s.destination = candidates.sort((a, b) => (tilePath(parents, a)?.length ?? Infinity) - (tilePath(parents, b)?.length ?? Infinity) || a - b)[0]
  } else s.destination = local.length ? local[Math.floor(random(world) * local.length)] : p.tile
  p.path = tilePath(parents, s.destination!) ?? []
  p.pathRevision = world.topologyRevision
}
function move(world: World, delta: number): void {
  const p = world.pete
  let remaining = delta
  while (remaining > 1e-8) {
    if (p.next === null) {
      if (p.pathRevision !== world.topologyRevision || world.peace.destination === null) plan(world)
      p.next = p.path.shift() ?? null
      if (p.next === null) {
        const leisure = beginDevelopmentWork(world) ?? beginLeisureWork(world)
        if (leisure) activity(world, leisure.activity, leisure.duration, leisure.activity === 'flying' ? null : world.peace.destination)
        else if (world.peace.activity === 'coverward' || world.peace.activity === 'uncoverward') activity(world, world.peace.activity === 'coverward' ? 'covering' : 'uncovering', COVER_MS, world.peace.destination)
        else if (world.peace.activity === 'pressward') activity(world, 'pressing', PRESS_ACTIVITY_MS, world.peace.destination)
        else if (world.peace.activity === 'experimentward') activity(world, 'experimenting', EXPERIMENT_ACTIVITY_MS, world.peace.destination)
        else if (world.peace.activity === 'workshopward') activity(world, 'hammering', WORKSHOP_ACTIVITY_MS, world.peace.destination)
        else if (world.peace.activity === 'gardenward') activity(world, 'gardening', TEND_MS, world.peace.destination)
        else if (world.peace.activity === 'campfireward') activity(world, 'cooking', COOKING_MS, world.peace.destination)
        else if (world.peace.activity === 'eggward') activity(world, 'collectingEgg', EGG_COLLECT_MS, world.peace.destination)
        else if (world.peace.activity === 'crateward') activity(world, 'checkingCrate', SUPPLY_INSPECTION_MS, world.peace.destination)
        else if (world.peace.activity === 'dockward') {
          const dock = dockAtSpot(world, world.peace.destination), boat = dock ? planRowboat(world, dock) : null
          if (boat && random(world) < 1 / 3) { world.peace.boat = boat; activity(world, 'boating', BOARDING_MS, world.peace.destination) }
          else activity(world, 'fishing', FISHING_MS, world.peace.destination)
        }
        else if (world.peace.activity === 'homeward') {
          if (world.miniFactory && world.buildings[world.peace.home!]?.kind !== 'treehouse') { activity(world, 'walking'); nextActivity(world) }
          else if (neighboringTiles(world.peace.home!).includes(p.tile)) {
            const flock = world.poultry, spot = flock ? coverSpot(world) : null
            if (flock && !flock.cover && spot !== null) {
              flock.cover = { stage: random(world) < .4 ? 'covering' : 'skipped', atMs: world.timeMs }
              if (flock.cover.stage === 'covering') activity(world, 'coverward', 0, spot)
              else activity(world, 'entering', 3000)
            } else activity(world, 'entering', 3000)
          }
          else activity(world, 'waving', 4000) // Enclosed home: wait, then retry after obstacles change.
        } else activity(world, random(world) < .5 ? 'flowers' : 'waving', 5000)
        return
      }
    }
    if (!preparePeteGate(world, p.next)) return
    const travel = world.peace.activity === 'cycling' ? 400 : PETE_WALK_MS
    const spent = Math.min(travel - p.travelMs, remaining)
    p.travelMs += spent; remaining -= spent
    const t = p.travelMs / travel
    p.x = p.tile % SIZE + (p.next % SIZE - p.tile % SIZE) * t
    p.y = Math.floor(p.tile / SIZE) + (Math.floor(p.next / SIZE) - Math.floor(p.tile / SIZE)) * t
    if (p.travelMs >= travel - 1e-8) { p.tile = p.next; p.next = null; p.travelMs = 0 }
  }
}
function spawnGift(world: World): void {
  const s = world.peace
  if (s.gifts.length >= (world.homestead ? 2 : MAX_GIFTS) || s.nextId === Number.MAX_SAFE_INTEGER) return
  const tiles = localTiles(world, reachableTiles(world, world.pete.tile)).filter(i => i !== world.pete.tile && i !== world.pete.next && !s.gifts.some(g => g.tile === i))
  if (!tiles.length) return
  const tile = tiles[Math.floor(random(world) * tiles.length)], flowers = random(world) < 1 / 3
  s.gifts.push({ id: s.nextId++, tile, kind: flowers ? 'flowers' : 'wood', wood: flowers ? 0 : 1 + Math.floor(random(world) * 2), atMs: world.timeMs })
}
export function collectGift(world: World, tile: number): string | null {
  if (!peaceful(world) || world.buildings[tile]) return null
  const s = world.peace, gift = s.gifts.find(g => g.tile === tile)
  if (!gift || !Number.isSafeInteger(world.nature.wood + gift.wood)) return null
  s.gifts = s.gifts.filter(g => g.id !== gift.id)
  if (gift.kind === 'wood') { world.nature.wood += gift.wood; return `Thanks, Pete! +${gift.wood} Wood` }
  world.nature.decorations[tile] = 'flowers'; world.nature.decorationRevision++
  return 'A bouquet from Pete! Flowers planted with love.'
}
export function refreshFishing(world: World, previousDock?: FishingDock | null): void {
  if (!['dockward', 'fishing', 'boating'].includes(world.peace.activity)) return
  const dock = dockAtSpot(world, world.peace.destination)
  if (dock && (!previousDock || previousDock === dock) && (!world.peace.boat || rowboatValid(world, world.peace.boat, dock))) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE) })
  delete world.peace.boat
  activity(world, 'homeward')
}
export function refreshSupplyVisit(world: World): void {
  if (!['crateward', 'checkingCrate'].includes(world.peace.activity) || crateAtSpot(world, world.peace.destination)) return
  const p = world.pete
  Object.assign(p, { next: null, travelMs: 0, x: p.tile % SIZE, y: Math.floor(p.tile / SIZE) })
  activity(world, 'homeward')
}
function tryConstruction(world: World): boolean {
  if (world.timeMs < world.peace.nextProjectCheckAtMs) return false
  world.peace.nextProjectCheckAtMs = world.timeMs + PROJECT_CHECK_MS
  return trySecretProject(world)
}
// Only enter at an unpaid boundary. Committed cargo and construction finish first.
function homesteadDaily(world: World): boolean {
  const h = world.homestead
  if (!h || world.developmentLife?.carriedFruit || world.developmentLife?.carriedWood || world.developmentLife?.carriedSapling || world.leisure?.carried) return false
  if (world.timeMs >= h.nextRestAtMs && world.buildings[world.peace.home!]?.kind === 'treehouse') { activity(world, 'homeward'); return true }
  const egg = reachableEgg(world)
  if (egg !== null && world.timeMs - eggAt(world, egg)!.laidAtMs >= 180000) { activity(world, 'eggward', 0, egg); return true }
  const fire = world.poultry && world.poultry.collected - world.poultry.eaten >= 4 ? reachableCampfire(world) : null
  if (fire !== null) { activity(world, 'campfireward', 0, fire); return true }
  return false
}
function nextActivity(world: World): void {
  if (world.developmentLife?.carriedFruit || world.developmentLife?.carriedWood || world.developmentLife?.carriedSapling) { const visit = developmentDecision(world); if (visit) { activity(world, visit.activity, 0, visit.destination); return } }
  if (world.leisure?.carried) { const visit = leisureDecision(world); if (visit) { activity(world, visit.activity, 0, visit.destination); return } }
  const committed = currentProject(world)
  if (world.homestead && !world.yard && world.gardenProject?.phase === 'complete' && world.campfireProject?.phase === 'complete') {
    const yard = planYard(world)
    if (yard && !projectPlansConflict(world, yard)) world.yard = yard
  }
  if (!committed?.carried && committed?.phase !== 'building' && homesteadDaily(world)) return
  if (world.homestead && random(world) < .5 && advanceHomestead(world, 0, true)) return
  if (world.homestead && tryConstruction(world)) return
  if (world.developmentLife && committed?.phase !== 'building' && !committed?.carried) {
    const overdue = developmentDecision(world, true)
    if (overdue) { activity(world, overdue.activity, 0, overdue.destination); return }
  }
  if (!world.homestead && tryConstruction(world)) return
  const practice = world.homestead && world.personality.paths.craftsman.level >= 3 && world.workshopProject && world.timeMs >= (world.workshopProject.readyAtMs ?? 0) ? workshopSpot(world) : null
  if (practice !== null) { activity(world, 'workshopward', 0, practice); return }
  if (world.homestead && advanceHomestead(world, 0, true)) return
  const development = (world.orchardProject || world.bicycleProject || world.mechanicProject || world.nurseryProject || world.winchProject || world.houseProject) && random(world) < .4 ? developmentDecision(world) : null
  if (development) { activity(world, development.activity, 0, development.destination); return }
  const leisure = leisureDecision(world)
  if (leisure) { activity(world, leisure.activity, 0, leisure.destination); return }
  if (random(world) < (world.homestead ? .03 : .2)) { activity(world, 'homeward'); return }
  const press = pressReady(world) ? pressSpot(world) : null
  if (press !== null && random(world) < .25) { activity(world, 'pressward', 0, press); return }
  const experiment = experimentSpot(world)
  if (experiment !== null && world.timeMs >= world.experimentProject!.readyAtMs! && random(world) < .25) { activity(world, 'experimentward', 0, experiment); return }
  const workshop = workshopSpot(world)
  if (workshop !== null && world.timeMs >= world.workshopProject!.readyAtMs! && random(world) < .25) { activity(world, 'workshopward', 0, workshop); return }
  const garden = gardenSpot(world)
  if (garden !== null && world.timeMs >= (world.gardenProject?.readyAtMs ?? 0) && random(world) < .25) { world.gardenProject!.readyAtMs = world.timeMs + TEND_COOLDOWN_MS; activity(world, 'gardenward', 0, garden); return }
  const fire = reachableCampfire(world)
  if (fire !== null && random(world) < 1 / 3) { activity(world, 'campfireward', 0, fire); return }
  const egg = reachableEgg(world)
  if (egg !== null && random(world) < .5) { activity(world, 'eggward', 0, egg); return }
  const p = world.pete
  const spot = p.mode === 'WANDERING' && !world.police.car && !world.revenge.boss ? reachableFishingSpot(world) : null
  if (spot !== null && random(world) < .5) activity(world, 'dockward', 0, spot)
  else {
    const crate = p.mode === 'WANDERING' && !world.police.car && !world.revenge.boss ? reachableCrateSpot(world) : null
    if (crate !== null && random(world) < 1 / 3) activity(world, 'crateward', 0, crate)
    else activity(world, 'walking')
  }
}
export function advancePeace(world: World, delta: number): void {
  if (world.rebuilding && peaceful(world) && world.timeMs >= world.peace.nextGiftAtMs) {
    if (world.buildings[world.peace.home!]?.kind === 'treehouse') spawnGift(world)
    scheduleGift(world)
  }
  if (world.miniFactory) {
    world.homestead ??= createHomestead()
    if (world.miniFactory.anchor !== null && world.miniFactory.built < 11) { advanceMiniFactory(world, delta); return }
    if (advanceRebuilding(world, delta)) return
    if (advanceHomestead(world, delta)) return
  }
  const s = world.peace, p = world.pete
  if (s.shutdown && world.timeMs - s.shutdown.atMs >= 6000) s.shutdown = null
  if (s.reactionAtMs !== null && world.timeMs - s.reactionAtMs >= 4000) s.reactionAtMs = null
  if (!peaceful(world)) return
  refreshDevelopment(world)
  refreshLeisure(world)
  refreshFishing(world)
  refreshGardening(world)
  refreshWorkshop(world)
  refreshExperiment(world)
  refreshPress(world)
  refreshSupplyVisit(world)
  refreshPoultry(world)
  refreshCooking(world)
  if (world.timeMs >= s.nextGiftAtMs) { spawnGift(world); scheduleGift(world) }
  if (s.activity === 'project') {
    const project = currentProject(world)
    if (world.homestead && project?.phase === 'collecting' && !project.carried && p.next === null && homesteadDaily(world)) { delete project.selected; return }
    if (world.homestead && project?.phase === 'collecting' && !project.carried && p.next === null && world.timeMs - s.sinceMs >= 30000) {
      delete project.selected
      activity(world, 'walking')
      nextActivity(world)
      return
    }
    advanceSecretProject(world, delta)
    if (project?.phase === 'complete') { s.nextProjectCheckAtMs = world.timeMs; nextActivity(world) }
    return
  }
  if (['coverward', 'covering', 'uncoverward', 'uncovering'].includes(s.activity) && coverSpot(world) === null) { if (world.poultry) delete world.poultry.cover; activity(world, 'homeward'); return }
  if (world.poultry?.cover?.stage === 'skipped' && !['homeward', 'entering', 'resting', 'verandaRest'].includes(s.activity)) delete world.poultry.cover
  // Only pre-empt cosmetic work at a stationary tile; committed activities finish normally.
  const interruptible = world.homestead ? ['walking', 'waving', 'flowers'] : ['homeward', 'walking', 'resting', 'verandaRest', 'waving', 'flowers']
  if (world.poultry?.cover?.stage !== 'covered' && p.next === null && interruptible.includes(s.activity) && tryConstruction(world)) return
  if (s.activity === 'boating' && s.boat) {
    const boat = s.boat
    if (boat.phase === 'rowing') {
      if (moveRowboat(boat, delta)) { boat.phase = 'landing'; activity(world, 'boating', BOARDING_MS, s.destination) }
    } else if (world.timeMs >= s.untilMs) {
      if (boat.phase === 'boarding') { boat.phase = 'rowing'; activity(world, 'boating', 0, s.destination) }
      else { delete s.boat; nextActivity(world) }
    }
  } else if (s.activity === 'developmentward' || s.activity === 'cycling' || s.activity === 'homeward' || s.activity === 'walking' || s.activity === 'dockward' || s.activity === 'crateward' || s.activity === 'eggward' || s.activity === 'campfireward' || s.activity === 'gardenward' || s.activity === 'workshopward' || s.activity === 'experimentward' || s.activity === 'pressward' || s.activity === 'coverward' || s.activity === 'uncoverward' || s.activity === 'treasureward' || s.activity === 'treasureHomeward' || s.activity === 'flightward') {
    if (p.next !== null && (!walkableTile(world, p.next))) { p.next = null; p.travelMs = 0; p.x = p.tile % SIZE; p.y = Math.floor(p.tile / SIZE); p.pathRevision = -1 }
    move(world, delta)
  } else if (world.timeMs >= s.untilMs) {
    if (s.activity === 'developmentWork' || s.activity === 'dismounting') {
      if (!finishDevelopment(world)) nextActivity(world)
    } else if (['pickingTreasure', 'storingTreasure', 'flying', 'crashRest'].includes(s.activity)) {
      const next = finishLeisure(world)
      if (next) activity(world, next.activity, next.duration, next.destination)
      else nextActivity(world)
    } else if (s.activity === 'covering') {
      if (world.poultry?.cover) { world.poultry.cover.stage = 'covered'; world.poultry.cover.atMs = world.timeMs }
      activity(world, 'homeward')
    } else if (s.activity === 'uncovering') {
      if (world.poultry) delete world.poultry.cover
      nextActivity(world)
    } else if (s.activity === 'pressing') { finishPress(world); nextActivity(world) }
    else if (s.activity === 'experimenting') { finishExperiment(world); nextActivity(world) }
    else if (s.activity === 'hammering') { finishWorkshop(world); nextActivity(world) }
    else if (s.activity === 'cooking') { if (finishCooking(world)) activity(world, 'campfireHappy', CAMPFIRE_HAPPY_MS); else activity(world, 'homeward') }
    else if (s.activity === 'collectingEgg') { collectEgg(world); nextActivity(world) }
    else if (s.activity === 'entering') {
      if (world.homestead) world.homestead.nextRestAtMs = world.timeMs + HOMESTEAD_REST_INTERVAL_MS
      activity(world, hasVeranda(world) && random(world) < .25 ? 'verandaRest' : 'resting', VERANDA_REST_MS)
    }
    else if (s.activity === 'resting' || s.activity === 'verandaRest') {
      const spot = world.poultry?.cover?.stage === 'covered' ? coverSpot(world) : null
      if (spot !== null && world.poultry?.cover) { world.poultry.cover.stage = 'uncovering'; world.poultry.cover.atMs = world.timeMs; activity(world, 'uncoverward', 0, spot) }
      else { if (world.poultry) delete world.poultry.cover; nextActivity(world) }
    }
    else nextActivity(world)
  }
}
