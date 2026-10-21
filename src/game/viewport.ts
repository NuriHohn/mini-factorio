import { SIZE } from '../simulation/world'
export interface Viewport { x: number; y: number; width: number; height: number }
export function visibleTileBounds(view: Viewport, tile: number, margin = 2) {
  return {
    left: Math.max(0, Math.floor(view.x / tile) - margin),
    top: Math.max(0, Math.floor(view.y / tile) - margin),
    right: Math.min(SIZE - 1, Math.floor((view.x + view.width) / tile) + margin),
    bottom: Math.min(SIZE - 1, Math.floor((view.y + view.height) / tile) + margin),
  }
}
export function intersects(view: Viewport, x: number, y: number, width: number, height: number, margin = 0): boolean {
  return x + width + margin >= view.x && y + height + margin >= view.y && x - margin <= view.x + view.width && y - margin <= view.y + view.height
}

export function visiblePoint(view: Viewport | undefined, x: number, y: number, margin: number): boolean {
  return !view || intersects(view, x, y, 0, 0, margin)
}

// Phaser's worldView updates during preRender, after scene.update. Derive the
// current rectangle directly so a zoom/pan never culls against the previous frame.
export function cameraViewport(camera: { scrollX: number; scrollY: number; width: number; height: number; zoom: number }): Viewport {
  const width = camera.width / camera.zoom, height = camera.height / camera.zoom
  return { x: camera.scrollX + (camera.width - width) / 2, y: camera.scrollY + (camera.height - height) / 2, width, height }
}
