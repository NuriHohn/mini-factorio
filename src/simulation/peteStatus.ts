import { ITEM_DEFINITIONS } from './items'
import { neighboringTiles, peteReachableTiles } from './navigation'
import { PATH_LABELS } from './personality'
import type { Personality } from './personality'
import { PETE_PROJECTS } from './projectRegistry'
import type { ProjectMaterial } from './projectRegistry'
import { currentProject, projectCandidates, projectPlansConflict, projectSiteClear } from './secretProject'
import type { SupplyCrate, World } from './world'
export const PROJECT_NAMES: Record<string, string> = { fence: 'Fence', coop: 'Chicken coop', campfire: 'Campfire', yard: 'Enclosed yard', gate: 'Garden gate', garden: 'Vegetable garden', reforestation: 'Tree planting', workshop: 'Workshop', veranda: 'Treehouse veranda', experiment: 'Experiment table', press: 'Recycling press' }
const ACTIVITY_NAMES: Record<World['peace']['activity'], string> = { homeward: 'Going home', entering: 'Heading inside', resting: 'Sleeping', walking: 'Taking a walk', waving: 'Waving', flowers: 'Enjoying flowers', dockward: 'Walking to the dock', fishing: 'Fishing', boating: 'Taking a boat trip', crateward: 'Walking to the supply crate', checkingCrate: 'Checking supplies', project: 'Working on a project', eggward: 'Going to collect an egg', collectingEgg: 'Collecting an egg', campfireward: 'Walking to the campfire', cooking: 'Cooking eggs', campfireHappy: 'Enjoying a meal', gardenward: 'Walking to the garden', gardening: 'Watering the garden', workshopward: 'Walking to the workshop', hammering: 'Working at the anvil', verandaRest: 'Resting on the veranda', experimentward: 'Walking to the experiment table', experimenting: 'Trying an experiment', pressward: 'Walking to the recycling press', pressing: 'Recycling a gear' }
export interface ProjectStatus { id: string; name: string; reason: string; ready: boolean }
export interface PeteStatus { activity: string; current: string | null; wish: ProjectStatus | null; projects: ProjectStatus[]; personality: Personality }
export function peteStatus(world: World): PeteStatus {
  const active = currentProject(world), candidates = projectCandidates(world)
  const parents = peteReachableTiles(world, world.pete.tile)
  const crates = world.buildings.flatMap((b, tile) => b?.kind === 'supplyCrate' ? [{ crate: b, reachable: neighboringTiles(tile).some(i => parents.has(i) && !world.water[i] && !world.buildings[i] && !world.buildings.some(p => p?.kind === 'prison' && p.exit === i)) }] : [])
  const quantity = (crate: SupplyCrate, item: ProjectMaterial) => item === 'wood' ? crate.wood : crate.inventory[item]
  const projects = PETE_PROJECTS.flatMap(definition => {
    const saved = world[definition.state], name = PROJECT_NAMES[definition.id]
    if (!definition.repeatable && saved?.phase === 'complete') return []
    let reason: string
    const candidate = candidates.find(c => c.definition.id === definition.id)
    if (world.peace.home === null) reason = 'I need a treehouse before I can work on projects.'
    else if (world.police.car || world.revenge.boss || world.pete.mode !== 'WANDERING') reason = 'I cannot work on projects during this interruption.'
    else if (world.personality.paths[definition.path].level < definition.minimumLevel) reason = `I need ${PATH_LABELS[definition.path]} level ${definition.minimumLevel}.`
    else if (definition.prerequisites.some(id => world[PETE_PROJECTS.find(p => p.id === id)!.state]?.phase !== 'complete')) reason = `First I need: ${definition.prerequisites.filter(id => world[PETE_PROJECTS.find(p => p.id === id)!.state]?.phase !== 'complete').map(id => PROJECT_NAMES[id]).join(', ')}.`
    else if (definition.repeatable && (saved?.readyAtMs ?? 0) > world.timeMs) reason = `I can do this again in ${Math.ceil((saved!.readyAtMs! - world.timeMs) / 1000)} seconds.`
    else if (saved?.phase === 'building') reason = projectSiteClear(world, saved) && !projectPlansConflict(world, saved) ? 'Materials already collected. I can continue this work.' : 'Materials already collected, but my work site or approach is blocked.'
    else if (candidate) reason = 'Materials and a safe work site are available.'
    else {
      const costs = Object.entries(definition.resources) as [ProjectMaterial, number][]
      const funded = (crate: SupplyCrate) => costs.every(([item, amount]) => quantity(crate, item) >= amount)
      const reachable = crates.filter(c => c.reachable)
      if (reachable.some(c => funded(c.crate))) reason = 'I need free space and a reachable, safe work site near home.'
      else if (crates.some(c => funded(c.crate))) reason = 'The materials are here, but I cannot reach their supply crate.'
      else {
        const best = [...reachable].sort((a, b) => costs.reduce((n, [item, amount]) => n + Math.min(quantity(b.crate, item), amount) / amount - Math.min(quantity(a.crate, item), amount) / amount, 0))[0]?.crate
        const missing = costs.flatMap(([item, amount]) => {
          const count = amount - (best ? Math.min(amount, quantity(best, item)) : 0)
          return count ? [`${count} ${item === 'wood' ? 'Wood' : ITEM_DEFINITIONS[item].label}`] : []
        })
        reason = `I need ${missing.join(', ')} in one reachable supply crate.`
      }
    }
    return [{ id: definition.id, name, reason, ready: !!candidate }]
  })
  const wishes = [...projects].sort((a, b) => Number(b.ready) - Number(a.ready) || Number(PETE_PROJECTS.find(p => p.id === b.id)!.path === world.personality.dominant) - Number(PETE_PROJECTS.find(p => p.id === a.id)!.path === world.personality.dominant))
  const selected = active ? PETE_PROJECTS.find(p => world[p.state] === active) : undefined
  const activity = world.peace.home === null ? world.pete.mode.toLowerCase().replaceAll('_', ' ') : world.peace.activity === 'project' && active ? active.phase === 'collecting' ? 'Collecting project materials' : 'Building my project' : ACTIVITY_NAMES[world.peace.activity]
  return { activity, current: selected ? PROJECT_NAMES[selected.id] : null, wish: wishes.find(p => p.id !== selected?.id) ?? null, projects, personality: structuredClone(world.personality) }
}
