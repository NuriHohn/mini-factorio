import type { Item } from './items'
import type { PersonalityPath, ProjectReward } from './personality'
import type { World } from './world'
export type ProjectMaterial = Item | 'wood'
export interface ProjectDefinition {
  id: ProjectReward
  state: 'project' | 'coopProject' | 'campfireProject' | 'yard' | 'gateProject'
  path: PersonalityPath
  minimumLevel: number
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
]
export function projectUnlocked(world: World, definition: ProjectDefinition): boolean {
  return world.personality.paths[definition.path].level >= definition.minimumLevel && definition.prerequisites.every(id => {
    const prerequisite = PETE_PROJECTS.find(p => p.id === id)!
    return world[prerequisite.state]?.phase === 'complete'
  }) && (definition.repeatable || world[definition.state]?.phase !== 'complete')
}
