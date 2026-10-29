import { begin } from './homestead'
import { advanceWorld } from './step'
import { describe, expect, it } from 'vitest'
import { createPetesWorld } from './petesWorld'
import { createBareWorld, poweredWorld } from './testFixtures'
import { materialPath, PETE_PROJECTS, retiredIndustrial } from './projectRegistry'
import { CHAIN_KINDS, chainCost, IMPROVEMENT_RULES } from './homesteadExpansion'
import { LINK_KINDS, linkCurrency, linkMaterial } from './infrastructureRules'
import type { LinkKind } from './infrastructureRules'
import type { ChainKind } from './homesteadExpansion'
import type { PersonalityPath } from './personality'
import { RECIPES } from './recipes'
import { advanceCrafting, changeCraftingRecipe } from './crafting'
import { emptyInventory } from './items'
import type { Item } from './items'
import { placeBuilding } from './world'
import type { World } from './world'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { allocatePower } from './power'
import { deliverItem } from './transport'
import { inspectBuilding } from './inspection'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snap = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-28T00:00:00.000Z'))
function prepared(old = false) {
  const w = createPetesWorld(), h = w.homestead!
  h.store = 824; w.buildings[824] = { kind: 'supplyCrate', x: 24, y: 20, wood: 0, inventory: emptyInventory(), storeTier: 0 }
  placeBuilding(w, 23, 18, 'assembler', 'east'); h.expansion.circuitAssembler = 743
  placeBuilding(w, 23, 17, 'powerPole', 'east'); placeBuilding(w, 24, 17, 'generator', 'east')
  expect(changeCraftingRecipe(w, 23, 18, old ? 'electronicCircuit' : 'peteCircuit')).toBeNull()
  return w
}
function run(w: World, ms: number) { for (let t = 0; t < ms; t += 50) { w.timeMs += 50; allocatePower(w); advanceCrafting(w, 50) } }
describe('development resource families', () => {
  it('keeps every current personal project, chain invoice and production dependency in its own path', () => {
    const w = createPetesWorld()
    for (const p of PETE_PROJECTS.filter(p => !retiredIndustrial(w, p))) for (const item of Object.keys(p.resources) as Item[]) expect(materialPath(w, item), `${p.id}: ${item}`).toBe(p.path)
    const chains: [PersonalityPath, ChainKind[]][] = [['eco', ['forestry', 'crates']], ['craftsman', ['iron', 'ironMining', 'gears']], ['inventor', ['copper', 'copperMining', 'cables', 'circuits']], ['industrial', ['steam', 'coalMining', 'coalFeed', 'briquettes', 'steamWorkshop', 'steamHoist']]]
    expect(chains.flatMap(([, kinds]) => kinds).sort()).toEqual([...CHAIN_KINDS].sort())
    for (const [path, kinds] of chains) for (const kind of kinds) for (const item of Object.keys(chainCost(kind)) as Item[]) expect(materialPath(w, item), `${kind}: ${item}`).toBe(path)
    const links: [PersonalityPath, LinkKind[]][] = [['eco', ['woodReturn', 'panelReturn', 'crateReturn']], ['craftsman', ['iron', 'gearFeed', 'gearReturn']], ['inventor', ['copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn']], ['industrial', ['stampFeed', 'loadingFeed', 'loadingReturn']]]
    expect(links.flatMap(([, kinds]) => kinds).sort()).toEqual([...LINK_KINDS].sort())
    for (const [path, kinds] of links) for (const kind of kinds) for (const item of [linkCurrency(kind), linkMaterial(kind)]) expect(materialPath(w, item), `${kind}: ${item}`).toBe(path)
    for (const rule of Object.values(IMPROVEMENT_RULES)) expect(materialPath(w, rule.item), rule.label).toBe('eco')
    const recipes = { eco: ['woodSawing', 'woodenCrate'], craftsman: ['ironSmelting', 'ironGear'], inventor: ['copperSmelting', 'copperCable', 'peteCircuit'], industrial: ['coalBriquette'] } as const
    for (const [path, ids] of Object.entries(recipes)) for (const id of ids) for (const item of [...Object.keys(RECIPES[id].inputs), ...Object.keys(RECIPES[id].outputs)] as Item[]) expect(materialPath(w, item), `${id}: ${item}`).toBe(path)
  })
  it('produces Inventor circuits from real copper only and rejects foreign ingredients', () => {
    const w = prepared(), machine = w.buildings[743]!
    if (machine.kind !== 'assembler') throw Error('assembler')
    expect(deliverItem(machine, 'ironPlate', 'east', w)).toBe(false)
    deliverItem(machine, 'copperPlate', 'east', w)
    for (let n = 0; n < 3; n++) deliverItem(machine, 'copperCable', 'east', w)
    run(w, 3100)
    expect(w.produced.electronicCircuit).toBe(1); expect(machine.input.copperPlate + machine.input.copperCable).toBe(0)
    expect(w.mined.iron + w.produced.ironPlate).toBe(0)
    expect(inspectBuilding(w, 743)).toMatchObject({ recipeId: 'peteCircuit', requirements: { copperPlate: 1, copperCable: 3 } })
    expect(snap(decodeSave(JSON.stringify(snap(w))).world)).toEqual(snap(w))
  })
  it('retains the Factory mixed recipe and keeps Pete-only recipes out of ordinary machines', () => {
    const w = poweredWorld(() => .5)
    placeBuilding(w, 22, 20, 'assembler', 'east')
    expect(changeCraftingRecipe(w, 22, 20, 'peteCircuit')).toContain('Pete')
    expect(changeCraftingRecipe(w, 22, 20, 'electronicCircuit')).toBeNull()
    expect(RECIPES.electronicCircuit.inputs).toEqual({ ironPlate: 1, copperCable: 3 })
    const machine = w.buildings[822]!
    if (machine.kind !== 'assembler') throw Error('assembler')
    expect(deliverItem(machine, 'copperPlate', 'east', w)).toBe(false)
    expect(deliverItem(machine, 'ironPlate', 'east', w)).toBe(true)
  })
  it('finishes a real old paid batch unchanged before adopting copper-only production, with exact saves', () => {
    const w = prepared(true), machine = w.buildings[743]!
    if (machine.kind !== 'assembler') throw Error('assembler')
    machine.input.ironPlate = 1; machine.input.copperCable = 3
    run(w, 550)
    expect(machine.job?.inputs.ironPlate).toBe(1)
    const old = snap(w); old.version = 52
    const loaded = decodeSave(JSON.stringify(old)).world
    run(w, 3000); run(loaded, 3000)
    expect(snap(loaded)).toEqual(snap(w))
    expect(machine.recipeId).toBe('peteCircuit'); expect(w.produced.electronicCircuit).toBe(1)
    expect(machine.input.ironPlate).toBe(0)
  })
  it('drains old buffered iron batches without losing stock or acquiring more iron', () => {
    const w = prepared(true), machine = w.buildings[743]!
    if (machine.kind !== 'assembler') throw Error('assembler')
    machine.input.ironPlate = 2; machine.input.copperCable = 6
    run(w, 6200)
    expect(machine.recipeId).toBe('peteCircuit'); expect(w.produced.electronicCircuit).toBe(2)
    expect(machine.input.ironPlate + machine.input.copperCable).toBe(0)
  })
  it('keeps already carried Save-52 iron and cables physical until their old delivery finishes', () => {
    const w = prepared(true), h = w.homestead!, machine = w.buildings[743]!
    if (machine.kind !== 'assembler') throw Error('assembler')
    h.carried.ironPlate = 1; h.carried.copperCable = 3; begin(w, 'feedCircuits', 743)
    const old = snap(w); old.version = 52
    const loaded = decodeSave(JSON.stringify(old)).world
    advanceWorld(w, 1000); advanceWorld(loaded, 1000)
    expect(snap(loaded)).toEqual(snap(w)); expect(machine.recipeId).toBe('electronicCircuit')
    for (let ms = 0; ms < 60000 && machine.recipeId === 'electronicCircuit'; ms += 50) advanceWorld(w, 50)
    expect(machine.recipeId).toBe('peteCircuit'); expect(w.produced.electronicCircuit).toBe(1)
    expect(h.carried.ironPlate + machine.input.ironPlate).toBe(0)
  })
  it('rejects the new recipe in old schemas and without owned Pete infrastructure', () => {
    const w = prepared(), text = snap(w), old = structuredClone(text); old.version = 52
    expect(() => decodeSave(JSON.stringify(old))).toThrow('save version 53')
    const bad = snap(createBareWorld(() => .5)); bad.game.buildings[743] = text.game.buildings[743]
    expect(() => decodeSave(JSON.stringify(bad))).toThrow('owned assembler')
    expect(snap(w)).toEqual(text)
  })
})
