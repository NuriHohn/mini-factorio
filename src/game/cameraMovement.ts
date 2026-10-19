// Structural types keep camera movement testable without a renderer or DOM.
interface Camera {
  width: number
  height: number
  zoom: number
  scrollX: number
  scrollY: number
  setBounds: (x: number, y: number, width: number, height: number) => unknown
}
interface Key { isDown: boolean }
type MovementKeys = Record<'W' | 'A' | 'S' | 'D', Key>

export function updateCameraBounds(camera: Camera, worldSize: number): void {
  // Keep the camera center inside the map, even when the viewport exceeds it.
  // Recalculate after resizing or zooming; map-sized bounds can lock an axis.
  const halfWidth = camera.width / camera.zoom / 2
  const halfHeight = camera.height / camera.zoom / 2
  camera.setBounds(-halfWidth, -halfHeight, worldSize + 2 * halfWidth, worldSize + 2 * halfHeight)
}

export function moveCamera(camera: Camera, keys: MovementKeys, delta: number): void {
  const x = Number(keys.D.isDown) - Number(keys.A.isDown)
  const y = Number(keys.S.isDown) - Number(keys.W.isDown)
  const length = Math.hypot(x, y) || 1
  const distance = 420 * delta / 1000 / camera.zoom
  camera.scrollX += x / length * distance
  camera.scrollY += y / length * distance
}
