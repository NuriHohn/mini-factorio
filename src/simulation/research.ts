import type { BuildingKind } from './world'

export const TECHNOLOGIES = {
  basicIndustry: { name: 'Basic Industry', cost: 0, prerequisite: null, unlock: 'Miners, furnaces, belts, chests and existing power infrastructure' },
  logistics1: { name: 'Logistics I', cost: 30, prerequisite: 'basicIndustry', unlock: 'Inserters' },
  automation1: { name: 'Automation I', cost: 40, prerequisite: 'basicIndustry', unlock: 'Assemblers and their existing recipes' },
  logistics2: { name: 'Logistics II', cost: 60, prerequisite: 'logistics1', unlock: 'Compact splitters' },
  revengeDefense1: { name: 'Revenge Defense I', cost: 60, prerequisite: 'basicIndustry', unlock: 'Drill combat tool' },
  revengeDefense2: { name: 'Revenge Defense II', cost: 120, prerequisite: 'revengeDefense1', unlock: 'Lightning Beam combat tool' },
  analytics1: { name: 'Analytics I', cost: 80, prerequisite: 'automation1', unlock: 'Production Analytics dashboard' },
} as const
export type TechnologyId = keyof typeof TECHNOLOGIES
export const TECHNOLOGY_IDS = Object.keys(TECHNOLOGIES) as TechnologyId[]
export const SPRINT11_TECHNOLOGIES: TechnologyId[] = ['basicIndustry', 'logistics1', 'automation1', 'logistics2', 'analytics1']
export interface ResearchState { balanceUnits: string; unlocked: TechnologyId[] }
// One unit = one weighted productive nanosecond / minute. Quantize cumulative machine progress at interval boundaries;
// subtracting these boundaries carries sub-nanosecond fractions across steps; all accumulation, purchase checks and deductions are integers.
export const RP_UNITS = 60_000_000_000n
export const RP_RATES = { miner: 2, furnace: 5, assembler: 12 } as const
export const BUILDING_TECHNOLOGY: Partial<Record<BuildingKind, TechnologyId>> = { inserter: 'logistics1', assembler: 'automation1', splitter: 'logistics2' }
export function createResearch(legacy = false): ResearchState {
  return { balanceUnits: '0', unlocked: legacy ? [...SPRINT11_TECHNOLOGIES] : ['basicIndustry'] }
}
export function hasTechnology(research: ResearchState, id: TechnologyId): boolean { return research.unlocked.includes(id) }
export function buildingTechnologyError(research: ResearchState, kind: string): string | null {
  const technology = kind === 'drill' ? 'revengeDefense1' : kind === 'lightningBeam' ? 'revengeDefense2' : Object.hasOwn(BUILDING_TECHNOLOGY, kind) ? BUILDING_TECHNOLOGY[kind as BuildingKind] : null
  return technology && !hasTechnology(research, technology) ? `Requires ${TECHNOLOGIES[technology].name}.` : null
}
