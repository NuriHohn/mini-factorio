import { drawInventorStructure } from './leisureVisuals'
import { drawGearPress } from './gearPressVisuals'
import { drawExperimentTable } from './experimentVisuals'
import { drawWorkshop } from './workshopVisuals'
import { drawVegetableGarden, drawPlanting } from './ecoVisuals'
import { drawGardenGate } from './gardenGateVisuals'
import { drawYardCorner, yardCorner } from './yardVisuals'
import { yardDirection } from '../simulation/yard'
import { drawCampfire } from './campfireVisuals'
import { drawChickenCoop } from './chickenCoopVisuals'
import type Phaser from 'phaser'
import type { PeteFence, World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { currentProject, projectBuildMs } from '../simulation/secretProject'
import { visiblePoint } from './viewport'
import type { Viewport } from './viewport'
export function drawPeteFence(g: Phaser.GameObjects.Graphics, fence: PeteFence, tile: number, progress = 1, low = false): void {
  const x = (fence.x + .5) * tile, y = (fence.y + .5) * tile
  const height = low ? 12 : 20, lift = low ? 6 : 0
  const vertical = fence.direction === 'south'
  g.fillStyle(0x243726, .25).fillEllipse(x + 2, y + 9, vertical ? 9 : tile, vertical ? tile : 6)
  // Ground direction changes the rail endpoints, never the upright posts.
  for (const offset of [-11, 11]) {
    const px = x + (vertical ? 0 : offset), py = y + (vertical ? offset : 0)
    g.fillStyle(0xb88b58).fillRect(px - 2, py - 6 + lift, 4, height)
    g.fillStyle(0xd4b080).fillTriangle(px - 3, py - 6 + lift, px, py - 10 + lift, px + 3, py - 6 + lift)
  }
  if (progress >= .35) {
    g.lineStyle(4, 0xc29a67).lineBetween(x - (vertical ? 0 : tile / 2), y - 2 + lift - (vertical ? tile / 2 : 0), x + (vertical ? 0 : tile / 2), y - 2 + lift + (vertical ? tile / 2 : 0))
  }
  if (progress >= .7) {
    g.lineStyle(3, 0xa87c4c).lineBetween(x - (vertical ? -1 : tile / 2), y + 6 - (vertical ? tile / 2 : 0), x + (vertical ? 1 : tile / 2), y + 6 + (vertical ? tile / 2 : 0))
  }
  if (progress === 1) for (const offset of [-11, 11]) g.fillStyle(0x6b614b).fillCircle(x + (vertical ? 0 : offset), y + (vertical ? offset : 0) - 6, 1)

}
export function drawSecretProject(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const project = currentProject(world), p = world.pete
  if (!project || project.phase === 'complete') return
  const index = project.tiles[project.built], x = index % SIZE, y = Math.floor(index / SIZE)
  if (project.kind !== 'veranda' && project.kind !== 'care' && project.kind !== 'feed' && project.kind !== 'fell' && project.elapsedMs && !world.buildings[index] && !world.water[index] && visiblePoint(view, (x + .5) * tile, (y + .5) * tile, tile)) {
    const progress = project.elapsedMs / projectBuildMs(project)
    if (project.kind === 'treasure' || project.kind === 'flightpad') drawInventorStructure(g, project.kind, x, y, tile, progress)
    else if (project.kind === 'press') drawGearPress(g, { kind: 'petePress', plates: 0, gears: 0, x, y }, tile, progress)
    else if (project.kind === 'experiment') drawExperimentTable(g, { kind: 'peteExperiment', x, y }, tile, progress)
    else if (project.kind === 'workshop') drawWorkshop(g, { kind: 'peteWorkshop', x, y }, tile, progress)
    else if (project.kind === 'garden') drawVegetableGarden(g, { kind: 'peteGarden', x, y }, tile, progress)
    else if (project.kind === 'plant') drawPlanting(g, x, y, tile, progress)
    else if (project.kind === 'gate') drawGardenGate(g, { kind: 'peteGate', x, y, direction: project.direction, openMs: 0, holdUntilMs: 0 }, tile, progress)
    else if (project.kind === 'campfire') drawCampfire(g, { kind: 'peteCampfire', x, y }, tile, progress)
    else if (project.kind === 'coop') drawChickenCoop(g, { kind: 'peteCoop', x, y }, tile, progress)
    else if ((project.kind === 'yard' || project.kind === 'run') && (project.kind === 'run' ? world.chickenRun : world.yard) && yardCorner(project.kind === 'run' ? world.chickenRun! : world.yard!, index)) drawYardCorner(g, { kind: 'peteFence', x, y, direction: yardDirection(project.kind === 'run' ? world.chickenRun! : world.yard!, index) }, project.kind === 'run' ? world.chickenRun! : world.yard!, tile, progress)
    else drawPeteFence(g, { kind: 'peteFence', x, y, direction: (project.kind === 'yard' || project.kind === 'run') && world.yard ? yardDirection(project.kind === 'run' ? world.chickenRun! : world.yard!, index) : project.direction }, tile, progress, project.kind === 'run')
  }
  if (world.peace.activity !== 'project' || (project.phase !== 'building' && !(project.kind === 'fell' && project.carried > 0)) || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile)) return
  const px = (p.x + .5) * tile, py = (p.y + .5) * tile
  if (project.phase === 'building' && p.tile === project.spots[project.built] && p.next === null && (project.kind === 'care' || project.kind === 'feed')) {
    const dx = Math.sign((x + .5) * tile - px), dy = Math.sign((y + .5) * tile - py)
    g.fillStyle(0xb98a53).fillRoundedRect(px + dx * 9 - 4, py + dy * 7, 9, 8, 2)
    for (let n = 0; n < 4; n++) {
      const t = (world.timeMs / 700 + n / 4) % 1
      g.fillStyle(project.kind === 'feed' ? 0xe5ca79 : 0x9a7046, 1 - t).fillCircle(px + dx * (12 + t * 12) + n - 2, py + dy * (8 + t * 14) + t * 5, 1.5)
    }
  } else if (project.phase === 'building' && p.tile === project.spots[project.built] && p.next === null) {
    const swing = Math.sin(world.timeMs / 230) * .6
    g.lineStyle(3, 0x91dd60).lineBetween(px + 6, py + 4, px + 12, py - 4)
    g.save().translateCanvas(px + 12, py - 4).rotateCanvas(swing)
    g.fillStyle(0xb28b58).fillRect(-1, -9, 2, 12)
    if (project.kind === 'fell') g.fillStyle(0xc3d1c8).fillTriangle(-1, -11, 8, -14, 8, -5)
    g.fillStyle(0x89958c).fillRoundedRect(-5, -11, 10, project.kind === 'plant' || project.kind === 'garden' ? 8 : 4, 1).restore()
  } else {
    g.lineStyle(3, 0x91dd60).lineBetween(px + 5, py + 4, px + 11, py + 5)
    g.fillStyle(0xb98a53).fillRoundedRect(px + 6, py, 12, 8, 2)
    g.lineStyle(1, 0xe0c18b).lineBetween(px + 11, py, px + 11, py + 8).lineBetween(px + 6, py + 4, px + 18, py + 4)
  }
}
