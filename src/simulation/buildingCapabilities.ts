import type { Building, BuildingKind } from './world'

export const BUILDING_CAPABILITIES: Readonly<Record<BuildingKind, { sabotageable: boolean }>> = {
  tree: { sabotageable: false },
  miner: { sabotageable: true }, furnace: { sabotageable: true }, assembler: { sabotageable: true },
  inserter: { sabotageable: true }, generator: { sabotageable: true },
  belt: { sabotageable: false }, splitter: { sabotageable: false }, storage: { sabotageable: false },
  powerPole: { sabotageable: false }, radar: { sabotageable: false }, sprinkler: { sabotageable: false }, prison: { sabotageable: false },
}
export function isSabotageable(building: Pick<Building, 'kind'>): boolean { return BUILDING_CAPABILITIES[building.kind].sabotageable }
