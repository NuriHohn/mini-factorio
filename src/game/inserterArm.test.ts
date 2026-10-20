import { expect, it } from 'vitest'
import { inserterArmPoint } from './inserterArm'
it('connects pickup, outward swing, drop and return continuously and clamps progress', () => {
  expect(inserterArmPoint('idle', 0).x).toBe(-1)
  expect(inserterArmPoint('carrying', 0)).toEqual(inserterArmPoint('idle', 0))
  expect(inserterArmPoint('carrying', 250).x).toBeCloseTo(0)
  expect(inserterArmPoint('carrying', 250).y).toBeCloseTo(-.65)
  expect(inserterArmPoint('carrying', 500)).toEqual(inserterArmPoint('returning', 0))
  expect(inserterArmPoint('returning', 500)).toEqual(inserterArmPoint('idle', 0))
  expect(inserterArmPoint('carrying', 10000).x).toBe(1)
  expect(inserterArmPoint('carrying', -50)).toEqual(inserterArmPoint('carrying', 0))
})
