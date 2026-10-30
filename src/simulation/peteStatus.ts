import { nextDevelopments } from './nextDevelopment'
import { shoreTiles, shoreCost } from './shoreline'
import { rebuildSummary } from './rebuilding'
import { HOME_TASK_LABELS } from './homestead'
import { miniStatus } from './petesWorld'
import { developmentStatus, TASK_LABELS } from './developmentStatus'
import { DEVELOPMENT_NAMES } from './peteDevelopments'
import { woodDestination } from './forestry'
import { feedGarden } from './feeding'
import { gardenSpot } from './ecoProjects'
import { yardSummary } from './yard'
import { ITEM_DEFINITIONS, ITEMS } from './items'
import { serviceCrossing, neighboringTiles, peteReachableTiles } from './navigation'
import { expansionProjectStatuses } from './homesteadExpansion'
import { PATH_LABELS, PERSONALITY_PATHS } from './personality'
import type { Personality, PersonalityPath } from './personality'
import { homesteadProjectDelay, PETE_PROJECTS, projectUnlocked, retiredIndustrial } from './projectRegistry'
import type { ProjectMaterial } from './projectRegistry'
import { currentProject, projectCandidates, projectPlansConflict, projectResources, projectSiteClear } from './secretProject'
import type { SupplyCrate, World } from './world'
export const PROJECT_NAMES: Record<string, string> = { ...DEVELOPMENT_NAMES, treasure: 'Treasure chest', flightpad: 'Flight workshop', run: 'Chicken outdoor run', harvesting: 'Harvest a mature tree', feeding: 'Feed the chickens', gardenCare: 'Garden care (mulching)', fence: 'Fence', coop: 'Chicken coop', campfire: 'Campfire', yard: 'Enclosed yard', gate: 'Garden gate', garden: 'Vegetable garden', reforestation: 'Tree planting', workshop: 'Workshop', veranda: 'Treehouse veranda', experiment: 'Experiment table', press: 'Recycling press' }
export const ACTIVITY_NAMES: Record<World['peace']['activity'], string> = { developmentward: 'Walking to my next activity', developmentWork: 'Working on my development', cycling: 'Enjoying a bicycle ride', dismounting: 'Parking my bicycle', treasureward: 'Walking to a little treasure', pickingTreasure: 'Picking up a treasure', treasureHomeward: 'Bringing a treasure home', storingTreasure: 'Adding a treasure to my collection', flightward: 'Going to my flight workshop', flying: 'Flying my propeller backpack', crashRest: 'Recovering from a harmless bumpy landing', coverward: 'Going to cover the coop', covering: 'Covering the coop', uncoverward: 'Going to uncover the coop', uncovering: 'Removing the coop cover', homeward: 'Going home', entering: 'Heading inside', resting: 'Sleeping', walking: 'Taking a walk', waving: 'Waving', flowers: 'Enjoying flowers', dockward: 'Walking to the dock', fishing: 'Fishing', boating: 'Taking a boat trip', crateward: 'Walking to the supply crate', checkingCrate: 'Checking supplies', project: 'Working on a project', eggward: 'Going to collect an egg', collectingEgg: 'Collecting an egg', campfireward: 'Walking to the campfire', cooking: 'Cooking eggs', campfireHappy: 'Enjoying a meal', gardenward: 'Walking to the garden', gardening: 'Watering the garden', workshopward: 'Walking to the workshop', hammering: 'Working at the anvil', verandaRest: 'Resting on the veranda', experimentward: 'Walking to the experiment table', experimenting: 'Trying an experiment', pressward: 'Walking to the recycling press', pressing: 'Recycling a gear' }
export interface ProjectStatus { completed?: boolean; prioritized?: boolean; selectable?: boolean; id: string; name: string; reason: string; ready: boolean; path: PersonalityPath | null }
export interface PeteStatus extends ReturnType<typeof developmentStatus> { next?: ReturnType<typeof nextDevelopments>; intent: string; yard: string; activity: string; current: string | null; wish: ProjectStatus | null; projects: ProjectStatus[]; personality: Personality }
export function peteStatus(world: World): PeteStatus {
  const mini = miniStatus(world)
  if (mini && !world.homestead) return { ...developmentStatus(world), intent: mini, yard: '', activity: world.miniFactory?.elapsedMs ? 'Ich baue meine Öko-Fabrik' : 'Ich kümmere mich um meine Öko-Fabrik', current: 'Öko-Mini-Fabrik', wish: null, projects: [], personality: structuredClone(world.personality) }
  const active = currentProject(world), candidates = projectCandidates(world)
  const parents = peteReachableTiles(world, world.pete.tile)
  const crates = world.buildings.flatMap((b, tile) => b?.kind === 'supplyCrate' ? [{ crate: b, reachable: neighboringTiles(tile).some(i => parents.has(i) && !world.water[i] && (!world.buildings[i] || serviceCrossing(world, i)) && !world.buildings.some(p => p?.kind === 'prison' && p.exit === i)) }] : [])
  const quantity = (crate: SupplyCrate, item: ProjectMaterial) => item === 'wood' ? crate.wood : item === 'chickenFeed' || item === 'fruit' || item === 'sapling' ? 0 : crate.inventory[item]
  const projects: ProjectStatus[] = PETE_PROJECTS.flatMap<ProjectStatus>(definition => {
    if (retiredIndustrial(world, definition)) return []
    const saved = world[definition.state], name = PROJECT_NAMES[definition.id]
    if (!definition.repeatable && saved?.phase === 'complete') return [{ id: definition.id, name, reason: 'Abgeschlossen', ready: false, completed: true, path: definition.path }]
    let reason: string
    const candidate = candidates.find(c => c.definition.id === definition.id)
    if (world.peace.home === null) reason = 'I need a treehouse before I can work on projects.'
    else if (world.police.car || world.revenge.boss || world.pete.mode !== 'WANDERING') reason = 'I cannot work on projects during this interruption.'
    else if (world.personality.paths[definition.path].level < (world.homestead && definition.id === 'harvesting' ? 1 : definition.minimumLevel)) reason = `I need ${PATH_LABELS[definition.path]} level ${definition.minimumLevel}.`
    else if (definition.prerequisites.some(id => world[PETE_PROJECTS.find(p => p.id === id)!.state]?.phase !== 'complete')) reason = `First I need: ${definition.prerequisites.filter(id => world[PETE_PROJECTS.find(p => p.id === id)!.state]?.phase !== 'complete').map(id => PROJECT_NAMES[id]).join(', ')}.`
    else if (definition.repeatable && (saved?.readyAtMs ?? 0) > world.timeMs) reason = `I can do this again in ${Math.ceil((saved!.readyAtMs! - world.timeMs) / 1000)} seconds.`
    else if (saved?.phase === 'building') reason = projectSiteClear(world, saved) && !projectPlansConflict(world, saved) ? 'Materials already collected. I can continue this work.' : 'Materials already collected, but my work site or approach is blocked.'
    else if (homesteadProjectDelay(world, definition.id)) reason = homesteadProjectDelay(world, definition.id)!
    else if (definition.id === 'harvesting' && !candidate) reason = saved?.carried ? 'I am carrying 3 harvested Wood. I need a reachable supply crate with three free slots.' : !woodDestination(world) ? 'I need a reachable supply crate with three free slots for harvested Wood.' : world.homestead ? 'Ich brauche ausgewachsene Bäume im Umkreis von elf Feldern und Platz im Materiallager.' : 'I need a fully grown tree within six tiles of home and a clear work approach.'
    else if (definition.id === 'feeding' && !candidate) reason = !feedGarden(world) ? 'I need my standing garden to harvest chicken feed.' : !(feedGarden(world)!.feed ?? 0) ? 'I need 1 chicken feed from garden care. Mulching the garden grows feed.' : gardenSpot(world) === null ? 'The feed is ready, but I cannot reach my garden.' : 'I cannot reach a safe feeding spot beside the coop.'
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
          return count ? [`${count} ${item === 'wood' ? 'Wood' : item === 'chickenFeed' ? 'Chicken feed' : item === 'fruit' ? 'Fruit' : item === 'sapling' ? 'Sapling' : ITEM_DEFINITIONS[item].label}`] : []
        })
        reason = `I need ${missing.join(', ')} in one reachable supply crate.`
      }
    }
    if (world.homestead && saved && (saved.legacyMaterials || ['press', 'mechanic', 'winch'].includes(definition.id))) reason = `Altauftrag: ursprüngliche Rechnung und bezahlte Materialien bleiben erhalten. ${reason}`
    return [{ id: definition.id, name, reason, selectable: !!world.homestead && !definition.repeatable && projectUnlocked(world, definition), prioritized: world.homestead?.priority === definition.id, ready: !!candidate, path: definition.path }]
  })
  const wishes = projects.filter(p => !p.completed && (!world.homestead || p.path === world.personality.dominant)).sort((a, b) => Number(b.ready) - Number(a.ready) || Number(world.personality.paths[b.path!].level >= PETE_PROJECTS.find(p => p.id === b.id)!.minimumLevel) - Number(world.personality.paths[a.path!].level >= PETE_PROJECTS.find(p => p.id === a.id)!.minimumLevel) || Number(b.path === world.personality.dominant) - Number(a.path === world.personality.dominant) || (world.homestead ? PETE_PROJECTS.find(p => p.id === a.id)!.minimumLevel - PETE_PROJECTS.find(p => p.id === b.id)!.minimumLevel : 0))
  for (const project of expansionProjectStatuses(world)) projects.push({ ...project, id: `expansion:${project.name}`, ready: false })
  if (world.homestead) {
    const water = world.homestead.waterworks, plan = water.plan
    projects.push({ id: 'shore:bridge', path: 'eco', name: 'Fußbrücken', ready: false, reason: plan?.kind === 'bridge' ? `${shoreTiles(plan).length} Wasserfelder · ${shoreCost(world, plan)} Holz · bezahlte Arbeit bleibt erhalten` : `${water.bridges.length}/8 Übergänge · Eco 2 · 3 Holz je Wasserfeld · nur für neu erreichbare Ressourcen` })
    projects.push({ id: 'shore:dock', path: 'eco', name: 'Angelsteg und Ruderboot', completed: !!water.dock, ready: false, reason: water.dock ? 'gebaut · Ausflüge folgen zwischen Ausbau und Versorgung' : '8 Holz · nach Obstgarten und Holzkistenproduktion · freies erreichbares Ufer und mindestens drei Wasserfelder für die Bootsstrecke' })
  }
  projects.sort((a, b) => (a.path ? PERSONALITY_PATHS.indexOf(a.path) : PERSONALITY_PATHS.length) - (b.path ? PERSONALITY_PATHS.indexOf(b.path) : PERSONALITY_PATHS.length))
  for (const [index, reason] of rebuildSummary(world).entries()) projects.push({ id: `rebuild:${index}`, name: 'Wiederaufbau', reason, ready: false, path: null })
  const selected = active ? PETE_PROJECTS.find(p => world[p.state] === active) : undefined
  const activity = world.developmentLife?.task && ['developmentward', 'developmentWork'].includes(world.peace.activity) ? `${world.peace.activity === 'developmentward' ? 'On my way:' : 'Now:'} ${TASK_LABELS[world.developmentLife.task]}` : world.peace.home === null ? world.pete.mode.toLowerCase().replaceAll('_', ' ') : world.peace.activity === 'project' && active ? active.kind === 'fell' ? active.carried ? 'Bringing harvested Wood to the supply crate' : 'Felling a mature tree' : active.phase === 'collecting' ? 'Collecting project materials' : active.kind === 'feed' ? 'Feeding the chickens' : active.kind === 'care' ? 'Mulching my garden' : 'Building my project' : ACTIVITY_NAMES[world.peace.activity]
  const materials = Object.entries(projectResources(active)).map(([id, n]) => `${n} ${id === 'wood' ? 'Wood' : id === 'chickenFeed' ? 'chicken feed' : ITEM_DEFINITIONS[id as keyof typeof ITEM_DEFINITIONS]?.label ?? id}`).join(' + ')
  const intent = active && selected && world.peace.activity === 'project' ? active.kind === 'fell' ? activity : active.phase === 'building' ? `I am working on ${PROJECT_NAMES[selected.id]} with materials already collected.` : `I am collecting ${materials} for ${PROJECT_NAMES[selected.id]}.` : world.developmentLife?.task ? TASK_LABELS[world.developmentLife.task] : 'My next stop follows my current activity; wishes are not fixed orders.'
  const development = developmentStatus(world)
  if (world.homestead?.task) {
    const h = world.homestead
    development.carrying = ITEMS.filter(item => h.carried[item]).map(item => `${h.carried[item]} ${ITEM_DEFINITIONS[item].label}`).join(' · ') || 'Nichts getragen'
    development.progress = h.elapsedMs ? Math.min(1, h.elapsedMs / (h.task === 'buildBridge' && h.waterworks.plan ? Math.max(1, shoreTiles(h.waterworks.plan).length) * 4000 : h.task === 'buildPavilion' || h.task === 'finishOrder' || h.task === 'buildDock' || h.task === 'upgradeBicycle' || h.task === 'expandStore' || h.task === 'improve' ? 8000 : h.task === 'buildConnection' || h.task === 'buildWheel' || h.task === 'buildMill' || h.task === 'buildChain' ? 4000 : 6000)) : null
  }
  const repair = world.rebuilding?.jobs.find(j => j.tile === world.rebuilding?.active)
  if (repair) {
    development.carrying = ITEMS.filter(i => repair.paid[i]).map(i => `${repair.paid[i]} ${ITEM_DEFINITIONS[i].label}`).join(' · ') || 'Noch kein Reparaturmaterial bezahlt'
    development.progress = repair.elapsedMs ? repair.elapsedMs / (repair.funded ? 4000 : 6000) : null
  }
  return { next: nextDevelopments(world, projects), intent: repair ? rebuildSummary(world).find((_, i) => world.rebuilding!.jobs[i] === repair)! : mini ?? intent, ...development, yard: yardSummary(world), activity: repair ? repair.funded && repair.elapsedMs ? 'Ich baue das fehlende Teil wieder auf' : 'Ich hole Material für den Wiederaufbau' : world.homestead?.task ? world.homestead.task === 'finishOrder' && world.homestead.infrastructure.order && world.homestead.infrastructure[world.homestead.infrastructure.order] === 3 ? 'Ich arbeite an einem bezahlten Versorgungsauftrag' : HOME_TASK_LABELS[world.homestead.task] : activity, current: selected ? PROJECT_NAMES[selected.id] : null, wish: wishes.find(p => p.id !== selected?.id) ?? null, projects, personality: structuredClone(world.personality) }
}
