import { describe, expect, it } from 'vitest'
import { beltPathPoint } from './beltPath'
import { DIRECTIONS, offsets, opposite } from '../simulation/world'

describe('conveyor centerline geometry', () => {
  for (const output of DIRECTIONS) {
    for (const entry of DIRECTIONS.filter(d => d !== output)) {
      it(`joins tile edges smoothly from ${entry} to ${output}`, () => {
        const start = beltPathPoint(entry, output, 0)
        const end = beltPathPoint(entry, output, 1)
        expect(start.x).toBeCloseTo(offsets[entry].x / 2)
        expect(start.y).toBeCloseTo(offsets[entry].y / 2)
        expect(end.x).toBeCloseTo(offsets[output].x / 2)
        expect(end.y).toBeCloseTo(offsets[output].y / 2)
        const first = beltPathPoint(entry, output, .0001)
        const last = beltPathPoint(entry, output, .9999)
        const incoming = { x: first.x - start.x, y: first.y - start.y }
        const outgoing = { x: end.x - last.x, y: end.y - last.y }
        expect((incoming.x * -offsets[entry].x + incoming.y * -offsets[entry].y) / Math.hypot(incoming.x, incoming.y)).toBeCloseTo(1)
        expect((outgoing.x * offsets[output].x + outgoing.y * offsets[output].y) / Math.hypot(outgoing.x, outgoing.y)).toBeCloseTo(1)
        const midpoint = beltPathPoint(entry, output, .5)
        if (entry === opposite(output)) expect(midpoint).toEqual({ x: 0, y: 0 })
        else {
          const cx = (offsets[entry].x + offsets[output].x) / 2
          const cy = (offsets[entry].y + offsets[output].y) / 2
          for (let i = 0; i <= 20; i++) {
            const point = beltPathPoint(entry, output, i / 20)
            expect(Math.hypot(point.x - cx, point.y - cy)).toBeCloseTo(.5)
          }
        }
      })
    }
  }
  it('keeps adjacent belt endpoints continuous for every valid entry', () => {
    for (const direction of DIRECTIONS) {
      const source = beltPathPoint(opposite(direction), direction, 1)
      for (const output of DIRECTIONS.filter(d => d !== opposite(direction))) {
        const destination = beltPathPoint(opposite(direction), output, 0)
        expect(source.x).toBeCloseTo(offsets[direction].x + destination.x)
        expect(source.y).toBeCloseTo(offsets[direction].y + destination.y)
      }
    }
  })
  it('clamps progress so blocked items remain at the output edge', () => {
    expect(beltPathPoint('west', 'south', -1)).toEqual(beltPathPoint('west', 'south', 0))
    expect(beltPathPoint('west', 'south', 2)).toEqual(beltPathPoint('west', 'south', 1))
  })
})
