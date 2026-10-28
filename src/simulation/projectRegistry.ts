import { ecoWoodReserve } from './productionLogistics'
import type { Item } from './items'
import type { PersonalityPath, ProjectReward } from './personality'
import type { World } from './world'
export type ProjectMaterial = Item | 'wood' | 'chickenFeed' | 'fruit' | 'sapling'
export const MATERIAL_PATH: Record<ProjectMaterial, PersonalityPath> = { coalBriquette: 'industrial', coal: 'industrial', woodPanel: 'eco', woodenCrate: 'eco', fruit: 'eco', sapling: 'eco', mechanicModule: 'industrial', chickenFeed: 'eco', wood: 'eco', iron: 'craftsman', ironPlate: 'craftsman', copper: 'inventor', copperPlate: 'inventor', copperCable: 'inventor', electronicCircuit: 'inventor', ironGear: 'industrial' }
export function materialPath(world: World, item: ProjectMaterial): PersonalityPath { return world.homestead && item === 'ironGear' ? 'craftsman' : MATERIAL_PATH[item] }
export function retiredIndustrial(world: World, definition: ProjectDefinition): boolean { return !!world.homestead && ['press', 'mechanic', 'winch'].includes(definition.id) && !world.pressProject && !world.mechanicProject && !world.winchProject }
export function wantsShoreDock(world: World): boolean {
  const h = world.homestead, home = world.peace.home, width = Math.sqrt(world.water.length)
  return !!h && home !== null && !h.waterworks.dock && h.expansion.assembler !== null && world.orchardProject?.phase === 'complete' && !world.buildings.some(b => b?.kind === 'fishingDock') && world.water.some((water, tile) => water && Math.max(Math.abs(tile % width - home % width), Math.abs(Math.floor(tile / width) - Math.floor(home / width))) <= 11)
}
export function wantsWaterwheel(world: World): boolean {
  const h = world.homestead, home = world.peace.home, width = Math.sqrt(world.water.length)
  return !!h && !h.infrastructure.wheel && h.waterworks.dock !== null && h.millBuilt === 3 && world.orchardProject?.phase === 'complete' && home !== null && world.water.some((water, tile) => water && Math.max(Math.abs(tile % width - home % width), Math.abs(Math.floor(tile / width) - Math.floor(home / width))) <= 11)
}
export interface ProjectDefinition {
  id: ProjectReward | 'reforestation' | 'gardenCare' | 'feeding' | 'harvesting'
  state: 'orchardProject' | 'nurseryProject' | 'bicycleProject' | 'mechanicProject' | 'winchProject' | 'houseProject' | 'treasureProject' | 'flightProject' | 'chickenRun' | 'harvestProject' | 'feedingProject' | 'careProject' | 'pressProject' | 'experimentProject' | 'project' | 'coopProject' | 'campfireProject' | 'yard' | 'gateProject' | 'gardenProject' | 'plantProject' | 'workshopProject' | 'verandaProject'
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
  { id: 'run', state: 'chickenRun', path: 'eco', minimumLevel: 2, resources: { wood: 2 }, repeatable: false, prerequisites: ['gate'] },
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
  { id: 'treasure', state: 'treasureProject', path: 'inventor', minimumLevel: 2, resources: { copperPlate: 12, copperCable: 4 }, primaryMaterial: 'copperPlate', repeatable: false, prerequisites: [] },
  { id: 'flightpad', state: 'flightProject', path: 'inventor', minimumLevel: 4, resources: { copperPlate: 24, copperCable: 12, electronicCircuit: 8 }, primaryMaterial: 'copperPlate', repeatable: false, prerequisites: ['experiment'] },
  { id: 'orchard', state: 'orchardProject', path: 'eco', minimumLevel: 3, resources: { wood: 18 }, primaryMaterial: 'wood', repeatable: false, prerequisites: [] },
  { id: 'bicycle', state: 'bicycleProject', path: 'craftsman', minimumLevel: 3, resources: { ironPlate: 24 }, primaryMaterial: 'ironPlate', repeatable: false, prerequisites: ['workshop'] },
  { id: 'mechanic', state: 'mechanicProject', path: 'industrial', minimumLevel: 2, resources: { ironGear: 16 }, primaryMaterial: 'ironGear', repeatable: false, prerequisites: ['press'] },
  { id: 'winch', state: 'winchProject', path: 'industrial', minimumLevel: 2, resources: { ironGear: 8, mechanicModule: 6 }, primaryMaterial: 'ironGear', repeatable: false, prerequisites: ['mechanic'] },
  { id: 'nursery', state: 'nurseryProject', path: 'eco', minimumLevel: 4, resources: { wood: 24 }, primaryMaterial: 'wood', repeatable: false, prerequisites: ['orchard'] },
  { id: 'house', state: 'houseProject', path: 'craftsman', minimumLevel: 4, resources: { ironPlate: 32 }, primaryMaterial: 'ironPlate', repeatable: false, prerequisites: ['veranda'] },
]
export function projectUnlocked(world: World, definition: ProjectDefinition): boolean {
  return !retiredIndustrial(world, definition) && (!definition.repeatable || (world[definition.state]?.readyAtMs ?? 0) <= world.timeMs) && world.personality.paths[definition.path].level >= (world.homestead && definition.id === 'harvesting' ? 1 : definition.minimumLevel) && definition.prerequisites.every(id => {
    const prerequisite = PETE_PROJECTS.find(p => p.id === id)!
    return world[prerequisite.state]?.phase === 'complete'
  }) && (definition.repeatable || world[definition.state]?.phase !== 'complete')
}

export function homesteadProjectDelay(world: World, id: ProjectDefinition['id']): string | null {
  const h = world.homestead
  if (!h) return null
  if ((id === 'orchard' || id === 'nursery') && !world.yard && [world.coopProject, world.campfireProject, world.gardenProject].some(p => p?.phase !== 'complete')) return 'Ich reserviere zuerst den Platz für Garten, Hühnerstall und Hof. Danach kann ich den Obstgarten parallel zu den Zaunarbeiten bauen.'
  if (id === 'yard' || id === 'run') {
    if (world.gardenProject?.phase !== 'complete') return 'Ich baue zuerst meinen Garten. Danach erweitere ich die Zäune.'
    const store = h.store === null ? null : world.buildings[h.store]
    if (h.millBuilt === 3 && store?.kind === 'supplyCrate' && store.storeTier === 0) return 'Ich sammle kurz Holz für das Lagerdach. Bereits bezahlte Zaunabschnitte baue ich fertig.'
    if (world.personality.paths.eco.level >= 3 && world.orchardProject?.phase !== 'complete' && store?.kind === 'supplyCrate' && store.wood < 20) return 'Ich spare 18 Holz für den Obstgarten. Neue Zaunabschnitte folgen mit zusätzlichem Holz; bezahlte Arbeit bleibt erhalten.'
    if (world.personality.paths.eco.level >= 3 && h.expansion.assembler === null && store?.kind === 'supplyCrate' && store.wood < 14) return 'Ich halte zwölf Holz für Sägewerk und Produktionsausbau zurück. Zusätzliche Vorräte finanzieren neue Zaunabschnitte.'
    if (wantsWaterwheel(world) && store?.kind === 'supplyCrate' && store.wood < 12) return 'Ich halte zehn Holz für das Wasserrad zurück. Zusätzliche Vorräte bleiben für Zaunabschnitte frei.'
    if (wantsShoreDock(world) && store?.kind === 'supplyCrate' && store.wood < 10) return 'Ich halte acht Holz für Angelsteg und Ruderboot zurück. Zusätzliche Vorräte bleiben für neue Zaunabschnitte frei.'
  }
  if (id === 'gardenCare' || id === 'reforestation') {
    const stock = world.buildings.reduce((n, b) => n + (b?.kind === 'supplyCrate' && b.storeTier !== undefined ? b.wood : 0), 0)
    if (world.yard && world.yard.phase !== 'complete' && stock < 4) return 'Ich halte zwei Holz für den nächsten Zaunabschnitt zurück. Pflege und Aufforstung folgen mit dem nächsten Nachschub.'
    const garden = world.gardenProject?.phase === 'complete' ? world.buildings[world.gardenProject.tiles[0]] : null
    if (id === 'gardenCare' && garden?.kind === 'peteGarden' && !garden.feed && stock >= 2) return null
    const constructionReserve = ecoWoodReserve(world)
    if (constructionReserve && stock < constructionReserve + 2) return `Ich halte ${constructionReserve} Holz für Logistik und Pavillon zurück. Aufforstung und zusätzliche Pflege folgen mit weiterem Nachschub.`
    if (id === 'reforestation' && stock >= 2) return null
    const reserve = 14
    if (stock < reserve) return `Ich sammle zuerst ${reserve} Holz für meine Bauprojekte. Danach folgen Pflege und Aufforstung.`
  }
  return null
}
