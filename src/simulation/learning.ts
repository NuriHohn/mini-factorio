import { connectionGuide, loadingGuide } from './connectionGuide'
import { ITEM_DEFINITIONS, ITEMS } from './items'
import { inspectBuilding } from './inspection'
import { DIRECTIONS, inside, offsets, SIZE } from './world'
import type { World } from './world'
import { developmentBuilding } from './peteDevelopments'
import type { DevelopmentTask } from './peteDevelopments'

export interface LearningGoal { id: string; title: string; hint: string; value: number; target: number; complete: boolean }
export function learningGoals(world: World): LearningGoal[] {
  const definitions = [
    { id: 'ore', title: 'Mine your first iron', hint: 'Place a miner on iron ore and connect electricity. Give its output somewhere to go.', value: world.mined.iron, target: 5 },
    { id: 'plates', title: 'Turn ore into plates', hint: 'Feed iron ore into a powered furnace. Connect its output to a belt or inserter.', value: world.produced.ironPlate, target: 5 },
    { id: 'gears', title: 'Make your first gears', hint: 'Unlock Automation I, choose Iron gear in an assembler, and supply two iron plates per gear.', value: world.produced.ironGear, target: 3 },
    { id: 'workshop', title: 'Help Pete build his workshop', hint: 'Build Pete a home and supply 12 iron plates in one reachable crate. Pete chooses and builds his own projects.', value: world.personality.rewardedProjects.includes('workshop') ? 1 : 0, target: 1 },
  ]
  return definitions.map(g => ({ ...g, value: Math.min(g.target, g.value), complete: g.value >= g.target }))
}
export interface ProcessGuide { title: string; steps: string[]; active: number | null; stock: string }
export function processGuides(world: World, index: number | null = null): ProcessGuide[] {
  const b = index === null ? null : world.buildings[index], s = world.developmentLife
  const processKinds = ['orchard', 'nursery', 'mechanic'] as const
  const kinds = b?.kind === 'peteDevelopment' ? [b.development] : index === null ? processKinds.filter(k => world[`${k}Project`]?.phase === 'complete') : b?.kind === 'peteCampfire' && world.orchardProject?.phase === 'complete' ? ['orchard'] : []
  const task: DevelopmentTask | null = s?.task ?? null
  const phase = (tasks: (DevelopmentTask | DevelopmentTask[])[]) => task === null ? -1 : tasks.findIndex(t => Array.isArray(t) ? t.includes(task) : t === task)
  return kinds.flatMap(kind => {
    if (kind === 'orchard') {
      const active = phase(['tendOrchard', 'pickFruit', 'storeFruit', 'cookFruit'])
      return [{ title: 'Fruit journey', steps: ['🌳 Tend the orchard', '🍎 Pick and carry 2 fruit', '🏠 Store fruit at home', '🔥 Cook 1 fruit at the campfire'], active: active < 0 ? null : active, stock: `${developmentBuilding(world, 'orchard')?.fruit ?? 0}/6 ripe · ${s?.carriedFruit ?? 0} carried · ${s?.fruit ?? 0}/12 stored at home` }]
    }
    if (kind === 'nursery') {
      const active = phase(['collectNurseryWood', 'nursing', 'takeSapling', 'plantSapling'])
      return [{ title: 'From Wood to a new tree', steps: ['🪵 Collect 2 supplied Wood', '🌱 Grow 1 sapling', '🚶 Carry the sapling', '🌳 Plant a growing oak nearby'], active: active < 0 ? null : active, stock: `${s?.carriedWood ?? 0} Wood carried · ${s?.saplings ?? 0}/3 saplings · ${s?.carriedSapling ?? 0} sapling carried` }]
    }
    if (kind === 'mechanic') {
      const machine = developmentBuilding(world, 'mechanic')
      return [{ title: 'Making a mechanic module', steps: ['⚙ Deliver 2 iron gears', '🔧 Pete works for 6 seconds', '▣ 1 mechanic module is ready', '➜ Inserter carries it out'], active: task === 'mechanics' ? 1 : null, stock: `${machine?.gears ?? 0}/4 gears in · ${machine?.modules ?? 0}/4 modules out. The recipe changes materials only when Pete finishes.` }]
    }
    return []
  })
}
export interface MachineGuide { source?: number; target?: number; reason: string; action: string; tiles: number[] }
export function machineGuide(world: World, index: number): MachineGuide | null {
  const connection = connectionGuide(world, index) ?? loadingGuide(world, index)
  if (connection) return connection
  const b = world.buildings[index], i = inspectBuilding(world, index)
  if (!b || !i || !['forester', 'sawmill', 'miner', 'furnace', 'assembler', 'belt', 'inserter'].includes(b.kind)) return null
  const tile = (dx: number, dy: number) => inside(b.x + dx, b.y + dy) ? [(b.y + dy) * SIZE + b.x + dx] : []
  if ('electrical' in i && i.electrical.state === 'sabotaged') return { reason: 'Pete has temporarily stopped this machine.', action: 'It recovers automatically; materials and progress are preserved.', tiles: [index] }
  if ('electrical' in i && ['disconnected', 'no-generation'].includes(i.electrical.state)) {
    const poles = world.buildings.flatMap((p, n) => p?.kind === 'powerPole' ? [{ n, distance: Math.abs(p.x - b.x) + Math.abs(p.y - b.y) }] : []).sort((a, c) => a.distance - c.distance || a.n - c.n)
    return { reason: i.electrical.state === 'disconnected' ? 'No pole connection.' : 'The connected network has no electricity.', action: 'Keep a pole within 3 tiles and a generator connected to its network. Power coverage shows the ranges.', tiles: [index, ...poles.slice(0, 1).map(p => p.n)] }
  }
  if (i.kind === 'inserter') return { reason: i.status === 'output-blocked' ? 'The drop point cannot accept this item.' : i.status === 'waiting-input' ? 'No compatible item is ready behind this inserter.' : 'The inserter is carrying items.', action: 'Pickup is behind the arrow; delivery is ahead. Check item type, ports and free space.', tiles: [index, ...([i.pickup, i.drop].flatMap(p => inside(p.x, p.y) ? [p.y * SIZE + p.x] : []))] }
  if (b.kind === 'forester' || b.kind === 'sawmill' || b.kind === 'miner' || b.kind === 'furnace' || b.kind === 'assembler' || b.kind === 'belt') {
    const out = offsets[b.direction], front = tile(out.x, out.y)
    const input = DIRECTIONS.filter(d => d !== b.direction).flatMap(d => tile(offsets[d].x, offsets[d].y))
    if (i.kind === 'belt') return { reason: i.item && i.progress >= 1 ? 'This belt is waiting for space ahead.' : i.item ? 'This item is travelling along the belt.' : 'No item has arrived yet.', action: 'Follow the arrow to the next belt, compatible machine port or chest.', tiles: [index, ...front] }
    if (i.kind === 'forester') return { reason: i.details, action: 'Keep tree plots clear. The station uses electricity and reserves one Wood to replant each harvested plot.', tiles: [index, ...front] }
    if (i.kind === 'miner') return { reason: !i.resource ? 'There is no ore beneath this miner.' : i.buffered ? 'The miner output is occupied.' : 'The miner extracts ore while powered.', action: !i.resource ? 'Place a miner on an ore patch.' : 'Connect a belt in front, or an inserter facing away from the output.', tiles: [index, ...front] }
    if (i.kind !== 'sawmill' && i.kind !== 'furnace' && i.kind !== 'assembler') return null
    if (!i.recipeId) return { reason: i.kind === 'assembler' ? 'Choose a recipe first.' : 'The furnace is waiting to detect an ore.', action: i.kind === 'assembler' ? 'Open Details and settings and choose a recipe.' : 'Supply iron or copper ore through the rear or sides.', tiles: [index, ...input] }
    if (i.status === 'output-full') return { reason: 'The output cannot make room for more products.', action: 'Clear the output or add a compatible belt/inserter ahead of the arrow.', tiles: [index, ...front] }
    if (i.status !== 'processing') {
      const missing = ITEMS.flatMap(item => { const n = Math.max(0, (i.requirements[item] ?? 0) - i.input[item]); return n ? [`${n} ${ITEM_DEFINITIONS[item].label}`] : [] })
      return { reason: missing.length ? `Missing: ${missing.join(' + ')}.` : 'Ingredients are ready for the next batch.', action: 'Feed the highlighted rear/side input tiles. The front is reserved for output.', tiles: [index, ...input] }
    }
    return { reason: i.electrical.state === 'reduced' ? 'The machine is working slowly because power is shared.' : 'The recipe is being processed.', action: 'Ingredients are committed to this batch; products appear when processing finishes.', tiles: [index, ...front] }
  }
  return null
}

export function peteRoute(world: World): number[] {
  const p = world.pete
  if (world.peace.home === null || p.pathRevision !== world.topologyRevision || ['flying', 'crashRest', 'boating'].includes(world.peace.activity)) return []
  const route = [p.tile, ...(p.next === null ? [] : [p.next]), ...p.path]
  return route.every((n, i) => Number.isInteger(n) && n >= 0 && n < SIZE * SIZE && (i === 0 || Math.abs(n % SIZE - route[i - 1] % SIZE) + Math.abs(Math.floor(n / SIZE) - Math.floor(route[i - 1] / SIZE)) === 1)) ? route : []
}
