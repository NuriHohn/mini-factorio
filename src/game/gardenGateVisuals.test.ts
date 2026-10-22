import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { drawGardenGate } from './gardenGateVisuals'
import { inspectionSummary } from './inspectionSummary'
import { PLAYER_TOOLS } from '../state/toolMetadata'
function graphics() {
  const calls: [string, unknown[]][] = []
  const g = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => { calls.push([String(name), args]); return g } }) as Phaser.GameObjects.Graphics
  return { g, calls }
}
describe('Pete’s wooden garden gate visuals', () => {
  const gate = { kind: 'peteGate' as const, x: 20, y: 17, direction: 'east' as const, openMs: 0, holdUntilMs: 0 }
  it('builds from posts to rails/brace and has no player placement tool', () => {
    const { g, calls } = graphics()
    drawGardenGate(g, gate, 32, .2); expect(calls.some(c => c[0] === 'lineBetween')).toBe(false)
    calls.length = 0; drawGardenGate(g, gate, 32, .5); expect(calls.filter(c => c[0] === 'lineBetween')).toHaveLength(1)
    calls.length = 0; drawGardenGate(g, gate, 32); expect(calls.filter(c => c[0] === 'lineBetween')).toHaveLength(3)
    expect(PLAYER_TOOLS.some(t => t.tool === ('peteGate' as string))).toBe(false)
  })
  it('swings smoothly in the correct axis from saved simulation progress without changing the gate', () => {
    const { g, calls } = graphics(), before = structuredClone(gate)
    drawGardenGate(g, { ...gate, openMs: 250 }, 32)
    expect(calls).toContainEqual(['rotateCanvas', [-Math.PI / 2]])
    calls.length = 0; drawGardenGate(g, { ...gate, direction: 'south', openMs: 100 }, 32)
    expect(calls).toContainEqual(['rotateCanvas', [Math.PI / 2]])
    expect(calls.filter(c => c[0] === 'rotateCanvas')).toHaveLength(2); expect(gate).toEqual(before)
  })
  it('explains automatic opening, motion and closure in the existing inspector', () => {
    expect(inspectionSummary({ kind: 'peteGate', openMs: 0 }).state).toContain('Closed')
    expect(inspectionSummary({ kind: 'peteGate', openMs: 100 }).state).toContain('swinging')
    expect(inspectionSummary({ kind: 'peteGate', openMs: 250 }).state).toContain('Open')
  })
})
