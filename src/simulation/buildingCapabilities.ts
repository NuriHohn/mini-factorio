import type { Building, BuildingKind } from './world'

export const BUILDING_CAPABILITIES: Readonly<Record<BuildingKind, { sabotageable: boolean }>> = {
  steamEngine: { sabotageable: true },
  forester: { sabotageable: true }, sawmill: { sabotageable: true },
  peteDevelopment: { sabotageable: false },
  peteTreasure: { sabotageable: false },
  peteFlightpad: { sabotageable: false },
  petePress: { sabotageable: false },
  peteExperiment: { sabotageable: false },
  peteWorkshop: { sabotageable: false },
  peteGarden: { sabotageable: false },
  peteGate: { sabotageable: false },
  peteCampfire: { sabotageable: false },
  peteCoop: { sabotageable: false },
  peteFence: { sabotageable: false },
  supplyCrate: { sabotageable: false },
  footbridge: { sabotageable: false },
  fishingDock: { sabotageable: false },
  waterwheel: { sabotageable: true },
  treehouse: { sabotageable: false },
  tree: { sabotageable: false },
  miner: { sabotageable: true }, furnace: { sabotageable: true }, assembler: { sabotageable: true },
  inserter: { sabotageable: true }, generator: { sabotageable: true },
  belt: { sabotageable: false }, splitter: { sabotageable: false }, storage: { sabotageable: false },
  powerPole: { sabotageable: false }, radar: { sabotageable: false }, sprinkler: { sabotageable: false }, prison: { sabotageable: false },
}
export function isSabotageable(building: Pick<Building, 'kind'>): boolean { return BUILDING_CAPABILITIES[building.kind].sabotageable }
