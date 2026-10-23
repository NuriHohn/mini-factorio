import { DEVELOPMENT_KINDS, TASKS, createDevelopmentLife, developmentBuilding, developmentDuration, developmentTargetValid } from '../simulation/peteDevelopments'
import type { DevelopmentKind, DevelopmentLife } from '../simulation/peteDevelopments'
import { PETE_PROJECTS, projectUnlocked } from '../simulation/projectRegistry'
import { projectBuildMs, projectResources } from '../simulation/secretProject'
import type { SecretProject } from '../simulation/secretProject'
import { neighboringTiles } from '../simulation/navigation'
import { PROJECT_REWARDS } from '../simulation/personality'
import { restoreProjectSelection } from './projectValidation'
import { SIZE } from '../simulation/world'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restoreDevelopmentProject(value: unknown, world: World, kind: DevelopmentKind): SecretProject {
  const r = v.object(value, kind, ['kind', 'home', 'direction', 'tiles', 'spots', 'phase', 'crate', 'built', 'carried', 'elapsedMs', 'carriedIron', 'carriedGears', 'carriedModules'], ['selected'])
  if (r.kind !== kind) v.invalid(kind, 'wrong project kind')
  const p: SecretProject = { kind, ...restoreProjectSelection(r), home: v.tile(r.home, kind), direction: v.choice(r.direction, kind, ['east', 'south'] as const), tiles: v.array(r.tiles, kind, 1).map(i => v.tile(i, kind)), spots: v.array(r.spots, kind, 1).map(i => v.tile(i, kind)), phase: v.choice(r.phase, kind, ['collecting', 'building', 'complete'] as const), crate: r.crate === null ? null : v.tile(r.crate, kind), built: v.count(r.built, kind, 1), carried: v.count(r.carried, kind), elapsedMs: v.count(r.elapsedMs, kind, 23950) }
  const distance = Math.abs(p.home % SIZE - p.tiles[0] % SIZE) + Math.abs(Math.floor(p.home / SIZE) - Math.floor(p.tiles[0] / SIZE))
  if (distance < 2 || distance > 6 || (p.home % SIZE !== p.tiles[0] % SIZE && Math.floor(p.home / SIZE) !== Math.floor(p.tiles[0] / SIZE)) || !neighboringTiles(p.tiles[0]).includes(p.spots[0]) || p.elapsedMs % 50 || p.elapsedMs >= projectBuildMs(p) || (p.phase === 'complete' ? p.built !== 1 || p.elapsedMs !== 0 || p.crate !== null : p.built !== 0) || (p.phase === 'collecting' && p.elapsedMs !== 0) || (p.phase === 'building' && p.crate !== null) || (p.crate !== null && world.buildings[p.crate]?.kind !== 'supplyCrate')) v.invalid(kind, 'invalid project geometry, phase or source')
  const costs = projectResources(p), paid = p.phase === 'building'
  p.carriedIron = v.count(r.carriedIron, kind); p.carriedGears = v.count(r.carriedGears, kind); p.carriedModules = v.count(r.carriedModules, kind)
  if (p.carried !== (paid ? costs.wood ?? 0 : 0) || p.carriedIron !== (paid ? costs.ironPlate ?? 0 : 0) || p.carriedGears !== (paid ? costs.ironGear ?? 0 : 0) || p.carriedModules !== (paid ? costs.mechanicModule ?? 0 : 0)) v.invalid(kind, 'paid material accounting disagrees')
  return p
}
export function restoreDevelopmentLife(value: unknown, world: World): DevelopmentLife {
  const r = v.object(value, 'developmentLife', ['seed', 'task', 'target', 'plant', 'carriedFruit', 'fruit', 'carriedWood', 'carriedSapling', 'saplings', 'nextAt', 'ecoXp', 'craftsmanXp', 'industrialXp'])
  const state = createDevelopmentLife(), deadlines = v.object(r.nextAt, 'developmentLife.nextAt', TASKS)
  state.seed = v.count(r.seed, 'developmentLife.seed', 0xffffffff)
  state.task = r.task === null ? null : v.choice(r.task, 'developmentLife.task', TASKS)
  state.target = r.target === null ? null : v.tile(r.target, 'developmentLife.target')
  state.plant = r.plant === null ? null : v.tile(r.plant, 'developmentLife.plant')
  state.carriedFruit = v.count(r.carriedFruit, 'developmentLife.carriedFruit', 2)
  state.fruit = v.count(r.fruit, 'developmentLife.fruit', 12)
  state.carriedWood = v.count(r.carriedWood, 'developmentLife.carriedWood', 2)
  state.carriedSapling = v.count(r.carriedSapling, 'developmentLife.carriedSapling', 1)
  state.saplings = v.count(r.saplings, 'developmentLife.saplings', 3)
  if (![0, 2].includes(state.carriedFruit) || ![0, 2].includes(state.carriedWood) || (Number(!!state.carriedFruit) + Number(!!state.carriedWood) + state.carriedSapling > 1) || (state.plant !== null) !== (state.task === 'plantSapling')) v.invalid('developmentLife', 'invalid carried payload or planting task')
  for (const task of TASKS) { const n = v.count(deadlines[task], task, world.timeMs + 60000); if (n % 50) v.invalid(task, 'deadline is off fixed-step clock'); state.nextAt[task] = n }
  for (const path of ['eco', 'craftsman', 'industrial'] as const) state[`${path}Xp`] = v.count(r[`${path}Xp`], path)
  return state
}
export function validateDevelopment(world: World): void {
  for (const kind of DEVELOPMENT_KINDS) {
    const project = world[`${kind}Project`], definition = PETE_PROJECTS.find(d => d.id === kind)!
    if (project && !projectUnlocked({ ...world, [`${kind}Project`]: undefined }, definition)) v.invalid(kind, 'locked level or prerequisites')
    if (world.buildings.some((b, i) => b?.kind === 'peteDevelopment' && b.development === kind && (project?.phase !== 'complete' || project.tiles[0] !== i))) v.invalid(kind, 'structure without owned completed project')
  }
  const state = world.developmentLife, active = ['developmentward', 'developmentWork', 'cycling', 'dismounting'].includes(world.peace.activity)
  if (!state) { if (active) v.invalid('developmentLife', 'missing activity state'); return }
  if (!!state.task !== active || (state.task === null) !== (state.target === null)) v.invalid('developmentLife', 'task and activity disagree')
  if ((state.carriedFruit || state.fruit) && world.orchardProject?.phase !== 'complete') v.invalid('developmentLife', 'fruit without orchard')
  if ((state.carriedWood || state.carriedSapling || state.saplings) && world.nurseryProject?.phase !== 'complete') v.invalid('developmentLife', 'seedlings without nursery')
  if (active && !developmentTargetValid(world)) v.invalid('developmentLife', 'invalid active task target or stock')
  if (active && world.peace.destination !== state.target) v.invalid('developmentLife', 'destination disagrees')
  if (world.peace.activity === 'developmentWork' && (world.pete.tile !== state.target || world.peace.untilMs - world.peace.sinceMs !== developmentDuration(state.task!))) v.invalid('developmentLife', 'work is away from target or has wrong duration')
  if (['cycling', 'dismounting'].includes(world.peace.activity) && (state.task !== 'cycle' || !developmentBuilding(world, 'bicycle'))) v.invalid('developmentLife', 'bicycle required')
  if (world.peace.activity === 'cycling' && (world.pete.travelMs >= 400 || world.pete.path.length > 12)) v.invalid('cycling', 'invalid route progress')
  for (const path of ['eco', 'craftsman', 'industrial'] as const) {
    const projects = world.personality.rewardedProjects.reduce((n, id) => n + (PROJECT_REWARDS[id].path === path ? PROJECT_REWARDS[id].xp : 0), 0)
    if (world.personality.paths[path].xp < projects + state[`${path}Xp`]) v.invalid(path, 'missing development XP')
  }
}
export function normalizeLegacyModules(value: unknown, depth = 0): void {
  if (depth > 64) v.invalid('game', 'save nesting exceeds limit')
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value)) {
    const r = value as Record<string, unknown>
    if (r.item === 'mechanicModule' || r.primaryMaterial === 'mechanicModule') v.invalid('game', 'legacy save contains a new item')
    const old = ['iron', 'copper', 'ironPlate', 'copperPlate', 'ironGear', 'copperCable', 'electronicCircuit']
    if (old.every(k => Object.hasOwn(r, k))) { if (r.mechanicModule !== undefined && r.mechanicModule !== 0) v.invalid('game', 'legacy modules must be empty'); r.mechanicModule = 0 }
  }
  for (const child of Object.values(value)) normalizeLegacyModules(child, depth + 1)
}
