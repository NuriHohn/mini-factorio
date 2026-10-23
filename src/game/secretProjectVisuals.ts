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
export function drawPeteFence(g: Phaser.GameObjects.Graphics, fence: PeteFence, tile: number, progress = 1): void {
  const x = (fence.x + .5) * tile, y = (fence.y + .5) * tile
  g.save().translateCanvas(x, y)
  if (fence.direction === 'south') g.rotateCanvas(Math.PI / 2)
  g.fillStyle(0x243726, .25).fillEllipse(0, 9, tile, 6)
  g.fillStyle(0xb88b58).fillRect(-13, -6, 4, 20).fillRect(9, -6, 4, 20)
  g.fillStyle(0xd4b080).fillTriangle(-14, -6, -11, -10, -8, -6).fillTriangle(8, -6, 11, -10, 14, -6)
  if (progress >= .35) g.fillStyle(0xc29a67).fillRect(-tile / 2, -2, tile, 4)
  if (progress >= .7) g.fillStyle(0xa87c4c).fillRect(-tile / 2, 6, tile, 4)
  if (progress === 1) g.fillStyle(0x6b614b).fillRect(-12, -1, 2, 2).fillRect(10, 7, 2, 2)
  g.restore()
}
export function drawSecretProject(g: Phaser.GameObjects.Graphics, world: World, tile: number, view?: Viewport): void {
  const project = currentProject(world), p = world.pete
  if (!project || project.phase === 'complete') return
  const index = project.tiles[project.built], x = index % SIZE, y = Math.floor(index / SIZE)
  if (project.kind !== 'veranda' && project.elapsedMs && !world.buildings[index] && !world.water[index] && visiblePoint(view, (x + .5) * tile, (y + .5) * tile, tile)) {
    const progress = project.elapsedMs / projectBuildMs(project)
    if (project.kind === 'press') drawGearPress(g, { kind: 'petePress', plates: 0, gears: 0, x, y }, tile, progress)
    else if (project.kind === 'experiment') drawExperimentTable(g, { kind: 'peteExperiment', x, y }, tile, progress)
    else if (project.kind === 'workshop') drawWorkshop(g, { kind: 'peteWorkshop', x, y }, tile, progress)
    else if (project.kind === 'garden') drawVegetableGarden(g, { kind: 'peteGarden', x, y }, tile, progress)
    else if (project.kind === 'plant') drawPlanting(g, x, y, tile, progress)
    else if (project.kind === 'gate') drawGardenGate(g, { kind: 'peteGate', x, y, direction: project.direction, openMs: 0, holdUntilMs: 0 }, tile, progress)
    else if (project.kind === 'campfire') drawCampfire(g, { kind: 'peteCampfire', x, y }, tile, progress)
    else if (project.kind === 'coop') drawChickenCoop(g, { kind: 'peteCoop', x, y }, tile, progress)
    else if (project.kind === 'yard' && world.yard && yardCorner(world.yard, index)) drawYardCorner(g, { kind: 'peteFence', x, y, direction: yardDirection(world.yard, index) }, world.yard, tile, progress)
    else drawPeteFence(g, { kind: 'peteFence', x, y, direction: project.kind === 'yard' && world.yard ? yardDirection(world.yard, index) : project.direction }, tile, progress)
  }
  if (world.peace.activity !== 'project' || !project.carried || !visiblePoint(view, (p.x + .5) * tile, (p.y + .5) * tile, tile)) return
  const px = (p.x + .5) * tile, py = (p.y + .5) * tile
  if (p.tile === project.spots[project.built] && p.next === null) {
    const swing = Math.sin(world.timeMs / 230) * .6
    g.lineStyle(3, 0x91dd60).lineBetween(px + 6, py + 4, px + 12, py - 4)
    g.save().translateCanvas(px + 12, py - 4).rotateCanvas(swing)
    g.fillStyle(0xb28b58).fillRect(-1, -9, 2, 12)
    g.fillStyle(0x89958c).fillRoundedRect(-5, -11, 10, project.kind === 'plant' || project.kind === 'garden' ? 8 : 4, 1).restore()
  } else {
    g.lineStyle(3, 0x91dd60).lineBetween(px + 5, py + 4, px + 11, py + 5)
    g.fillStyle(0xb98a53).fillRoundedRect(px + 6, py, 12, 8, 2)
    g.lineStyle(1, 0xe0c18b).lineBetween(px + 11, py, px + 11, py + 8).lineBetween(px + 6, py + 4, px + 18, py + 4)
  }
}
