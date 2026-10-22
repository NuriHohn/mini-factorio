import { SIZE } from '../simulation/world'
import type Phaser from 'phaser'
import { inventoryTotal } from '../simulation/items'
import { supplyWood, SUPPLY_CRATE_CAPACITY } from '../simulation/supplyCrate'
import type { Position, SupplyCrate, World } from '../simulation/world'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export const UNLOAD_MS = 1100
export function supplyIcon(crate: SupplyCrate, tile: number, zoom: number): Position {
  return { x: (crate.x + .5) * tile, y: Math.max(12 / zoom, crate.y * tile - 13 / zoom) }
}
function canSupply(world: World, crate: SupplyCrate): boolean {
  return world.nature.wood >= 6 && inventoryTotal(crate.inventory) + crate.wood + 6 <= SUPPLY_CRATE_CAPACITY
}
function logs(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
  g.fillStyle(0xb88a54).fillRoundedRect(x - 6 * scale, y - 4 * scale, 12 * scale, 4 * scale, scale).fillRoundedRect(x - 4 * scale, y, 12 * scale, 4 * scale, scale)
  g.fillStyle(0xe1bc7d).fillCircle(x - 5 * scale, y - 2 * scale, 2 * scale).fillCircle(x - 3 * scale, y + 2 * scale, 2 * scale)
}
// Cosmetic, scene-local unloads: authoritative transfer happens once on activation.
export class CrateSupplyAction {
  private world: World | null = null
  private revision = -1
  private crates: SupplyCrate[] = []
  private unloads = new Map<number, { crate: SupplyCrate; atMs: number }>()
  private sites(world: World): SupplyCrate[] {
    if (this.world !== world) { this.world = world; this.revision = -1; this.unloads.clear() }
    if (this.revision !== world.topologyRevision) {
      this.crates = world.buildings.filter((b): b is SupplyCrate => b?.kind === 'supplyCrate')
      this.revision = world.topologyRevision
    }
    return this.crates
  }
  hit(world: World, point: Position, tile: number, zoom: number): number | null {
    for (const crate of this.sites(world)) {
      const icon = supplyIcon(crate, tile, zoom)
      if (Math.hypot(point.x - icon.x, point.y - icon.y) <= 11 / zoom) return crate.y * SIZE + crate.x
    }
    return null
  }
  activate(world: World, index: number): boolean {
    this.sites(world)
    if (!supplyWood(world, index, 6)) return false
    this.unloads.set(index, { crate: world.buildings[index] as SupplyCrate, atMs: world.timeMs })
    return true
  }
  draw(g: Phaser.GameObjects.Graphics, world: World, view: Viewport, tile: number, zoom: number, interactive: boolean): void {
    for (const crate of this.sites(world)) {
      const icon = supplyIcon(crate, tile, zoom), scale = 1 / zoom
      if (!interactive || !visiblePoint(view, icon.x, icon.y, 14 * scale)) continue
      const ready = canSupply(world, crate)
      g.fillStyle(0x15291f, .94).fillCircle(icon.x, icon.y, 11 * scale)
      g.lineStyle(scale, ready ? 0xbcd18b : 0x657566, .9).strokeCircle(icon.x, icon.y, 11 * scale)
      logs(g, icon.x - scale, icon.y - scale, scale)
      g.lineStyle(1.5 * scale, ready ? 0xe0d2a1 : 0x657566).lineBetween(icon.x + 6 * scale, icon.y + 2 * scale, icon.x + 6 * scale, icon.y + 7 * scale).lineBetween(icon.x + 3 * scale, icon.y + 5 * scale, icon.x + 6 * scale, icon.y + 8 * scale).lineBetween(icon.x + 6 * scale, icon.y + 8 * scale, icon.x + 9 * scale, icon.y + 5 * scale)
    }
    for (const [index, unload] of this.unloads) {
      const age = world.timeMs - unload.atMs
      if (world.buildings[index] !== unload.crate || age >= UNLOAD_MS) { this.unloads.delete(index); continue }
      const crate = unload.crate, from = supplyIcon(crate, tile, zoom), x = (crate.x + .5) * tile, y = (crate.y + .5) * tile
      if (!visiblePoint(view, x, y, tile * 2)) continue
      const t = Math.min(1, age / 750), ease = t * t
      if (t < 1) logs(g, x + Math.sin(t * Math.PI) * 5 / zoom, from.y + (y - from.y) * ease, (1 - t * .4) / zoom)
      else {
        const fade = 1 - (age - 750) / (UNLOAD_MS - 750)
        g.lineStyle(2 / zoom, 0xe3c78f, fade * .7).strokeEllipse(x, y + 4, (18 + (1 - fade) * 14) / zoom, (5 + (1 - fade) * 4) / zoom)
        for (let i = 0; i < 3; i++) g.fillStyle(0xe2c28a, fade).fillRect(x + (i - 1) * 7 / zoom, y - 4 - (1 - fade) * 8 / zoom, 2 / zoom, 2 / zoom)
      }
    }
  }
}
