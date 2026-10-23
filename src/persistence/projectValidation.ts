import { TEND_COOLDOWN_MS } from '../simulation/ecoProjects'
import { PETE_PROJECTS } from '../simulation/projectRegistry'
import { CAMPFIRE_BUILD_MS, CAMPFIRE_WOOD, COOP_BUILD_MS, COOP_WOOD, currentProject, FENCE_SEGMENT_MS, PROJECT_WOOD } from '../simulation/secretProject'
import type { SecretProject } from '../simulation/secretProject'
import { neighboringTiles } from '../simulation/navigation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreProject(value: unknown, world: World, kind?: 'coop' | 'campfire' | 'garden', version = 23): SecretProject | null {
  const coop = kind !== undefined, fire = kind === 'campfire', garden = kind === 'garden'
  const buildingKind = garden ? 'peteGarden' : fire ? 'peteCampfire' : coop ? 'peteCoop' : 'peteFence', parts = coop ? 1 : 3, wood = garden ? 12 : fire ? CAMPFIRE_WOOD : coop ? COOP_WOOD : PROJECT_WOOD, duration = garden ? 12000 : fire ? CAMPFIRE_BUILD_MS : coop ? COOP_BUILD_MS : FENCE_SEGMENT_MS
  if (value === undefined) {
    if (world.buildings.some(b => b?.kind === buildingKind)) v.invalid('project', 'missing project state')
    return null
  }
  const r = v.object(value, fire ? 'game.campfireProject' : coop ? 'game.coopProject' : 'game.project', ['home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs', ...(coop ? ['kind'] : [])], version >= 22 ? ['selected', ...(garden ? ['readyAtMs'] : [])] : [])
  if (coop && (r.kind !== kind || (!garden && (fire && version < 22 ? world.coopProject : world.project)?.phase !== 'complete'))) v.invalid(fire ? 'campfireProject' : 'coopProject', 'missing completed prerequisite project')
  const home = v.tile(r.home, 'project.home'), direction = v.choice(r.direction, 'project.direction', ['east', 'south'] as const)
  const tiles = v.array(r.tiles, 'project.tiles', parts).map((n, i) => v.tile(n, `project.tiles[${i}]`))
  const spots = v.array(r.spots, 'project.spots', parts).map((n, i) => v.tile(n, `project.spots[${i}]`))
  const cx = tiles[coop ? 0 : 1] % SIZE, cy = Math.floor(tiles[coop ? 0 : 1] / SIZE), hx = home % SIZE, hy = Math.floor(home / SIZE)
  const dx = Math.sign(cx - hx), dy = Math.sign(cy - hy), step = direction === 'east' ? 1 : SIZE
  if ((direction === 'east' ? cx !== hx || (garden ? Math.abs(cy - hy) < 2 || Math.abs(cy - hy) > 5 : Math.abs(cy - hy) !== 3) : cy !== hy || (garden ? Math.abs(cx - hx) < 2 || Math.abs(cx - hx) > 5 : Math.abs(cx - hx) !== 3)) || tiles.some((n, i) => n !== tiles[coop ? 0 : 1] + (i - (parts - 1) / 2) * step || !neighboringTiles(n).includes(spots[i]) || spots[i] !== n - dy * SIZE - dx) || new Set(tiles).size !== parts || (direction === 'east' && tiles.some(n => Math.floor(n / SIZE) !== cy))) v.invalid('project.tiles', 'invalid compact project geometry')
  const phase = v.choice(r.phase, 'project.phase', ['collecting', 'building', 'complete'] as const)
  const built = v.count(r.built, 'project.built', parts), carried = v.count(r.carried, 'project.carried', wood)
  const elapsedMs = v.count(r.elapsedMs, 'project.elapsedMs', duration - 50), crate = r.crate === null ? null : v.tile(r.crate, 'project.crate')
  if (elapsedMs % 50 || (phase === 'collecting' ? built !== 0 || carried !== 0 || elapsedMs !== 0 : phase === 'complete' ? built !== parts || carried !== 0 || elapsedMs !== 0 || crate !== null : built >= parts || carried !== wood - built * wood / parts || crate !== null)) v.invalid('project', 'invalid resource accounting or progress')
  if (crate !== null && world.buildings[crate]?.kind !== 'supplyCrate') v.invalid('project.crate', 'missing supply crate')
  for (let i = 0; i < world.buildings.length; i++) {
    const b = world.buildings[i]
    if (coop && b?.kind === buildingKind && (!tiles.slice(0, built).includes(i) || (b.kind === 'peteFence' && b.direction !== direction))) v.invalid('project', 'structure disagrees with completed work')
  }
  return { ...(garden ? restoreEcoDeadline(r, world, TEND_COOLDOWN_MS) : {}), ...restoreProjectSelection(r), ...(coop ? { kind } : {}), home, direction, tiles, spots, phase, crate, built, carried, elapsedMs }
}

export function validateProjectActivity(world: World): void {
  if (world.peace.activity !== 'project') return
  const project = currentProject(world), destination = world.peace.destination
  if (!project || project.phase === 'complete' || world.peace.home === null || (destination !== null && (project.phase === 'collecting' ? project.crate === null || !neighboringTiles(project.crate).includes(destination) : destination !== project.spots[project.built]))) v.invalid('project', 'activity and destination disagree')
}

export function restoreProjectSelection(record: Record<string, unknown>): { selected?: true } {
  if (record.selected === undefined) return {}
  if (record.selected !== true || record.phase === 'complete') v.invalid('project.selected', 'only an unfinished project can be selected')
  return { selected: true }
}
export function restoreActiveProject(world: World, version: number): void {
  if (version < 22) {
    // Preserve the old priority exactly, without a fresh random draw or resource debit.
    const legacy = world.project?.phase !== 'complete' ? world.project : world.coopProject?.phase === 'complete' && world.yard && world.yard.phase !== 'complete' ? world.yard : world.gateProject && world.gateProject.phase !== 'complete' ? world.gateProject : world.coopProject?.phase === 'complete' ? world.campfireProject : world.coopProject
    if (legacy && legacy.phase !== 'complete') legacy.selected = true
  }
  if (PETE_PROJECTS.filter(p => world[p.state]?.selected).length > 1) v.invalid('project.selected', 'multiple selected projects')
}

export function restoreEcoDeadline(r: Record<string, unknown>, world: World, cooldown: number): { readyAtMs?: number } {
  if (r.phase !== 'complete') {
    if (r.readyAtMs !== undefined) v.invalid('eco.readyAtMs', 'unfinished activity has a cooldown')
    return {}
  }
  const readyAtMs = v.count(r.readyAtMs, 'eco.readyAtMs', world.timeMs + cooldown)
  if (readyAtMs % 50) v.invalid('eco.readyAtMs', 'expected fixed-step deadline')
  return { readyAtMs }
}
