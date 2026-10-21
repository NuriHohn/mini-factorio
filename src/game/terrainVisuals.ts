import type Phaser from 'phaser'
import { ITEM_DEFINITIONS } from '../simulation/items'
import type { World } from '../simulation/world'
import { SIZE } from '../simulation/world'
import { terrainChunkRevision, terrainChunks, TERRAIN_CHUNK_SIZE } from '../simulation/waterTerrain'
import { drawWaterTile } from './landscapeWater'
const GREENS = [0x344e37, 0x36513a, 0x38543b, 0x324b35]
export function drawTerrainTile(g: Phaser.GameObjects.Graphics, world: World, x: number, y: number, tile: number) {
  const index = y * SIZE + x, px = x * tile, py = y * tile, resource = world.tiles[index]
  g.fillStyle(GREENS[(index * 7 + y * 3) % 4]).fillRect(px, py, tile, tile)
  if (!world.water[index]) {
    g.lineStyle(1, 0x14291e, .22).strokeRect(px, py, tile, tile)
    if (resource) {
      const visual = ITEM_DEFINITIONS[resource].visual
      g.fillStyle(visual.color).fillRoundedRect(px + 3, py + 5, 25, 23, 5)
      g.fillStyle(visual.accent).fillTriangle(px + 5, py + 19, px + 13, py + 6, px + 19, py + 19)
      g.fillStyle(visual.shade).fillTriangle(px + 13, py + 24, px + 23, py + 9, px + 28, py + 24)
      g.fillStyle(visual.highlight).fillRect(px + 11, py + 11, 3, 4)
    } else g.fillStyle(0x65814b, .25).fillRect(px + 7 + index % 11, py + 10 + index % 13, 2, 3)
  }
  drawWaterTile(g, world, x, y, tile)
}
let serial = 0
// 25 small retained textures; only edited chunks and their shoreline halo redraw.
export class TerrainVisuals {
  private chunks: { image: Phaser.GameObjects.Image; texture: Phaser.Textures.CanvasTexture; revision: number }[] = []
  rebuilds = 0
  constructor(scene: Phaser.Scene, world: World, tile = 32, visible = true) {
    this.scene = scene; this.world = world; this.tile = tile
    const count = terrainChunks()
    const prefix = `terrain-${++serial}-`
    try {
      for (let cy = 0; cy < count; cy++) for (let cx = 0; cx < count; cx++) {
        const key = prefix + (cy * count + cx)
        const texture = this.scene.textures.createCanvas(key, TERRAIN_CHUNK_SIZE * tile, TERRAIN_CHUNK_SIZE * tile)
        if (!texture) throw new Error('Could not prepare terrain texture.')
        let image: Phaser.GameObjects.Image
        try { image = this.scene.add.image(cx * TERRAIN_CHUNK_SIZE * tile, cy * TERRAIN_CHUNK_SIZE * tile, key).setOrigin(0).setDepth(-1).setVisible(visible) }
        catch (error) { this.scene.textures.remove(key); throw error }
        image.once('destroy', () => this.scene.textures.remove(key))
        this.chunks.push({ image, texture, revision: -1 })
      }
      this.update()
    } catch (error) { this.destroy(); throw error }
  }
  private scene: Phaser.Scene
  private world: World
  private tile: number
  update() {
    const count = terrainChunks()
    let graphics: Phaser.GameObjects.Graphics | null = null
    try {
      for (let i = 0; i < this.chunks.length; i++) {
        const chunk = this.chunks[i], revision = terrainChunkRevision(this.world, i)
        if (chunk.revision === revision) continue
        graphics ??= this.scene.add.graphics().setVisible(false)
        const x = i % count * TERRAIN_CHUNK_SIZE, y = Math.floor(i / count) * TERRAIN_CHUNK_SIZE
        graphics.clear().save().translateCanvas(-x * this.tile, -y * this.tile)
        for (let yy = y; yy < y + TERRAIN_CHUNK_SIZE; yy++) for (let xx = x; xx < x + TERRAIN_CHUNK_SIZE; xx++) drawTerrainTile(graphics, this.world, xx, yy, this.tile)
        graphics.restore()
        chunk.texture.context.clearRect(0, 0, chunk.texture.width, chunk.texture.height)
        graphics.generateTexture(chunk.texture.canvas)
        chunk.texture.refresh()
        chunk.revision = revision; this.rebuilds++
      }
    } finally { graphics?.destroy() }
  }
  setVisible(visible: boolean) { for (const chunk of this.chunks) chunk.image.setVisible(visible); return this }
  destroy() { for (const chunk of this.chunks) chunk.image.destroy(); this.chunks = [] }
}
