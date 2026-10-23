import { splitterDirections } from './splitters'
import { emptyInventory, ITEMS } from './items'
import type { Inventory, Item } from './items'
import { canReceive, deliverItem } from './transport'
import { buildingAt, offsets, SIZE } from './world'
import type { Building, Inserter, Position, World } from './world'

export const INSERTER_KW = 10
export const INSERTER_CYCLE_MS = 1000
export const INSERTER_SWING_MS = INSERTER_CYCLE_MS / 2
export interface InserterFrame {
  sources: Map<Building, Inventory>
  blockedBelts: Set<Building>
}
export function inserterPorts(inserter: Pick<Inserter, 'x' | 'y' | 'direction'>): { pickup: Position; drop: Position } {
  const d = offsets[inserter.direction]
  return { pickup: { x: inserter.x - d.x, y: inserter.y - d.y }, drop: { x: inserter.x + d.x, y: inserter.y + d.y } }
}
function neighbors(world: World, inserter: Inserter) {
  const { pickup, drop } = inserterPorts(inserter)
  return { source: buildingAt(world, pickup.x, pickup.y), target: buildingAt(world, drop.x, drop.y) }
}
function sourceCount(source: Building, inserter: Inserter, item: Item, requireReady = true): number {
  switch (source.kind) {
    case 'splitter': {
      const output = splitterDirections(source.direction).indexOf(inserter.direction)
      if (output < 0) return 0
      const packet = source.outputs[output]
      return packet?.item === item && (!requireReady || packet.progress >= 1 - 1e-8) ? 1 : 0
    }
    case 'petePress': return item === 'ironGear' ? source.gears : 0
    case 'storage': return source.inventory[item]
    case 'belt': return source.item === item && (!requireReady || source.progress >= 1 - 1e-8) ? 1 : 0
    case 'miner': return source.direction === inserter.direction && source.item === item ? 1 : 0
    case 'furnace':
    case 'assembler': return source.direction === inserter.direction ? source.output[item] : 0
    default: return 0
  }
}
// Capture only relevant source quantities and destination occupancy before any transfers.
export function createInserterFrame(world: World): InserterFrame {
  const frame: InserterFrame = { sources: new Map(), blockedBelts: new Set() }
  for (const inserter of world.buildings) {
    if (inserter?.kind !== 'inserter') continue
    const { source, target } = neighbors(world, inserter)
    if (source && !frame.sources.has(source)) {
      const inventory = emptyInventory()
      // Direction is checked again per inserter; snapshot all physical source units.
      for (const item of ITEMS) {
        if (source.kind === 'furnace' || source.kind === 'assembler') inventory[item] = source.output[item]
        else if (source.kind === 'splitter') inventory[item] = source.outputs.filter(packet => packet?.item === item).length
        else if (source.kind === 'miner') inventory[item] = Number(source.item === item)
        else inventory[item] = sourceCount(source, inserter, item, false)
      }
      frame.sources.set(source, inventory)
    }
    if (target?.kind === 'belt' && target.item) frame.blockedBelts.add(target)
  }
  return frame
}
function accepts(target: Building | null, item: Item, inserter: Inserter, frame?: InserterFrame): target is Building {
  return target !== null && !frame?.blockedBelts.has(target) && canReceive(target, item, inserter.direction)
}
function pickupCandidate(world: World, inserter: Inserter, frame?: InserterFrame): Item | null {
  const { source, target } = neighbors(world, inserter)
  if (!source) return null
  return ITEMS.find(item => sourceCount(source, inserter, item) > 0
    && (!frame || (frame.sources.get(source)?.[item] ?? 0) > 0)
    && accepts(target, item, inserter, frame)) ?? null
}
export function inserterDemand(world: World, inserter: Inserter, frame?: InserterFrame): number {
  if (inserter.phase === 'idle') return pickupCandidate(world, inserter, frame) ? INSERTER_KW : 0
  if (inserter.phase === 'returning' || inserter.elapsedMs < INSERTER_SWING_MS) return INSERTER_KW
  return inserter.item && accepts(neighbors(world, inserter).target, inserter.item, inserter, frame) ? INSERTER_KW : 0
}
export type InserterStatus = 'waiting-input' | 'output-blocked' | 'moving' | 'returning'
export function inserterStatus(world: World, inserter: Inserter): InserterStatus {
  if (inserter.phase === 'returning') return 'returning'
  if (inserter.phase === 'carrying') return inserter.elapsedMs >= INSERTER_SWING_MS && inserterDemand(world, inserter) === 0 ? 'output-blocked' : 'moving'
  const { source } = neighbors(world, inserter)
  return source && ITEMS.some(item => sourceCount(source, inserter, item) > 0) && !pickupCandidate(world, inserter) ? 'output-blocked' : 'waiting-input'
}
function pickup(world: World, inserter: Inserter, frame: InserterFrame): void {
  const item = pickupCandidate(world, inserter, frame)
  const { source } = neighbors(world, inserter)
  const budget = source ? frame.sources.get(source) : undefined
  if (!item || !source || !budget) return
  switch (source.kind) {
    case 'splitter': {
      const output = splitterDirections(source.direction).indexOf(inserter.direction) as 0 | 1
      source.outputs[output] = null
      source.delivered[output]++
      break
    }
    case 'petePress': source.gears--; break
    case 'storage': source.inventory[item]--; break
    case 'furnace':
    case 'assembler': source.output[item]--; break
    case 'miner': source.item = null; break
    case 'belt': source.item = null; source.progress = 0; break
    default: return
  }
  budget[item]--
  inserter.item = item
  inserter.phase = 'carrying'
  inserter.elapsedMs = 0
}
export function advanceInserters(world: World, delta: number, frame: InserterFrame): void {
  // Sequential atomic claims in tile order; every claim sees earlier committed quantities.
  for (const inserter of world.buildings) {
    if (inserter?.kind !== 'inserter') continue
    const speed = world.power?.consumers[inserter.y * SIZE + inserter.x]?.speedFraction ?? 0
    if (speed <= 0) continue
    if (inserter.phase === 'idle') { pickup(world, inserter, frame); continue }
    inserter.elapsedMs = Math.min(INSERTER_SWING_MS, inserter.elapsedMs + delta * speed)
    if (inserter.elapsedMs < INSERTER_SWING_MS - 1e-8) continue
    inserter.elapsedMs = INSERTER_SWING_MS
    if (inserter.phase === 'carrying') {
      const { target } = neighbors(world, inserter)
      if (!inserter.item || !accepts(target, inserter.item, inserter, frame) || !deliverItem(target, inserter.item, inserter.direction)) continue
      inserter.item = null
      inserter.phase = 'returning'
      inserter.elapsedMs = 0
    } else {
      inserter.phase = 'idle'
      inserter.elapsedMs = 0
      // A full return can claim the next old item, but its new swing starts at zero.
      pickup(world, inserter, frame)
    }
  }
}
