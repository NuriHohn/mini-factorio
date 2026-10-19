import Phaser from 'phaser'
import { advanceMining, createWorld, placeMiner, placementError, SIZE } from '../simulation/world'
import { useGameStore } from '../state/gameStore'
import { moveCamera, updateCameraBounds } from './cameraMovement'
const TILE = 32
export class FactoryScene extends Phaser.Scene {
  private world = createWorld()
  private keys!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>
  private machines!: Phaser.GameObjects.Graphics
  private preview!: Phaser.GameObjects.Graphics
  create() {
    useGameStore.setState({ ore: 0, miners: 0 })
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
    this.input.keyboard!.on('keydown-ONE', () => useGameStore.getState().select(true))
    this.input.keyboard!.on('keydown-ESC', () => useGameStore.getState().select(false))
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * (dy > 0 ? .9 : 1.1), .5, 2.5))
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown() || !useGameStore.getState().selected) return
      const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE)
      const error = placementError(this.world, x, y)
      if (error) { useGameStore.setState({ message: error }); return }
      if (placeMiner(this.world, x, y)) useGameStore.setState({ miners: this.world.miners.length, message: 'Miner placed · Iron production is running.' })
    })
  }
  update(_time: number, delta: number) {
    const camera = this.cameras.main
    updateCameraBounds(camera, SIZE * TILE)
    moveCamera(camera, this.keys, delta)
    advanceMining(this.world, delta)
    if (useGameStore.getState().ore !== this.world.ore) useGameStore.setState({ ore: this.world.ore })
    this.machines.clear()
    for (const miner of this.world.miners) {
      const x = miner.x * TILE, y = miner.y * TILE
      this.machines.fillStyle(0x15201e).fillRoundedRect(x + 3, y + 5, 27, 26, 3)
      this.machines.fillStyle(0xc69a46).fillRect(x + 5, y + 4, 22, 21)
      this.machines.fillStyle(0x354346).fillRect(x + 9, y + 7, 14, 15)
      this.machines.lineStyle(3, 0xbac6c5).lineBetween(x + 11, y + 10, x + 21, y + 19)
      this.machines.fillStyle(0x79e6a2).fillCircle(x + 24, y + 7, 2)
      this.machines.fillStyle(0x15201e).fillRect(x + 5, y + 27, 22, 3)
      this.machines.fillStyle(0x79e6a2).fillRect(x + 5, y + 27, 22 * miner.elapsed / 1000, 3)
    }
    this.preview.clear()
    const pointer = this.input.activePointer
    if (useGameStore.getState().selected && this.input.isOver) {
      const p = pointer.positionToCamera(camera) as Phaser.Math.Vector2
      const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE)
      const valid = !placementError(this.world, x, y)
      this.preview.fillStyle(valid ? 0x8df0b3 : 0xf08172, .25).fillRect(x * TILE, y * TILE, TILE, TILE)
      this.preview.lineStyle(2, valid ? 0x8df0b3 : 0xf08172).strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2)
    }
  }
}

