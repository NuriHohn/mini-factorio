import { describe, expect, it } from 'vitest'
import { splitterInputPoint, splitterOutputPoint } from './splitterPath'
import { beltPathPoint } from './beltPath'
import { splitterDirections } from '../simulation/splitters'
import { DIRECTIONS, offsets, opposite } from '../simulation/world'

describe('splitter item path continuity', () => {
  it.each(DIRECTIONS)('joins rear entry, both outgoing paths and neighboring belts facing %s', direction => {
    expect(splitterInputPoint(direction, 0)).toEqual({ x: offsets[opposite(direction)].x / 2, y: offsets[opposite(direction)].y / 2 })
    const center = splitterInputPoint(direction, 1)
    expect(center.x).toBeCloseTo(0); expect(center.y).toBeCloseTo(0)
    for (const output of [0, 1] as const) {
      expect(splitterOutputPoint(direction, output, 0).x).toBeCloseTo(center.x)
      expect(splitterOutputPoint(direction, output, 0).y).toBeCloseTo(center.y)
      const d = splitterDirections(direction)[output], end = splitterOutputPoint(direction, output, 1), entry = beltPathPoint(opposite(d), d, 0)
      expect(end.x).toBeCloseTo(offsets[d].x + entry.x)
      expect(end.y).toBeCloseTo(offsets[d].y + entry.y)
    }
  })
})
