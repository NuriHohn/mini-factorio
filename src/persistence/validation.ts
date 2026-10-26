import { DEVELOPMENT_KINDS } from '../simulation/peteDevelopments'
import { PRESS_INPUT_CAPACITY, PRESS_OUTPUT_CAPACITY } from '../simulation/gearPress'
import { GATE_HOLD_MS, GATE_OPEN_MS } from '../simulation/gardenGate'
import { supplyCapacity } from '../simulation/supplyCrate'
import { WATERWHEEL_PERIOD_MS } from '../simulation/waterwheel'
import { validateTree } from './natureValidation'
import { isSabotageable } from '../simulation/buildingCapabilities'
import { SPRINKLER_COOLDOWN_MS } from '../simulation/sprinklers'
import { ITEMS, inventoryTotal } from '../simulation/items'
import type { Inventory, Item } from '../simulation/items'
import { MACHINE_DEFINITIONS, RECIPES } from '../simulation/recipes'
import type { RecipeId } from '../simulation/recipes'
import { DIRECTIONS, INTERVAL, SIZE } from '../simulation/world'
import type { Building, CraftingMachine, Direction, Position, ProcessingJob, SplitterPacket } from '../simulation/world'

export function invalid(path: string, reason: string): never { throw new Error(`Invalid save at ${path}: ${reason}.`) }
export function object(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'expected an object')
  const record = value as Record<string, unknown>
  for (const key of required) if (!Object.hasOwn(record, key)) invalid(`${path}.${key}`, 'missing field')
  for (const key of Object.keys(record)) if (!required.includes(key) && !optional.includes(key)) invalid(`${path}.${key}`, 'unknown field')
  return record
}
export function number(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(path, 'number outside the supported range')
  return value
}
export const count = (v: unknown, p: string, max = Number.MAX_SAFE_INTEGER) => number(v, p, 0, max, true)
export const tile = (v: unknown, p: string) => count(v, p, SIZE * SIZE - 1)
export function choice<T extends string>(value: unknown, path: string, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) invalid(path, 'unsupported value')
  return value as T
}
export function boolean(value: unknown, path: string): boolean { if (typeof value !== 'boolean') invalid(path, 'expected boolean'); return value }
export function array(value: unknown, path: string, length?: number, max = SIZE * SIZE): unknown[] {
  if (!Array.isArray(value) || value.length > max || (length !== undefined && value.length !== length)) invalid(path, 'invalid array length')
  return value
}
export const direction = (v: unknown, p: string): Direction => choice(v, p, DIRECTIONS)
export function position(value: unknown, path: string): Position {
  const p = object(value, path, ['x', 'y'])
  return { x: number(p.x, `${path}.x`, 0, SIZE - 1), y: number(p.y, `${path}.y`, 0, SIZE - 1) }
}
export const nullableItem = (v: unknown, p: string): Item | null => v === null ? null : choice(v, p, ITEMS)
export function inventory(value: unknown, path: string): Inventory {
  const r = object(value, path, ITEMS)
  return Object.fromEntries(ITEMS.map(item => [item, count(r[item], `${path}.${item}`)])) as Inventory
}
export function packet(value: unknown, path: string): SplitterPacket | null {
  if (value === null) return null
  const p = object(value, path, ['item', 'progress'])
  return { item: choice(p.item, `${path}.item`, ITEMS), progress: number(p.progress, `${path}.progress`, 0, 1) }
}
const recipeIds = Object.keys(RECIPES) as RecipeId[]
export function recipeId(value: unknown, path: string): RecipeId | null { return value === null ? null : choice(value, path, recipeIds) }
function job(value: unknown, path: string): ProcessingJob | null {
  if (value === null) return null
  const r = object(value, path, ['recipeId', 'elapsedMs', 'inputs', 'outputs'])
  const id = choice(r.recipeId, `${path}.recipeId`, recipeIds), recipe = RECIPES[id]
  const inputs = inventory(r.inputs, `${path}.inputs`), outputs = inventory(r.outputs, `${path}.outputs`)
  if (ITEMS.some(item => inputs[item] !== (recipe.inputs[item] ?? 0) || outputs[item] !== (recipe.outputs[item] ?? 0))) invalid(path, 'job reservations do not match the recipe')
  return { recipeId: id, elapsedMs: number(r.elapsedMs, `${path}.elapsedMs`, 0, recipe.durationMs), inputs, outputs }
}
function validateCrafting(machine: CraftingMachine, path: string): void {
  const recipe = machine.recipeId ? RECIPES[machine.recipeId] : null
  if (recipe && recipe.machine !== machine.kind) invalid(path, 'recipe belongs to another machine')
  if (machine.job && (!machine.recipeLocked || machine.job.recipeId !== machine.recipeId)) invalid(path, 'job and locked recipe disagree')
  const unconfigured = machine.kind === 'assembler' && !recipe && !machine.recipeLocked && !inventoryTotal(machine.input) && !inventoryTotal(machine.output)
  if (machine.kind === 'sawmill' && (machine.recipeId !== 'woodSawing' || machine.recipeMode !== 'woodSawing' || !machine.recipeLocked)) invalid(path, 'sawmill requires its fixed recipe')
  if (machine.recipeMode !== 'auto' && !unconfigured && (!machine.recipeLocked || !recipe || (machine.kind === 'furnace' && machine.recipeMode !== machine.recipeId))) invalid(path, 'invalid manual recipe lock')
  if (machine.recipeLocked && !recipe) invalid(path, 'locked recipe is missing')
  if (machine.kind === 'furnace') {
    if (!machine.recipeLocked && (recipe || inventoryTotal(machine.input) || inventoryTotal(machine.output))) invalid(path, 'undetected furnace contains a recipe or items')
    if (inventoryTotal(machine.input) > MACHINE_DEFINITIONS.furnace.input.capacity) invalid(path, 'input exceeds capacity')
  }
  for (const item of ITEMS) {
    const capacity = machine.kind === 'assembler' ? 2 * (machine.recipeMode === 'auto' ? Math.max(0, ...Object.values(RECIPES).filter(r => r.machine === 'assembler').map(r => r.inputs[item] ?? 0)) : recipe?.inputs[item] ?? 0) : (recipe?.inputs[item] ? 2 : 0)
    if (machine.input[item] > capacity) invalid(path, 'input is incompatible or exceeds capacity')
    if (machine.output[item] && !recipe?.outputs[item]) invalid(path, 'output is incompatible with recipe')
  }
  if (inventoryTotal(machine.output) + (machine.job ? inventoryTotal(machine.job.outputs) : 0) > MACHINE_DEFINITIONS[machine.kind].outputCapacity) invalid(path, 'output and reservations exceed capacity')
}
export function building(value: unknown, path: string, index: number, timeMs: number, version = 8): Building | null {
  if (value === null) return null
  const raw = value as Record<string, unknown>
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid(path, 'expected building or null')
  const kind = choice(raw.kind, `${path}.kind`, ['steamEngine', 'forester', 'sawmill', 'peteDevelopment', 'peteTreasure', 'peteFlightpad', 'petePress', 'peteExperiment', 'peteWorkshop', 'peteGarden', 'peteGate', 'peteCampfire', 'peteCoop', 'peteFence', 'supplyCrate', 'footbridge', 'fishingDock', 'waterwheel', 'treehouse', 'tree', 'miner', 'belt', 'storage', 'furnace', 'assembler', 'inserter', 'generator', 'powerPole', 'radar', 'prison', 'splitter', 'sprinkler'] as const)
  if (version < 46 && kind === 'steamEngine') invalid(path, 'steam engines require save version 46')
  if (version < 39 && (kind === 'forester' || kind === 'sawmill')) invalid(path, 'forestry buildings require version 39')
  if (version < 38 && kind === 'peteDevelopment') invalid(path, 'development requires version 38')
  if (version < 37 && (kind === 'peteTreasure' || kind === 'peteFlightpad')) invalid(path, 'Inventor leisure structures require save version 37')
  if (version < 28 && kind === 'petePress') invalid(path, 'Pete gear presses require save version 28')
  if (version < 27 && kind === 'peteExperiment') invalid(path, 'Pete experiment tables require save version 27')
  if (version < 24 && kind === 'peteWorkshop') invalid(path, 'Pete workshops require save version 24')
  if (version < 23 && kind === 'peteGarden') invalid(path, 'Pete gardens require save version 23')
  if (version < 20 && kind === 'peteGate') invalid(path, 'Pete gates require save version 20')
  if (version < 18 && kind === 'peteCampfire') invalid(path, 'Pete campfires require save version 18')
  if (version < 16 && kind === 'peteCoop') invalid(path, 'Pete coops require save version 16')
  if (version < 15 && kind === 'peteFence') invalid(path, 'Pete fences require save version 15')
  if (version < 14 && kind === 'supplyCrate') invalid(path, 'supply crates require save version 14')
  if (version < 13 && kind === 'footbridge') invalid(path, 'footbridges require save version 13')
  if (version < 11 && kind === 'fishingDock') invalid(path, 'fishing docks require save version 11')
  if (version < 10 && kind === 'waterwheel') invalid(path, 'waterwheels require save version 10')
  if (version < 8 && kind === 'treehouse') invalid(path, 'treehouses require save version 8')
  if (version < 7 && kind === 'tree') invalid(path, 'trees require save version 7')
  const fields = {
    forester: ['direction', 'elapsed', 'output', 'replant', 'plots', 'plantElapsed'],
    sawmill: ['direction', 'recipeMode', 'recipeId', 'recipeLocked', 'input', 'output', 'job'],
    peteDevelopment: ['development', 'gears', 'modules', 'fruit', 'readyAtMs'],
    peteTreasure: [],
    peteFlightpad: [],
    petePress: ['plates', 'gears'],
    peteExperiment: [],
    peteWorkshop: [],
    peteGarden: version >= 33 ? ['feed'] : [],
    peteGate: ['direction', 'openMs', 'holdUntilMs'],
    peteCampfire: [],
    peteCoop: [],
    peteFence: ['direction'],
    supplyCrate: ['inventory', ...(version >= 15 ? ['wood'] : [])],
    footbridge: ['direction'],
    fishingDock: ['direction'],
    waterwheel: ['direction', 'rotationMs'],
    treehouse: ['placedAtMs'],
    tree: ['species', 'origin', 'bornAtMs', 'nextReproductionAtMs'],
    miner: ['direction', 'elapsed', 'item'], belt: ['direction', 'item', 'progress', 'entry'], storage: ['inventory'],
    furnace: ['direction', 'recipeMode', 'recipeId', 'recipeLocked', 'input', 'output', 'job'],
    assembler: ['direction', 'recipeMode', 'recipeId', 'recipeLocked', 'autoWaitElapsedMs', 'input', 'output', 'job'],
    steamEngine: ['fuel', 'burnRemainingMs', 'cycles'], inserter: ['direction', 'phase', 'item', 'elapsedMs'], generator: [], powerPole: [], radar: [], sprinkler: ['cooldownUntilMs', 'sprays'], prison: ['exit'],
    splitter: ['direction', 'input', 'outputs', 'nextOutput', 'delivered', 'placedAtMs'],
  }
  const r = object(value, path, ['kind', 'x', 'y', ...fields[kind]], ['sabotageUntilMs', ...(version >= 44 && kind === 'sprinkler' ? ['manualReadyAtMs'] : []), ...(version >= 9 && kind === 'belt' ? ['bridge'] : []), ...(version >= 40 && kind === 'supplyCrate' ? ['storeTier'] : [])])
  const x = count(r.x, `${path}.x`, SIZE - 1), y = count(r.y, `${path}.y`, SIZE - 1)
  if (y * SIZE + x !== index) invalid(path, 'building position disagrees with its tile')
  const base = { x, y, ...(r.sabotageUntilMs === undefined ? {} : { sabotageUntilMs: count(r.sabotageUntilMs, `${path}.sabotageUntilMs`) }) }
  if (r.sabotageUntilMs !== undefined && !isSabotageable({ kind })) invalid(path, 'ineligible sabotage target')
  const facing = () => direction(r.direction, `${path}.direction`)
  switch (kind) {
    case 'forester': {
      const output = inventory(r.output, path), plots = array(r.plots, path, undefined, 48).map(i => tile(i, path))
      if (ITEMS.some(i => i !== 'wood' && output[i]) || output.wood > 6 || new Set(plots).size !== plots.length || plots.some(i => Math.abs(i % SIZE - x) > 3 || Math.abs(Math.floor(i / SIZE) - y) > 3 || i === index)) invalid(path, 'invalid forestry stock or plots')
      return { ...base, kind, direction: facing(), output, plots, replant: boolean(r.replant, path), elapsed: number(r.elapsed, path, 0, 6000), plantElapsed: number(r.plantElapsed, path, 0, 3000) }
    }
    case 'peteGate': {
      const openMs = count(r.openMs, `${path}.openMs`, GATE_OPEN_MS), holdUntilMs = count(r.holdUntilMs, `${path}.holdUntilMs`, timeMs + GATE_HOLD_MS)
      if (openMs % 50 || holdUntilMs % 50 || (openMs > 0 && holdUntilMs === 0) || (openMs === GATE_OPEN_MS && holdUntilMs <= timeMs)) invalid(path, 'invalid gate animation clock')
      return { ...base, kind, direction: choice(r.direction, `${path}.direction`, ['east', 'south'] as const), openMs, holdUntilMs }
    }
    case 'peteDevelopment': {
      const development = choice(r.development, path, DEVELOPMENT_KINDS), gears = count(r.gears, path, 4), modules = count(r.modules, path, 4), fruit = count(r.fruit, path, 6), readyAtMs = count(r.readyAtMs, path, timeMs)
      if ((development !== 'mechanic' && (gears || modules)) || (development !== 'orchard' && fruit) || readyAtMs !== 0) invalid(path, 'incompatible development stock')
      return { ...base, kind, development, gears, modules, fruit, readyAtMs }
    }
    case 'petePress': return { ...base, kind, plates: count(r.plates, `${path}.plates`, PRESS_INPUT_CAPACITY), gears: count(r.gears, `${path}.gears`, PRESS_OUTPUT_CAPACITY) }
    case 'peteGarden': return { ...base, kind, feed: version >= 33 ? count(r.feed, `${path}.feed`, 4) : 0 }
    case 'peteTreasure':
    case 'peteFlightpad':
    case 'peteExperiment':
    case 'peteWorkshop':
    case 'peteCampfire':
    case 'peteCoop': return { ...base, kind }
    case 'peteFence': return { ...base, kind, direction: choice(r.direction, `${path}.direction`, ['east', 'south'] as const) }
    case 'footbridge': return { ...base, kind, direction: choice(r.direction, `${path}.direction`, ['east', 'south'] as const) }
    case 'fishingDock': return { ...base, kind, direction: facing() }
    case 'waterwheel': {
      const rotationMs = count(r.rotationMs, `${path}.rotationMs`, Math.min(timeMs, WATERWHEEL_PERIOD_MS - 1))
      if (rotationMs % 50) invalid(path, 'expected fixed-step wheel rotation')
      return { ...base, kind, direction: facing(), rotationMs }
    }
    case 'treehouse': {
      const placedAtMs = count(r.placedAtMs, `${path}.placedAtMs`, timeMs)
      if (placedAtMs % 50) invalid(path, 'expected fixed-step construction time')
      return { kind, x, y, placedAtMs }
    }
    case 'tree': return { kind, x, y, ...validateTree(r, path, timeMs) }
    case 'miner': {
      const elapsed = number(r.elapsed, `${path}.elapsed`, 0, INTERVAL)
      if (elapsed >= INTERVAL) invalid(path, 'mining progress exceeds one cycle')
      return { ...base, kind, direction: facing(), elapsed, item: nullableItem(r.item, `${path}.item`) }
    }
    case 'belt': {
      const d = facing(), entry = direction(r.entry, `${path}.entry`)
      if (entry === d) invalid(path, 'belt cannot enter and leave on the same side')
      if (r.bridge !== undefined && r.bridge !== true) invalid(path, 'bridge marker must be true')
      return { ...base, kind, ...(r.bridge === true ? { bridge: true as const } : {}), direction: d, entry, item: nullableItem(r.item, `${path}.item`), progress: number(r.progress, `${path}.progress`, 0, 1) }
    }
    case 'supplyCrate': {
      const contents = inventory(r.inventory, `${path}.inventory`)
      const storeTier = r.storeTier === undefined ? undefined : count(r.storeTier, `${path}.storeTier`, version >= 41 ? 2 : 1) as 0 | 1 | 2
      const capacity = supplyCapacity({ storeTier })
      const wood = version >= 15 ? count(r.wood, `${path}.wood`, capacity) : 0
      if (inventoryTotal(contents) + wood > capacity) invalid(`${path}.inventory`, 'supply crate capacity exceeded')
      return { ...base, kind, inventory: contents, wood, ...(storeTier === undefined ? {} : { storeTier }) }
    }
    case 'storage': return { ...base, kind, inventory: inventory(r.inventory, `${path}.inventory`) }
    case 'steamEngine': {
      const fuel = count(r.fuel, path, 6), burnRemainingMs = count(r.burnRemainingMs, path, 9950), cycles = count(r.cycles, path)
      if (burnRemainingMs % 50) invalid(path, 'invalid steam work clock')
      return { ...base, kind, fuel, burnRemainingMs, cycles }
    }
    case 'generator': case 'powerPole': case 'radar': return { ...base, kind }
    case 'sprinkler': {
      const manualReadyAtMs = r.manualReadyAtMs === undefined ? 0 : count(r.manualReadyAtMs, `${path}.manualReadyAtMs`, timeMs + 1000)
      if (manualReadyAtMs % 50) invalid(path, 'invalid manual spray clock')
      return { ...base, kind, ...(manualReadyAtMs ? { manualReadyAtMs } : {}), cooldownUntilMs: count(r.cooldownUntilMs, `${path}.cooldownUntilMs`, timeMs + SPRINKLER_COOLDOWN_MS), sprays: count(r.sprays, `${path}.sprays`) }
    }
    case 'prison': return { ...base, kind, exit: tile(r.exit, `${path}.exit`) }
    case 'inserter': {
      const phase = choice(r.phase, `${path}.phase`, ['idle', 'carrying', 'returning'] as const), item = nullableItem(r.item, `${path}.item`), elapsedMs = number(r.elapsedMs, `${path}.elapsedMs`, 0, 500)
      if ((phase === 'carrying') !== (item !== null) || (phase === 'idle' && elapsedMs !== 0)) invalid(path, 'inserter phase and held item disagree')
      return { ...base, kind, direction: facing(), phase, item, elapsedMs }
    }
    case 'splitter': {
      const outputs = array(r.outputs, `${path}.outputs`, 2), delivered = array(r.delivered, `${path}.delivered`, 2)
      return { ...base, kind, direction: facing(), input: packet(r.input, `${path}.input`), outputs: [packet(outputs[0], `${path}.outputs[0]`), packet(outputs[1], `${path}.outputs[1]`)], nextOutput: count(r.nextOutput, `${path}.nextOutput`, 1) as 0 | 1, delivered: [count(delivered[0], `${path}.delivered[0]`), count(delivered[1], `${path}.delivered[1]`)], placedAtMs: count(r.placedAtMs, `${path}.placedAtMs`, timeMs) }
    }
    case 'sawmill': case 'furnace': case 'assembler': {
      const shared = { ...base, direction: facing(), recipeId: recipeId(r.recipeId, `${path}.recipeId`), recipeLocked: boolean(r.recipeLocked, `${path}.recipeLocked`), input: inventory(r.input, `${path}.input`), output: inventory(r.output, `${path}.output`), job: job(r.job, `${path}.job`) }
      const machine: CraftingMachine = kind === 'furnace' || kind === 'sawmill' ? { ...shared, kind, recipeMode: choice(r.recipeMode, `${path}.recipeMode`, ['auto', ...recipeIds]) } : { ...shared, kind, recipeMode: choice(r.recipeMode, `${path}.recipeMode`, ['auto', 'manual'] as const), autoWaitElapsedMs: r.autoWaitElapsedMs === null ? null : number(r.autoWaitElapsedMs, `${path}.autoWaitElapsedMs`, 0, 2000) }
      validateCrafting(machine, path)
      return machine
    }
  }
}
