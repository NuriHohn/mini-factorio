import { createNature, MATURE_TREE_MS, naturalTreeCap, REPRODUCTION_MS } from '../simulation/nature'
import type { NatureState } from '../simulation/nature'
import { SIZE } from '../simulation/world'
import type { Building, Tree } from '../simulation/world'
import * as v from './validation'
export type NatureData = Pick<NatureState, 'wood' | 'seed' | 'decorations'>
export function restoreNature(value: unknown, trees: (Building | null)[]): NatureState {
  const n = v.object(value, 'nature', ['wood', 'seed', 'decorations'])
  if (trees.filter(t => t?.kind === 'tree' && t.origin === 'natural').length > naturalTreeCap()) v.invalid('nature', 'natural tree cap exceeded')
  return { ...createNature(), wood: v.count(n.wood, 'nature.wood'), seed: v.count(n.seed, 'nature.seed', 0xffffffff), decorations: v.array(n.decorations, 'nature.decorations', SIZE * SIZE).map((d, i) => d === null ? null : v.choice(d, `nature.decorations[${i}]`, ['flowers', 'grass'] as const)) }
}
export function validateTree(value: Record<string, unknown>, path: string, timeMs: number): Pick<Tree, 'bornAtMs' | 'nextReproductionAtMs' | 'origin' | 'species'> {
  const origin = v.choice(value.origin, `${path}.origin`, ['natural', 'manual'] as const)
  const bornAtMs = v.number(value.bornAtMs, `${path}.bornAtMs`, origin === 'natural' ? -MATURE_TREE_MS : 0, timeMs, true)
  const nextReproductionAtMs = v.count(value.nextReproductionAtMs, `${path}.nextReproductionAtMs`)
  const first = bornAtMs + MATURE_TREE_MS + REPRODUCTION_MS
  if (bornAtMs % 50 || nextReproductionAtMs <= timeMs || nextReproductionAtMs < first || (nextReproductionAtMs - first) % REPRODUCTION_MS) v.invalid(path, 'invalid tree growth or reproduction clock')
  return { species: v.choice(value.species, `${path}.species`, ['oak', 'pine', 'birch'] as const), origin, bornAtMs, nextReproductionAtMs }
}
