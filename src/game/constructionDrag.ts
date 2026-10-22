import { footbridgeBankError } from '../simulation/footbridge'
import { commitConstruction, planConstruction } from '../simulation/construction'
import type { ConstructionPlan, DragBuilding } from '../simulation/construction'
import type { Direction, Position, World } from '../simulation/world'
export class ConstructionDrag {
  private gesture: { world: World; start: Position; end: Position; kind: DragBuilding; facing: Direction; dragged: boolean } | null = null
  private cache: { key: string; plan: ConstructionPlan } | null = null
  get active(): boolean { return this.gesture !== null }
  begin(world: World, point: Position, kind: DragBuilding, facing: Direction): string | null {
    this.cancel()
    const error = kind === 'footbridge' ? footbridgeBankError(world, point) : planConstruction(world, point, point, kind, facing).error
    if (error) return error
    this.gesture = { world, start: { ...point }, end: { ...point }, kind, facing, dragged: false }
    return null
  }
  move(point: Position) {
    const g = this.gesture
    if (!g) return
    g.dragged ||= point.x !== g.start.x || point.y !== g.start.y
    g.end = { ...point }
  }
  preview(): ConstructionPlan | null {
    const g = this.gesture
    if (!g) return null
    const w = g.world, p = w.pete, car = w.police.car, boss = w.revenge.boss
    const key = `${g.start.x},${g.start.y},${g.end.x},${g.end.y},${g.kind},${g.facing},${g.dragged},${w.topologyRevision},${w.nature.wood},${p.tile},${p.next},${p.mode},${car?.tile},${car?.next},${boss?.tile},${boss?.next},${w.research.unlocked.join(',')}`
    if (this.cache?.key !== key) this.cache = { key, plan: planConstruction(w, g.start, g.end, g.kind, g.facing, g.dragged) }
    return this.cache.plan
  }
  finish(world: World) {
    const g = this.gesture
    this.cancel() // A second release cannot replay this transaction.
    if (!g || g.world !== world) return null
    return commitConstruction(world, g.start, g.end, g.kind, g.facing, g.dragged)
  }
  cancel(): boolean { const active = this.active; this.gesture = null; this.cache = null; return active }
}
