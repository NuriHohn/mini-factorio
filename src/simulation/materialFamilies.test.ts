import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { MATERIAL_PATH, PETE_PROJECTS } from './projectRegistry'
import { createBareWorld } from './testFixtures'
import { placeBuilding } from './world'
import { advanceSecretProject, projectResources } from './secretProject'
import { decodeSave, encodeSave } from '../persistence/saveGame'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
describe('exclusive Pete material families', () => {
  it('assigns every item exactly once and keeps every current project within its family', () => {
    expect(Object.keys(MATERIAL_PATH).sort()).toEqual([...ITEMS, 'wood', 'chickenFeed'].sort())
    for (const project of PETE_PROJECTS) for (const item of Object.keys(project.resources)) expect(MATERIAL_PATH[item as keyof typeof MATERIAL_PATH]).toBe(project.path)
  })
  it('preserves paid version-28 workshop materials through repeated saves and completion', () => {
    const w = createBareWorld(() => .5); w.nature.wood = 100
    placeBuilding(w, 20, 20, 'treehouse', 'east')
    w.workshopProject = { legacyMaterials: true, kind: 'workshop', home: 820, direction: 'east', tiles: [700], spots: [740], phase: 'building', crate: null, built: 0, carried: 4, carriedIron: 8, elapsedMs: 500, selected: true }
    Object.assign(w.pete, { tile: 740, x: 20, y: 18, next: null, path: [], travelMs: 0 })
    Object.assign(w.peace, { activity: 'project', destination: 740, sinceMs: 0, untilMs: 0 })
    const document = JSON.parse(encodeSave(w, view)); document.version = 28; delete document.game.workshopProject.legacyMaterials
    const restored = decodeSave(JSON.stringify(document)).world
    expect(projectResources(restored.workshopProject!)).toEqual({ wood: 4, ironPlate: 8 })
    const again = decodeSave(encodeSave(restored, view)).world
    expect(again.workshopProject).toEqual(restored.workshopProject)
    advanceSecretProject(again, 11500)
    expect(again.workshopProject).toMatchObject({ phase: 'complete', carried: 0, carriedIron: 0 })
    expect(again.workshopProject?.legacyMaterials).toBeUndefined()
    expect(again.personality.paths.craftsman.xp).toBe(10)
    expect(() => decodeSave(encodeSave(again, view))).not.toThrow()
  })
})

