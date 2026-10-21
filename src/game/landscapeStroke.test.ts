import { describe, expect, it } from 'vitest'
import { LandscapeStroke, landscapeTile } from './landscapeStroke'
import { createWorld, SIZE } from '../simulation/world'
const world = () => createWorld(() => .5, { nature: false, water: false })
describe('landscape gestures and camera conversion', () => {
  it.each([.5, .65, 1, 1.3, 2.5])('paints the same world cell at zoom %s using the shared camera transform', zoom => {
    const camera = { scrollX: 67, scrollY: 45, width: 900, height: 600, zoom }
    const x = 23, y = 19
    const point = { x: ((x + .5) * 32 - camera.scrollX - camera.width / 2) * zoom + camera.width / 2, y: ((y + .5) * 32 - camera.scrollY - camera.height / 2) * zoom + camera.height / 2 }
    expect(landscapeTile(point, camera)).toEqual({ x, y })
    const w = world(), stroke = new LandscapeStroke()
    stroke.begin(w, landscapeTile(point, camera), 'flowers', 1)
    expect(w.nature.decorations[y * SIZE + x]).toBe('flowers')
  })
  it('uses actual camera unprojection when available, including tile boundaries', () => {
    const camera = { scrollX: 0, scrollY: 0, zoom: 2, width: 900, height: 600, getWorldPoint: () => ({ x: 10 * 32, y: 9 * 32 - .001 }) }
    expect(landscapeTile({ x: 5, y: 5 }, camera)).toEqual({ x: 10, y: 8 })
  })
  it('interpolates fast dragging without gaps, and an ended stroke cannot paint on hover', () => {
    const w = world(), stroke = new LandscapeStroke()
    stroke.begin(w, { x: 1, y: 10 }, 'flowers', 1)
    stroke.move(w, { x: 30, y: 10 }, 'flowers', 1)
    for (let x = 1; x <= 30; x++) expect(w.nature.decorations[10 * SIZE + x]).toBe('flowers')
    const revision = w.nature.decorationRevision
    expect(stroke.move(w, { x: 30, y: 10 }, 'flowers', 1)).toBe(0)
    expect(w.nature.decorationRevision).toBe(revision)
    stroke.end(); expect(stroke.move(w, { x: 31, y: 10 }, 'flowers', 1)).toBe(0)
    expect(w.nature.decorations[10 * SIZE + 31]).toBe(null)
  })
  it('cancels on brush mode, size or world replacement and never connects unrelated gestures', () => {
    const a = world(), b = world(), stroke = new LandscapeStroke()
    stroke.begin(a, { x: 1, y: 1 }, 'flowers', 3)
    expect(stroke.move(a, { x: 20, y: 20 }, 'grass', 3)).toBe(0)
    stroke.begin(a, { x: 1, y: 1 }, 'flowers', 3)
    expect(stroke.move(a, { x: 20, y: 20 }, 'flowers', 5)).toBe(0)
    stroke.begin(a, { x: 1, y: 1 }, 'flowers', 3)
    expect(stroke.move(b, { x: 20, y: 20 }, 'flowers', 3)).toBe(0)
    expect(b.nature.decorations.every(d => d === null)).toBe(true)
    expect(a.nature.decorations[20 * SIZE + 20]).toBe(null)
  })
})

it('uses the same continuous/cancellable stroke for water and land without crossing tool changes', () => {
  const w = world(), stroke = new LandscapeStroke()
  expect(stroke.begin(w, { x: 1, y: 10 }, 'water', 1)).toBe(1)
  expect(stroke.move(w, { x: 30, y: 10 }, 'water', 1)).toBe(29)
  for (let x = 1; x <= 30; x++) expect(w.water[10 * SIZE + x]).toBe(true)
  expect(stroke.move(w, { x: 31, y: 10 }, 'land', 1)).toBe(0)
  expect(stroke.begin(w, { x: 1, y: 10 }, 'land', 1)).toBe(1)
  expect(stroke.move(w, { x: 30, y: 10 }, 'land', 1)).toBe(29)
  expect(w.water.some(Boolean)).toBe(false)
  stroke.end(); expect(stroke.move(w, { x: 31, y: 10 }, 'water', 1)).toBe(0)
})
