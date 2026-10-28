import { ecoWoodReserve } from './productionLogistics'
import { approach, DEVELOPMENT_KINDS, DEVELOPMENT_NAMES, developmentBuilding } from './peteDevelopments'
import type { DevelopmentKind, DevelopmentTask } from './peteDevelopments'
import { planPlanting } from './ecoProjects'
import type { World } from './world'
import { SIZE } from './world'

export const TASK_LABELS: Record<DevelopmentTask, string> = {
  pavilionRest: 'Enjoying the orchard pavilion',
  tendOrchard: 'Tending the orchard', pickFruit: 'Picking ripe fruit', storeFruit: 'Storing fruit at home',
  cookFruit: 'Cooking fruit at the campfire', mechanics: 'Making a mechanic module',
  collectNurseryWood: 'Collecting nursery Wood', nursing: 'Growing a nursery sapling',
  takeSapling: 'Picking up a nursery sapling', plantSapling: 'Planting a nursery sapling',
  winching: 'Operating the workshop hoist', cycle: 'Getting ready for a bicycle ride', annexRest: 'Resting at the treehouse annex',
}
const TASK_KINDS: Partial<Record<DevelopmentTask, DevelopmentKind>> = {
  tendOrchard: 'orchard', pickFruit: 'orchard', storeFruit: 'orchard', cookFruit: 'orchard',
  mechanics: 'mechanic', collectNurseryWood: 'nursery', nursing: 'nursery', takeSapling: 'nursery', plantSapling: 'nursery',
  winching: 'winch', cycle: 'bicycle', annexRest: 'house',
}
export interface DevelopmentStatus { id: DevelopmentKind; name: string; stock: string; reason: string }
export function developmentStatus(world: World): { carrying: string; progress: number | null; developments: DevelopmentStatus[] } {
  const s = world.developmentLife
  const fire = world.campfireProject
  const canCook = !!s?.fruit && fire?.phase === 'complete' && world.buildings[fire.tiles[0]]?.kind === 'peteCampfire' && approach(world, fire.tiles[0]) !== null
  const carrying = s?.carriedFruit ? `${s.carriedFruit} fruit → home` : s?.carriedWood ? `${s.carriedWood} Wood → nursery` : s?.carriedSapling ? '1 sapling → nearby planting site' : 'Nothing from my developments'
  const progress = world.peace.activity === 'developmentWork' ? Math.max(0, Math.min(100, (world.timeMs - world.peace.sinceMs) / (world.peace.untilMs - world.peace.sinceMs) * 100)) : null
  const developments = DEVELOPMENT_KINDS.flatMap(id => {
    if (world[`${id}Project`]?.phase !== 'complete') return []
    const b = developmentBuilding(world, id)
    const stock = id === 'orchard' ? `${b?.fruit ?? 0}/6 ripe fruit · ${s?.fruit ?? 0}/12 fruit at home` : id === 'nursery' ? `${s?.saplings ?? 0}/3 nursery saplings` : id === 'mechanic' ? `${b?.gears ?? 0}/4 gears · ${b?.modules ?? 0}/4 mechanic modules` : 'No material consumed by visits'
    let reason = 'Ready for a visit; I share my time with projects, animal care and rest.'
    const task = s?.task && TASK_KINDS[s.task] === id ? s.task : null
    if (!b) reason = 'This completed structure was removed. It is not rebuilt automatically.'
    else if (world.peace.home === null) reason = 'I need my treehouse before returning to this activity.'
    else if (task) reason = world.peace.activity === 'cycling' ? 'Enjoying a bicycle ride; I return to my parked bicycle.' : TASK_LABELS[task]
    else if (approach(world, b.y * SIZE + b.x) === null) reason = 'I cannot reach a clear work spot beside this structure.'
    else if (id === 'mechanic' && b.modules >= 4) reason = 'Output full. Use an inserter to collect mechanic modules.'
    else if (id === 'mechanic' && b.gears < 2) reason = `I need ${2 - b.gears} more iron gear${b.gears === 0 ? 's' : ''}. Deliver them by belt or inserter.`
    else if (id === 'nursery' && !planPlanting(world)) reason = 'I need a safe, reachable planting site four to six tiles from home.'
    else if (id === 'nursery' && s?.carriedWood) reason = 'Bringing paid Wood back to grow a sapling; no second Wood payment is needed.'
    else if (id === 'nursery' && s?.carriedSapling) reason = 'Carrying a paid nursery sapling to its planting site.'
    else if (id === 'nursery' && !s?.saplings && !s?.carriedWood && !world.buildings.some((c, i) => c?.kind === 'supplyCrate' && c.wood >= 2 + ecoWoodReserve(world) && approach(world, i) !== null)) reason = `I need 2 Wood together in a reachable supply crate${ecoWoodReserve(world) ? ` plus ${ecoWoodReserve(world)} Wood reserved for construction` : ''}.`
    else if (id === 'orchard' && (s?.fruit ?? 0) > 10) reason = canCook ? 'The pantry is full. Cooking fruit frees space for my next delivery.' : 'The pantry is full. I need a reachable campfire to cook fruit and free space.'
    else if (id === 'orchard' && approach(world, world.peace.home) === null) reason = 'I cannot reach my treehouse to deliver fruit.'
    else {
      const tasks: DevelopmentTask[] = id === 'orchard' ? [b.fruit >= 2 ? 'pickFruit' : 'tendOrchard', ...(canCook ? ['cookFruit' as const] : [])] : id === 'nursery' ? [s?.saplings ? 'takeSapling' : 'collectNurseryWood', ...(s?.saplings ? ['plantSapling' as const] : [])] : [id === 'mechanic' ? 'mechanics' : id === 'winch' ? 'winching' : id === 'bicycle' ? 'cycle' : 'annexRest']
      const clocks = tasks.map(t => s?.nextAt[t] ?? 0)
      const next = id === 'nursery' ? Math.max(...clocks) : Math.min(...clocks)
      if (next > world.timeMs) reason = `Taking a break for ${Math.ceil((next - world.timeMs) / 1000)} more seconds.`
    }
    return [{ id, name: DEVELOPMENT_NAMES[id], stock, reason }]
  })
  return { carrying, progress, developments }
}
