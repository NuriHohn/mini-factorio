import Phaser from 'phaser'
import { buildingAt, createWorld, INTERVAL, offsets, opposite, placementError, placeBuilding, removalError, removeBuilding, SIZE } from '../simulation/world'
import { beltInputs } from '../simulation/beltConnections'
import { BELT_TRAVEL_MS } from '../simulation/transport'
import { beltPathPoint } from './beltPath'
import { changeFurnaceRecipe, furnaceStatus } from '../simulation/smelting'
import { RECIPES } from '../simulation/recipes'
import { ITEM_DEFINITIONS, ITEMS } from '../simulation/items'
import { allocatePower, polePlacementPreview, POLE_COVERAGE_RADIUS, powerRequirement, tilePosition, withinRange } from '../simulation/power'
import type { PolePlacementPreview } from '../simulation/power'
import { electricalDetails } from '../simulation/inspection'
import { inspectBuilding } from '../simulation/inspection'
import { advanceWorld } from '../simulation/step'
import type { Item } from '../simulation/items'
import type { Direction } from '../simulation/world'
import { useGameStore } from '../state/gameStore'
import { moveCamera, updateCameraBounds } from './cameraMovement'
const TILE = 32
export class FactoryScene extends Phaser.Scene {
  private world = createWorld()
  private keys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private wires!: Phaser.GameObjects.Graphics
  private coverage!: Phaser.GameObjects.Graphics
  private machines!: Phaser.GameObjects.Graphics
  private items!: Phaser.GameObjects.Graphics
  private poleLinks!: Phaser.GameObjects.Graphics
  private polePreviewKey = ''
  private poleCandidate: PolePlacementPreview | null = null
  private preview!: Phaser.GameObjects.Graphics
  create() {
    useGameStore.setState({ inspected: null, inspection: null, recipeRequest: null })
    useGameStore.getState().publish(this.world)
    const terrain = this.add.graphics()
    const greens = [0x344e37, 0x36513a, 0x38543b, 0x324b35]
    this.world.tiles.forEach((resource, index) => {
      const x = index % SIZE * TILE, y = Math.floor(index / SIZE) * TILE
      terrain.fillStyle(greens[(index * 7 + Math.floor(index / SIZE) * 3) % 4]).fillRect(x, y, TILE, TILE)
      terrain.lineStyle(1, 0x14291e, .22).strokeRect(x, y, TILE, TILE)
      if (resource) {
        const visual = ITEM_DEFINITIONS[resource].visual
        terrain.fillStyle(visual.color).fillRoundedRect(x + 3, y + 5, 25, 23, 5)
        terrain.fillStyle(visual.accent).fillTriangle(x + 5, y + 19, x + 13, y + 6, x + 19, y + 19)
        terrain.fillStyle(visual.shade).fillTriangle(x + 13, y + 24, x + 23, y + 9, x + 28, y + 24)
        terrain.fillStyle(visual.highlight).fillRect(x + 11, y + 11, 3, 4)
      } else terrain.fillStyle(0x65814b, .25).fillRect(x + 7 + index % 11, y + 10 + index % 13, 2, 3)
    })
    this.wires = this.add.graphics()
    this.coverage = this.add.graphics()
    this.machines = this.add.graphics()
    this.items = this.add.graphics()
    this.poleLinks = this.add.graphics()
    this.polePreviewKey = ''
    this.poleCandidate = null
    this.preview = this.add.graphics()
    this.cameras.main.setZoom(1.3)
    updateCameraBounds(this.cameras.main, SIZE * TILE)
    this.cameras.main.centerOn(SIZE * TILE / 2, SIZE * TILE / 2)
    this.keys = this.input.keyboard!.addKeys('W,A,S,D', true) as typeof this.keys
    const keyboard = this.input.keyboard!
    keyboard.on('keydown-ONE', () => useGameStore.getState().select('miner'))
    keyboard.on('keydown-TWO', () => useGameStore.getState().select('belt'))
    keyboard.on('keydown-THREE', () => useGameStore.getState().select('storage'))
    keyboard.on('keydown-FOUR', () => useGameStore.getState().select('furnace'))
    keyboard.on('keydown-FIVE', () => useGameStore.getState().select('generator'))
    keyboard.on('keydown-SIX', () => useGameStore.getState().select('powerPole'))
    keyboard.on('keydown-P', () => useGameStore.getState().togglePowerOverlay())
    keyboard.on('keydown-X', () => useGameStore.getState().select('remove'))
    keyboard.on('keydown-R', () => useGameStore.getState().rotate())
    keyboard.on('keydown-ESC', () => useGameStore.getState().select(null))
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * (dy > 0 ? .9 : 1.1), .5, 2.5))
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return
      const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE)
      const { tool, direction } = useGameStore.getState()
      if (!tool) {
        const index = y * SIZE + x
        const inspection = buildingAt(this.world, x, y) ? inspectBuilding(this.world, index) : null
        useGameStore.setState({ inspected: inspection ? index : null, inspection })
        return
      }
      const error = tool === 'remove' ? removalError(this.world, x, y) : placementError(this.world, x, y, tool)
      if (error) { useGameStore.setState({ message: error }); return }
      if (tool === 'remove') removeBuilding(this.world, x, y)
      else placeBuilding(this.world, x, y, tool, direction)
      useGameStore.setState({ message: tool === 'remove' ? 'Building removed · Contained resources discarded.' : `${tool === 'belt' ? 'Conveyor' : tool === 'miner' ? 'Miner' : tool === 'furnace' ? 'Furnace' : tool === 'generator' ? 'Generator' : tool === 'powerPole' ? 'Power pole' : 'Storage'} placed.` })
    })
  }
  private drawItem(item: Item, x: number, y: number) {
    const visual = ITEM_DEFINITIONS[item].visual
    if (visual.shape === 'ore') {
      this.items.fillStyle(0x17222b).fillCircle(x, y, 5)
      this.items.fillStyle(visual.color).fillTriangle(x - 4, y + 3, x - 2, y - 4, x + 4, y + 2)
      this.items.fillStyle(visual.highlight).fillCircle(x + 1, y, 2.5)
    } else {
      this.items.fillStyle(visual.shade).fillRect(x - 5, y - 3, 10, 7)
      this.items.fillStyle(visual.color).fillRect(x - 4, y - 3, 8, 5)
      this.items.lineStyle(1, visual.highlight).lineBetween(x - 4, y - 3, x + 4, y - 3)
    }
  }
  private arrow(x: number, y: number, direction: Direction, color = 0xe8dfac, scale = 1) {
    const d = offsets[direction]
    const cx = x + TILE / 2, cy = y + TILE / 2
    this.machines.lineStyle(2, color).lineBetween(cx - d.x * 6 * scale, cy - d.y * 6 * scale, cx + d.x * 7 * scale, cy + d.y * 7 * scale)
    this.machines.lineBetween(cx + d.x * 7 * scale, cy + d.y * 7 * scale, cx + (d.x * 2 - d.y * 4) * scale, cy + (d.y * 2 + d.x * 4) * scale)
    this.machines.lineBetween(cx + d.x * 7 * scale, cy + d.y * 7 * scale, cx + (d.x * 2 + d.y * 4) * scale, cy + (d.y * 2 - d.x * 4) * scale)
  }
  private lane(x: number, y: number, entry: Direction, output: Direction, width: number, color: number) {
    const graphics = this.machines
    graphics.lineStyle(width, color).beginPath()
    for (let i = 0; i <= 20; i++) {
      const p = beltPathPoint(entry, output, i / 20)
      if (i === 0) graphics.moveTo(x + 16 + p.x * TILE, y + 16 + p.y * TILE)
      else graphics.lineTo(x + 16 + p.x * TILE, y + 16 + p.y * TILE)
    }
    graphics.strokePath()
  }
  private showCoverage(position: { x: number; y: number }, networkId: number | null, alpha = .1) {
    const graphics = this.coverage
    graphics.fillStyle(0x66c6e0, alpha).fillCircle((position.x + .5) * TILE, (position.y + .5) * TILE, POLE_COVERAGE_RADIUS * TILE)
    graphics.lineStyle(1, 0x83d5ec, .8).strokeCircle((position.x + .5) * TILE, (position.y + .5) * TILE, POLE_COVERAGE_RADIUS * TILE)
    for (const machine of this.world.buildings) {
      if (!machine || !powerRequirement(machine) || !withinRange(position, machine, POLE_COVERAGE_RADIUS)) continue
      const assigned = this.world.power?.assignments[machine.y * SIZE + machine.x] ?? null
      const color = networkId !== null && assigned !== null && assigned !== networkId ? 0xffbd6c : 0x8df0b3
      graphics.fillStyle(color, .25).fillRect(machine.x * TILE, machine.y * TILE, TILE, TILE)
      graphics.lineStyle(3, color).strokeRect(machine.x * TILE + 1, machine.y * TILE + 1, TILE - 2, TILE - 2)
    }
  }
  private previewPole(x: number, y: number): PolePlacementPreview {
    const key = `${x},${y},${this.world.topologyRevision}`
    // World-space graphics follow camera transforms without being rebuilt.
    if (!this.poleCandidate || this.polePreviewKey !== key) {
      this.polePreviewKey = key
      this.poleCandidate = polePlacementPreview(this.world, { x, y })
      this.poleLinks.clear()
      const color = this.poleCandidate.state === 'invalid' ? 0x929b9f : this.poleCandidate.state === 'connected' ? 0x8df0b3 : 0xf0ac60
      const fromX = (x + .5) * TILE, fromY = (y + .5) * TILE
      this.poleLinks.lineStyle(2, color, .9)
      for (const index of this.poleCandidate.connections) {
        const to = tilePosition(index)
        const dx = (to.x - x) * TILE, dy = (to.y - y) * TILE
        const length = Math.hypot(dx, dy)
        for (let distance = 0; distance < length; distance += 12) {
          const end = Math.min(distance + 7, length)
          this.poleLinks.lineBetween(fromX + dx * distance / length, fromY + dy * distance / length, fromX + dx * end / length, fromY + dy * end / length)
        }
      }
      this.poleLinks.lineBetween(fromX, fromY + 9, fromX, fromY - 9)
      this.poleLinks.lineBetween(fromX - 9, fromY - 6, fromX + 9, fromY - 6)
    }
    return this.poleCandidate
  }
  update(_time: number, delta: number) {
    const camera = this.cameras.main
    updateCameraBounds(camera, SIZE * TILE)
    moveCamera(camera, this.keys, delta)
    const request = useGameStore.getState().recipeRequest
    if (request) {
      const position = tilePosition(request.index)
      const error = changeFurnaceRecipe(this.world, position.x, position.y, request.recipeId)
      useGameStore.setState({ recipeRequest: null, message: error ?? `Recipe selected: ${RECIPES[request.recipeId].label}.` })
    }
    advanceWorld(this.world, delta)
    const power = allocatePower(this.world)
    const overlay = useGameStore.getState().powerOverlay
    this.wires.clear()
    this.coverage.clear()
    for (const [a, b] of power.poleConnections) {
      const from = tilePosition(a), to = tilePosition(b)
      this.wires.lineStyle(overlay ? 2 : 1, 0xd7b66c, .8).lineBetween((from.x + .5) * TILE, (from.y + .5) * TILE, (to.x + .5) * TILE, (to.y + .5) * TILE)
    }
    for (const network of power.networks) for (const index of network.generatorIndices) {
      const generator = this.world.buildings[index]!
      const pole = network.poleIndices.find(i => withinRange(generator, tilePosition(i), POLE_COVERAGE_RADIUS))!
      const to = tilePosition(pole)
      this.wires.lineStyle(1, 0x78c9bc, .8).lineBetween((generator.x + .5) * TILE, (generator.y + .5) * TILE, (to.x + .5) * TILE, (to.y + .5) * TILE)
    }
    if (overlay) for (const network of power.networks) for (const index of network.poleIndices) this.showCoverage(tilePosition(index), network.id, .035)
    this.machines.clear()
    this.items.clear()
    for (const building of this.world.buildings) {
      if (!building) continue
      const x = building.x * TILE, y = building.y * TILE
      if (building.kind === 'storage') {
        this.machines.fillStyle(0x392d20).fillRoundedRect(x + 2, y + 2, 28, 28, 3)
        this.machines.lineStyle(2, 0xb68b50).strokeRect(x + 5, y + 5, 22, 22)
        this.machines.fillStyle(0xb68b50).fillRect(x + 5, y + 13, 22, 5)
        ITEMS.filter(item => building.inventory[item] > 0).forEach((item, index) => this.drawItem(item, x + 11 + index % 2 * 10, y + 12 + Math.floor(index / 2) * 10))
      } else if (building.kind === 'miner') {
        this.machines.fillStyle(0x15201e).fillRoundedRect(x + 3, y + 4, 27, 27, 3)
        this.machines.fillStyle(0xc69a46).fillRect(x + 5, y + 4, 22, 21)
        this.machines.fillStyle(0x354346).fillRect(x + 9, y + 7, 14, 15)
        this.arrow(x, y, building.direction)
        this.machines.fillStyle(building.item ? 0xf08172 : 0x79e6a2).fillCircle(x + 25, y + 6, 2)
        this.machines.fillStyle(0x79e6a2).fillRect(x + 5, y + 27, 22 * (building.item ? 1 : building.elapsed / INTERVAL), 3)
      } else if (building.kind === 'furnace') {
        const status = furnaceStatus(building)
        const speed = power.consumers[building.y * SIZE + building.x]?.speedFraction ?? 0
        const active = status === 'processing' && speed > 0
        const glow = active ? .7 + .3 * Math.sin(building.job ? building.job.elapsedMs / 110 : 0) : .15
        this.machines.fillStyle(0x191e20).fillRoundedRect(x + 2, y + 2, 28, 28, 3)
        this.machines.fillStyle(0x626d70).fillRect(x + 5, y + 3, 22, 24)
        this.machines.fillStyle(0x3e302b).fillRect(x + 7, y + 5, 18, 20)
        this.machines.lineStyle(1, 0x91705b).lineBetween(x + 7, y + 12, x + 25, y + 12)
        this.machines.fillStyle(0x151a1c).fillRoundedRect(x + 9, y + 10, 14, 13, 2)
        this.machines.fillStyle(active ? 0xff9d3c : 0x59636b, glow).fillRect(x + 10, y + 12, 12, 9)
        if (active) this.machines.fillStyle(0xffdc7c, glow).fillTriangle(x + 11, y + 21, x + 17, y + 13 - 2 * Math.sin(building.job ? building.job.elapsedMs / 80 : 0), x + 21, y + 21)
        this.machines.fillStyle(status === 'output-full' ? 0xf08172 : active ? 0xffc470 : 0x98a2a3).fillCircle(x + 26, y + 5, 2)
        const progress = building.job ? building.job.elapsedMs / RECIPES[building.job.recipeId].durationMs : 0
        this.machines.fillStyle(0x111714).fillRect(x + 5, y + 28, 22, 3)
        this.machines.fillStyle(0xffbd6c).fillRect(x + 5, y + 28, 22 * progress, 3)
        this.machines.fillStyle(0x9aabad).fillRect(x + 4, y + 1, 6, 10)
        this.machines.fillStyle(0x293237).fillRect(x + 3, y + 1, 8, 3)
        this.machines.fillStyle(0xb6c2c3).fillCircle(x + 6, y + 25, 1)
        this.machines.fillCircle(x + 26, y + 25, 1)
        const output = offsets[building.direction]
        this.arrow(x + output.x * 8, y + output.y * 8, building.direction, 0xffdb9d, .6)
      } else if (building.kind === 'generator') {
        const networkId = power.assignments[building.y * SIZE + building.x]
        const network = power.networks.find(n => n.id === networkId)
        const supplying = (network?.suppliedKw ?? 0) > 0
        this.machines.fillStyle(0x15242b).fillRoundedRect(x + 2, y + 3, 28, 27, 4)
        this.machines.lineStyle(2, 0x72b9c1).strokeRect(x + 4, y + 5, 24, 23)
        for (let n = 0; n < 4; n++) this.machines.fillStyle(0x3d6571).fillRect(x + 6, y + 8 + n * 4, 9, 2)
        this.machines.fillStyle(0xffdd79).fillTriangle(x + 22, y + 7, x + 16, y + 18, x + 21, y + 18)
        this.machines.fillTriangle(x + 19, y + 15, x + 25, y + 15, x + 19, y + 26)
        this.machines.fillStyle(networkId === undefined ? 0xf08172 : supplying ? 0x79e6a2 : 0x78bdd3).fillCircle(x + 6, y + 5, 2)
      } else if (building.kind === 'powerPole') {
        this.machines.fillStyle(0x322a20).fillEllipse(x + 16, y + 27, 16, 7)
        this.machines.lineStyle(5, 0xb89a6a).lineBetween(x + 16, y + 27, x + 16, y + 5)
        this.machines.lineStyle(3, 0xe5d0a5).lineBetween(x + 5, y + 8, x + 27, y + 8)
        this.machines.fillStyle(0x94d5dc).fillCircle(x + 7, y + 5, 2)
        this.machines.fillCircle(x + 25, y + 5, 2)
      } else {
        const inputs = beltInputs(this.world, building)
        const paths = inputs.length ? inputs : [opposite(building.direction)]
        // Draw every valid input, with a stable main lane independent of items.
        for (const entry of paths) this.lane(x, y, entry, building.direction, 24, 0x778184)
        for (const entry of paths) this.lane(x, y, entry, building.direction, 20, 0x1b2329)
        for (const entry of paths) {
          for (let t = .15; t < 1; t += .2) {
            const p = beltPathPoint(entry, building.direction, t)
            const q = beltPathPoint(entry, building.direction, t + .01)
            const length = Math.hypot(q.x - p.x, q.y - p.y)
            const nx = -(q.y - p.y) / length * 7, ny = (q.x - p.x) / length * 7
            this.machines.lineStyle(1, 0x465256).lineBetween(x + 16 + p.x * TILE - nx, y + 16 + p.y * TILE - ny, x + 16 + p.x * TILE + nx, y + 16 + p.y * TILE + ny)
          }
        }
        const arrow = beltPathPoint(paths[0], building.direction, .65)
        this.arrow(x + arrow.x * TILE, y + arrow.y * TILE, building.direction, 0xa5ac91)
        if (building.item) {
          const progress = Math.min(1, building.progress + this.world.remainder / BELT_TRAVEL_MS)
          const p = beltPathPoint(building.entry, building.direction, progress)
          this.drawItem(building.item, x + 16 + p.x * TILE, y + 16 + p.y * TILE)
        }
      }
      if (powerRequirement(building)) {
        const details = electricalDetails(this.world, building.y * SIZE + building.x)
        const color = details.state === 'disconnected' || details.state === 'no-generation' ? 0xf08172 : details.state === 'reduced' ? 0xffbd6c : details.state === 'idle' ? 0x83c0d4 : 0x79e6a2
        this.items.fillStyle(0x111714).fillCircle(x + 5, y + 5, 4)
        this.items.fillStyle(color).fillCircle(x + 5, y + 5, 2.5)
        if (overlay) this.items.lineStyle(2, color).strokeRect(x + 1, y + 1, TILE - 2, TILE - 2)
      }
    }
    useGameStore.getState().publish(this.world)
    const state = useGameStore.getState()
    const inspected = state.inspected === null ? null : this.world.buildings[state.inspected]
    this.preview.clear()
    if (inspected?.kind === 'powerPole') this.showCoverage(inspected, power.assignments[state.inspected!] ?? null)
    if (inspected) this.preview.lineStyle(2, 0xf3d282).strokeRect(inspected.x * TILE + 1, inspected.y * TILE + 1, TILE - 2, TILE - 2)
    this.poleLinks.setVisible(state.tool === 'powerPole' && this.input.isOver)
    const pointer = this.input.activePointer
    if (state.tool && this.input.isOver) {
      const p = pointer.positionToCamera(camera) as Phaser.Math.Vector2
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE)
      if (state.tool === 'powerPole') this.showCoverage({ x, y }, null)
      const pole = state.tool === 'powerPole' ? this.previewPole(x, y) : null
      const error = pole ? pole.error : state.tool === 'remove' ? removalError(this.world, x, y) : placementError(this.world, x, y, state.tool)
      const color = pole ? pole.state === 'invalid' ? 0x929b9f : pole.state === 'connected' ? 0x8df0b3 : 0xf0ac60 : error ? 0xf08172 : 0x8df0b3
      this.preview.fillStyle(color, .25).fillRect(x * TILE, y * TILE, TILE, TILE)
      this.preview.lineStyle(2, color).strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2)
      if (state.tool === 'miner' || state.tool === 'belt' || state.tool === 'furnace') this.arrow(x * TILE, y * TILE, state.direction, color)
    }
  }
}
