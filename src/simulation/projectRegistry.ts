import type { Item } from './items'
import type { PersonalityPath, ProjectReward } from './personality'
import type { World } from './world'
export type ProjectMaterial = Item | 'wood' | 'chickenFeed'
export const MATERIAL_PATH: Record<ProjectMaterial, PersonalityPath> = { chickenFeed: 'eco', wood: 'eco', iron: 'craftsman', ironPlate: 'craftsman', copper: 'inventor', copperPlate: 'inventor', copperCable: 'inventor', electronicCircuit: 'inventor', ironGear: 'industrial' }
export interface ProjectDefinition {
  id: ProjectReward | 'reforestation' | 'gardenCare' | 'feeding' | 'harvesting'
  state: 'harvestProject' | 'feedingProject' | 'careProject' | 'pressProject' | 'experimentProject' | 'project' | 'coopProject' | 'campfireProject' | 'yard' | 'gateProject' | 'gardenProject' | 'plantProject' | 'workshopProject' | 'verandaProject'
  path: PersonalityPath
  minimumLevel: number
  primaryMaterial?: ProjectMaterial
  resources: Partial<Record<ProjectMaterial, number>>
  repeatable: boolean
  prerequisites: readonly ProjectReward[]
}
// Yard resources are collected per missing section, as in the existing workflow.
export const PETE_PROJECTS: readonly ProjectDefinition[] = [
  { id: 'fence', state: 'project', path: 'eco', minimumLevel: 1, resources: { wood: 6 }, repeatable: false, prerequisites: [] },
  { id: 'coop', state: 'coopProject', path: 'eco', minimumLevel: 1, resources: { wood: 10 }, repeatable: false, prerequisites: ['fence'] },
  { id: 'campfire', state: 'campfireProject', path: 'eco', minimumLevel: 1, resources: { wood: 5 }, repeatable: false, prerequisites: ['fence'] },
  { id: 'yard', state: 'yard', path: 'eco', minimumLevel: 1, resources: { wood: 2 }, repeatable: false, prerequisites: ['fence', 'coop', 'campfire'] },
  { id: 'gate', state: 'gateProject', path: 'eco', minimumLevel: 1, resources: { wood: 3 }, repeatable: false, prerequisites: ['yard'] },
  { id: 'garden', state: 'gardenProject', path: 'eco', minimumLevel: 2, resources: { wood: 12 }, repeatable: false, prerequisites: [] },
  { id: 'reforestation', state: 'plantProject', path: 'eco', minimumLevel: 2, resources: { wood: 2 }, repeatable: true, prerequisites: [] },
  { id: 'workshop', state: 'workshopProject', path: 'craftsman', minimumLevel: 1, resources: { ironPlate: 12 }, primaryMaterial: 'ironPlate', repeatable: false, prerequisites: [] },
  { id: 'veranda', state: 'verandaProject', path: 'craftsman', minimumLevel: 2, resources: { ironPlate: 20 }, primaryMaterial: 'ironPlate', repeatable: false, prerequisites: [] },
  { id: 'experiment', state: 'experimentProject', path: 'inventor', minimumLevel: 1, resources: { copperPlate: 8, copperCable: 4 }, primaryMaterial: 'copperPlate', repeatable: false, prerequisites: [] },
  { id: 'press', state: 'pressProject', path: 'industrial', minimumLevel: 1, resources: { ironGear: 10 }, primaryMaterial: 'ironGear', repeatable: false, prerequisites: [] },
  { id: 'gardenCare', state: 'careProject', path: 'eco', minimumLevel: 2, resources: { wood: 2 }, repeatable: true, prerequisites: ['garden'] },
  { id: 'feeding', state: 'feedingProject', path: 'eco', minimumLevel: 2, resources: { chickenFeed: 1 }, repeatable: true, prerequisites: ['coop', 'garden'] },
  { id: 'harvesting', state: 'harvestProject', path: 'eco', minimumLevel: 2, resources: {}, repeatable: true, prerequisites: [] },
]
export function projectUnlocked(world: World, definition: ProjectDefinition): boolean {
  return (!definition.repeatable || (world[definition.state]?.readyAtMs ?? 0) <= world.timeMs) && world.personality.paths[definition.path].level >= definition.minimumLevel && definition.prerequisites.every(id => {
    const prerequisite = PETE_PROJECTS.find(p => p.id === id)!
    return world[prerequisite.state]?.phase === 'complete'
  }) && (definition.repeatable || world[definition.state]?.phase !== 'complete')
}
