import Phaser from 'phaser'
import { buildingAt, createWorld, INTERVAL, offsets, placementError, placeBuilding, removalError, removeBuilding, SIZE } from '../simulation/world'
import { advanceWorld } from '../simulation/step'
import type { Direction } from '../simulation/world'
import { useGameStore } from '../state/gameStore'
import { moveCamera, updateCameraBounds } from './cameraMovement'
const TILE = 32
export class FactoryScene extends Phaser.Scene {
  private world = createWorld()
  private keys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private machines!: Phaser.GameObjects.Graphics
  private preview!: Phaser.GameObjects.Graphics
  create() {
    useGameStore.setState({ ore: 0, miners: 0, stored: 0, inspected: null, inventory: null })
    const terrain = this.add.graphics()
    const greens = [0x344e37, 0x36513a, 0x38543b, 0x324b35]
    this.world.tiles.forEach((iron, index) => {
      const x = index % SIZE * TILE, y = Math.floor(index / SIZE) * TILE
      terrain.fillStyle(greens[(index * 7 + Math.floor(index / SIZE) * 3) % 4]).fillRect(x, y, TILE, TILE)
      terrain.lineStyle(1, 0x14291e, .22).strokeRect(x, y, TILE, TILE)
      if (iron) {
        terrain.fillStyle(0x526769).fillRoundedRect(x + 3, y + 5, 25, 23, 5)
        terrain.fillStyle(0x8da9b1).fillTriangle(x + 5, y + 19, x + 13, y + 6, x + 19, y + 19)
        terrain.fillStyle(0x69848e).fillTriangle(x + 13, y + 24, x + 23, y + 9, x + 28, y + 24)
        terrain.fillStyle(0xb4cbd0).fillRect(x + 11, y + 11, 3, 4)
      } else terrain.fillStyle(0x65814b, .25).fillRect(x + 7 + index % 11, y + 10 + index % 13, 2, 3)
    })
    this.machines = this.add.graphics()
    this.preview = this.add.graphics()
    this.cameras.main.setZoom(1.3)
    updateCameraBounds(this.cameras.main, SIZE * TILE)
    this.cameras.main.centerOn(SIZE * TILE / 2, SIZE * TILE / 2)
    this.keys = this.input.keyboard!.addKeys('W,A,S,D', true) as typeof this.keys
    const keyboard = this.input.keyboard!
    keyboard.on('keydown-ONE', () => useGameStore.getState().select('miner'))
    keyboard.on('keydown-TWO', () => useGameStore.getState().select('belt'))
    keyboard.on('keydown-THREE', () => useGameStore.getState().select('storage'))
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
        const building = buildingAt(this.world, x, y)
        useGameStore.setState({ inspected: building?.kind === 'storage' ? y * SIZE + x : null, inventory: building?.kind === 'storage' ? building.inventory : null })
        return
      }
      const error = tool === 'remove' ? removalError(this.world, x, y) : placementError(this.world, x, y, tool)
      if (error) { useGameStore.setState({ message: error }); return }
      if (tool === 'remove') removeBuilding(this.world, x, y)
      else placeBuilding(this.world, x, y, tool, direction)
      useGameStore.setState({ message: tool === 'remove' ? 'Building removed.' : `${tool === 'belt' ? 'Conveyor' : tool === 'miner' ? 'Miner' : 'Storage'} placed.` })
    })
  }
  private arrow(x: number, y: number, direction: Direction, color = 0xe8dfac) {
    const d = offsets[direction]
    const cx = x + TILE / 2, cy = y + TILE / 2
    this.machines.lineStyle(2, color).lineBetween(cx - d.x * 6, cy - d.y * 6, cx + d.x * 7, cy + d.y * 7)
    this.machines.lineBetween(cx + d.x * 7, cy + d.y * 7, cx + d.x * 2 - d.y * 4, cy + d.y * 2 + d.x * 4)
    this.machines.lineBetween(cx + d.x * 7, cy + d.y * 7, cx + d.x * 2 + d.y * 4, cy + d.y * 2 - d.x * 4)
  }
  update(_time: number, delta: number) {
    const camera = this.cameras.main
    updateCameraBounds(camera, SIZE * TILE)
    moveCamera(camera, this.keys, delta)
    advanceWorld(this.world, delta)
    let miners = 0, stored = 0
    this.machines.clear()
    for (const building of this.world.buildings) {
      if (!building) continue
      const x = building.x * TILE, y = building.y * TILE
      if (building.kind === 'storage') {
        stored += building.inventory
        this.machines.fillStyle(0x392d20).fillRoundedRect(x + 2, y + 2, 28, 28, 3)
        this.machines.lineStyle(2, 0xb68b50).strokeRect(x + 5, y + 5, 22, 22)
        this.machines.fillStyle(0xb68b50).fillRect(x + 5, y + 13, 22, 5)
        if (building.inventory) this.machines.fillStyle(0xb4cbd0).fillCircle(x + 16, y + 16, 4)
      } else if (building.kind === 'miner') {
        miners++
        this.machines.fillStyle(0x15201e).fillRoundedRect(x + 3, y + 4, 27, 27, 3)
        this.machines.fillStyle(0xc69a46).fillRect(x + 5, y + 4, 22, 21)
        this.machines.fillStyle(0x354346).fillRect(x + 9, y + 7, 14, 15)
        this.arrow(x, y, building.direction)
        this.machines.fillStyle(building.item ? 0xf08172 : 0x79e6a2).fillCircle(x + 25, y + 6, 2)
        this.machines.fillStyle(0x79e6a2).fillRect(x + 5, y + 27, 22 * (building.item ? 1 : building.elapsed / INTERVAL), 3)
      } else {
        this.machines.fillStyle(0x1b2329).fillRoundedRect(x + 1, y + 1, 30, 30, 3)
        this.machines.lineStyle(2, 0x778184).strokeRect(x + 3, y + 3, 26, 26)
        this.arrow(x, y, building.direction, 0xa5ac91)
        if (building.item) {
          const entry = offsets[building.entry], exit = offsets[building.direction]
          const t = building.progress
          const dx = t < .5 ? entry.x * (1 - 2 * t) : exit.x * (2 * t - 1)
          const dy = t < .5 ? entry.y * (1 - 2 * t) : exit.y * (2 * t - 1)
          this.machines.fillStyle(0x17222b).fillCircle(x + 16 + dx * 11, y + 16 + dy * 11, 5)
          this.machines.fillStyle(0xb4cbd0).fillCircle(x + 16 + dx * 11, y + 16 + dy * 11, 3.5)
        }
      }
    }
    const state = useGameStore.getState()
    const inspected = state.inspected === null ? null : this.world.buildings[state.inspected]
    const inventory = inspected?.kind === 'storage' ? inspected.inventory : null
    if (state.ore !== this.world.ore || state.miners !== miners || state.stored !== stored || state.inventory !== inventory) {
      useGameStore.setState({ ore: this.world.ore, miners, stored, inventory })
    }
    this.preview.clear()
    if (inspected) this.preview.lineStyle(2, 0xf3d282).strokeRect(inspected.x * TILE + 1, inspected.y * TILE + 1, TILE - 2, TILE - 2)
    const pointer = this.input.activePointer
    if (state.tool && this.input.isOver) {
      const p = pointer.positionToCamera(camera) as Phaser.Math.Vector2
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE)
      const error = state.tool === 'remove' ? removalError(this.world, x, y) : placementError(this.world, x, y, state.tool)
      const color = error ? 0xf08172 : 0x8df0b3
      this.preview.fillStyle(color, .25).fillRect(x * TILE, y * TILE, TILE, TILE)
      this.preview.lineStyle(2, color).strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2)
      if (state.tool === 'miner' || state.tool === 'belt') this.arrow(x * TILE, y * TILE, state.direction, color)
    }
  }
}
