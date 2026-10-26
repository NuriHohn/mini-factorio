import { advanceRebuilding, chooseRebuild, rebuildCost } from './rebuilding'
import { resourcePreference } from './resourcePreference'
import { describe, expect, it } from 'vitest'
import { createPetesWorld, placeCoal } from './petesWorld'
import { advanceWorld } from './step'
import { decodeSave, encodeSave } from '../persistence/saveGame'
import { materialStore } from './homestead'
import { emptyInventory } from './items'
import { awardActivity } from './personality'
import { removeBuilding, placeBuilding } from './world'
import { chooseExpansion, advanceExpansion, expansionLayout } from './homesteadExpansion'
import { allocatePower } from './power'
import { deliverItem, canReceive } from './transport'
import { changeCraftingRecipe } from './crafting'
import type { World } from './world'
const view = { scrollX: 0, scrollY: 0, zoom: 1, direction: 'east' as const, powerOverlay: false }
const snapshot = (w: World) => JSON.parse(encodeSave(w, view, '2026-10-26T00:00:00.000Z'))
const load = (w: World) => decodeSave(JSON.stringify(snapshot(w))).world
function stored() {
  const w = createPetesWorld()
  w.buildings[900] = { kind: 'supplyCrate', x: 20, y: 22, wood: 0, inventory: emptyInventory(), storeTier: 0 }; w.homestead!.store = 900
  placeBuilding(w, 26, 17, 'steamEngine', 'east'); w.homestead!.expansion.steamEngine = 706
  placeBuilding(w, 26, 16, 'powerPole', 'east')
  const engine = w.buildings[706]!
  if (engine.kind !== 'steamEngine') throw new Error('engine missing')
  engine.fuel = 6
  awardActivity(w.personality, { path: 'industrial', xp: 80 })
  materialStore(w)!.inventory.coal = 24
  return w
}
function build(w: World) {
  const plan = structuredClone(w.homestead!.expansion.plan)!
  for (let i = 0; i < 5000 && w.homestead!.expansion.plan; i++) { w.timeMs += 50; advanceExpansion(w, 50) }
  expect(w.homestead!.expansion.plan, JSON.stringify(w.homestead)).toBeNull()
  expect(expansionLayout(plan).every(p => w.buildings[p.tile]?.kind === p.kind)).toBe(true)
  return plan
}
describe('Industrial coal automation and driven work', () => {
  it('builds a steam-powered bounded coal depot/mine and ordinary boiler inserter, preserving partial work', () => {
    const w = stored(), h = w.homestead!, e = h.expansion
    placeCoal(w, 26, 20)
    expect(chooseExpansion(w, 'industrial')).toBe(true); expect(e.plan?.kind).toBe('coalMining')
    for (let i = 0; i < 1500 && e.plan?.built === 0; i++) { w.timeMs += 50; advanceExpansion(w, 50) }
    expect(load(w).homestead).toEqual(h)
    build(w)
    expect(e.coalMiner).not.toBeNull(); expect(e.fuelStore).not.toBeNull()
    for (let i=0;i<300 && h.task;i++) { w.timeMs += 50; advanceExpansion(w,50) }
    expect(chooseExpansion(w, 'industrial')).toBe(true); expect(e.plan?.kind).toBe('coalFeed'); build(w)
    advanceWorld(w, 20000)
    expect(w.mined.coal).toBeGreaterThan(0)
    const engine = w.buildings[e.steamEngine!]
    expect(engine?.kind === 'steamEngine' && engine.fuel >= 5).toBe(true)
    expect(w.buildings[e.coalInserter!]?.kind).toBe('inserter')
    expect(load(w).homestead).toEqual(h)
  })
  it('conserves the fuel energy of a two-coal briquette and respects shared capacity', () => {
    const w = createPetesWorld()
    placeBuilding(w, 24, 20, 'steamEngine', 'east')
    const e = w.buildings[824]!
    if (e.kind !== 'steamEngine') throw new Error('engine missing')
    expect(deliverItem(e, 'coalBriquette', 'east')).toBe(true)
    advanceWorld(w, 19950)
    expect(e).toMatchObject({ briquettes: 0, burnRemainingMs: 50, cycles: 0 })
    advanceWorld(w, 50); expect(e.cycles).toBe(1)
    expect(e.burnRemainingMs).toBe(0)
    e.fuel = 5; expect(canReceive(e, 'coalBriquette', 'east', { coal: 1 })).toBe(false)
    placeBuilding(w, 26, 20, 'fuelDepot', 'east')
    const depot = w.buildings[826]!
    for (let i=0;i<24;i++) expect(deliverItem(depot, 'coal', 'east')).toBe(true)
    expect(deliverItem(depot, 'coalBriquette', 'east')).toBe(false)
    expect(deliverItem(depot, 'iron', 'east')).toBe(false)
  })
  it('runs the normal briquette recipe on real steam power with exact saved input/job accounting', () => {
    const w = stored()
    placeBuilding(w, 24, 17, 'assembler', 'east'); changeCraftingRecipe(w, 24,17,'coalBriquette')
    const machine = w.buildings[704]!
    if(machine.kind !== 'assembler') throw new Error('missing machine')
    machine.input.coal = 2
    allocatePower(w); advanceWorld(w, 2050)
    expect(machine.job?.inputs.coal).toBe(2); expect(machine.output.coalBriquette).toBe(0)
    const restored = load(w)
    advanceWorld(w, 7000); advanceWorld(restored,7000)
    expect(snapshot(restored)).toEqual(snapshot(w))
    expect(w.produced.coalBriquette).toBe(1)
  })
  it('advances workshop and hoist only with delivered steam energy, including partial supply and sabotage', () => {
    const w = stored()
    placeBuilding(w, 24,17,'steamWorkshop','east'); placeBuilding(w,25,18,'steamHoist','east')
    const workshop=w.buildings[704]!, hoist=w.buildings[745]!, engine=w.buildings[706]!
    if(workshop.kind !== 'steamWorkshop' || hoist.kind !== 'steamHoist' || engine.kind !== 'steamEngine') throw new Error('missing work')
    w.homestead!.expansion.steamWorkshop=704; w.homestead!.expansion.steamHoist=745
    engine.fuel=0
    advanceWorld(w, 1000); expect(workshop.elapsedMs+hoist.elapsedMs).toBe(0)
    placeBuilding(w,27,16,'generator','east')
    advanceWorld(w, 1000); expect(workshop.elapsedMs+hoist.elapsedMs).toBe(0)
    engine.fuel=2; advanceWorld(w, 3000)
    expect(workshop.elapsedMs).toBeGreaterThan(0); expect(workshop.elapsedMs).toBeLessThan(3000)
    workshop.sabotageUntilMs=w.timeMs+1000; const before=workshop.elapsedMs
    advanceWorld(w,500);expect(workshop.elapsedMs).toBe(before)
    const restored=load(w);advanceWorld(w,18000);advanceWorld(restored,18000)
    expect(snapshot(restored)).toEqual(snapshot(w));expect(workshop.cycles).toBeGreaterThan(0)
  })
  it('reaches an operating Industrial-5 hoist from coal alone without manufactured metal', () => {
    const w=createPetesWorld();placeCoal(w,26,18)
    for(let t=0;t<7200000;t+=250) {
      advanceWorld(w,250)
      const e=w.homestead!.expansion, hoist=e.steamHoist === null ? null : w.buildings[e.steamHoist]
      if(hoist?.kind==='steamHoist' && hoist.cycles>0) break
    }
    const e=w.homestead!.expansion
    expect(e.steamHoist,JSON.stringify({h:w.homestead,levels:w.personality.paths,store:materialStore(w),produced:w.produced,buildings:w.buildings.filter(b=>b && !['treehouse','supplyCrate'].includes(b.kind))})).not.toBeNull()
    const hoist=e.steamHoist === null ? null : w.buildings[e.steamHoist]
    expect(hoist?.kind === 'steamHoist' && hoist.cycles>0).toBe(true)
    expect(w.personality.paths.industrial.level).toBe(5)
    expect(w.mined.wood+w.mined.iron+w.mined.copper+w.produced.ironGear+w.produced.ironPlate).toBe(0)
    expect(load(w).homestead).toEqual(w.homestead)
  },60000)
  it('upgrades a genuine Save 46 engine without changing fuel, timers, stock or progression', () => {
    const w = stored(), old = snapshot(w)
    old.version = 46
    for (const key of ['coalMiner', 'fuelStore', 'coalInserter', 'briquetteAssembler', 'steamWorkshop', 'steamHoist']) delete old.game.homestead.expansion[key]
    delete old.game.buildings[706].briquettes; delete old.game.buildings[706].cycleDurationMs
    const strip = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      if (!Array.isArray(value)) delete (value as Record<string, unknown>).coalBriquette
      Object.values(value).forEach(strip)
    }
    strip(old.game)
    expect(snapshot(decodeSave(JSON.stringify(old)).world)).toEqual(snapshot(w))
    old.game.produced.coalBriquette = 1
    expect(() => decodeSave(JSON.stringify(old))).toThrow()
  })
  it('retains blocked paid coal work, bounds the depot, and rebuilds removed components without repeat build XP', () => {
    const w = stored(), h = w.homestead!, e = h.expansion
    placeCoal(w,26,20); chooseExpansion(w,'industrial')
    const parts = expansionLayout(e.plan!)
    for (let i=0;i<1500 && e.plan?.built===0;i++) { w.timeMs+=50; advanceExpansion(w,50) }
    const next = parts[e.plan!.built].tile, progress = e.plan!.built
    w.water[next] = true
    for (let i=0;i<100;i++) { w.timeMs+=50; advanceExpansion(w,50) }
    expect(e.plan!.built).toBe(progress); expect(h.carried.coal).toBe(6)
    expect(load(w).homestead).toEqual(h)
    w.water[next]=false; build(w)
    for (let i=0;i<1000 && h.task;i++) { w.timeMs+=50; advanceExpansion(w,50) }
    const depot = e.fuelStore!, index = e.coalMiner!, xp=w.personality.paths.industrial.xp
    removeBuilding(w,depot%40,Math.floor(depot/40))
    const job=w.rebuilding!.jobs.find(j=>j.tile===depot)!
    expect(rebuildCost(w,job).coal).toBe(6)
    materialStore(w)!.inventory.coal=6
    for(let i=0;i<1500 && !w.buildings[depot];i++) { chooseRebuild(w);w.timeMs+=50;advanceRebuilding(w,50);if(job.funded) expect(load(w).rebuilding).toEqual(w.rebuilding) }
    expect(w.buildings[depot]).toMatchObject({kind:'fuelDepot',inventory:{coal:6}})
    expect(materialStore(w)!.inventory.coal).toBe(0)
    removeBuilding(w,index%40,Math.floor(index/40))
    expect(rebuildCost(w,w.rebuilding!.jobs.find(j=>j.tile===index)!).coal).toBe(0)
    for(let i=0;i<1500 && !w.buildings[index];i++) { chooseRebuild(w);w.timeMs+=50;advanceRebuilding(w,50) }
    expect(w.buildings[index]?.kind).toBe('miner')
    expect(w.personality.paths.industrial.xp).toBe(xp)
    expect(resourcePreference(w,'industrial')).toBeGreaterThan(1)
  })
  it('rejects invalid depot inventories, work phases, chain routes and owned port references', () => {
    const w = stored(); placeBuilding(w,24,20,'fuelDepot','east'); placeBuilding(w,24,18,'steamWorkshop','east')
    for (const mutate of [
      (s: ReturnType<typeof snapshot>) => { s.game.buildings[824].inventory.coal=25 },
      (s: ReturnType<typeof snapshot>) => { s.game.buildings[824].inventory.iron=1 },
      (s: ReturnType<typeof snapshot>) => { s.game.buildings[744].elapsedMs=6000 },
      (s: ReturnType<typeof snapshot>) => { s.game.homestead.expansion.coalInserter=824 },
      (s: ReturnType<typeof snapshot>) => { s.game.buildings[706].briquettes=1 }
    ]) { const s=snapshot(w);mutate(s);expect(()=>decodeSave(JSON.stringify(s))).toThrow() }
  })

  it('leaves output unchanged when external deliveries fill the briquette target during a pickup trip', () => {
    const w = stored(), h = w.homestead!
    placeBuilding(w,24,17,'assembler','east');changeCraftingRecipe(w,24,17,'coalBriquette')
    h.expansion.briquetteAssembler=704
    const machine=w.buildings[704]!
    if(machine.kind!=='assembler') throw new Error('missing stampfer')
    machine.output.coalBriquette=1
    materialStore(w)!.inventory.coalBriquette=9
    h.task='takeBriquettes';h.target=704
    for(let i=0;i<1000 && h.task;i++) { w.timeMs+=50;advanceExpansion(w,50) }
    expect(machine.output.coalBriquette).toBe(1)
    expect(h.carried.coalBriquette).toBe(0)
    expect(materialStore(w)!.inventory.coalBriquette).toBe(9)
  })

  it.each([
    { chain: 'briquettes', key: 'briquetteAssembler', kind: 'assembler', tile: 704 },
    { chain: 'steamWorkshop', key: 'steamWorkshop', kind: 'steamWorkshop', tile: 702 },
    { chain: 'steamHoist', key: 'steamHoist', kind: 'steamHoist', tile: 701 }
  ] as const)('restores the original $chain hardware and recipe without another build reward', ({key,kind,tile}) => {
    const w=stored(), e=w.homestead!.expansion
    placeBuilding(w,tile%40,Math.floor(tile/40),kind,'east')
    placeBuilding(w,tile%40,Math.floor(tile/40)-1,'powerPole','east')
    e[key]=tile
    if(kind==='assembler') changeCraftingRecipe(w,tile%40,Math.floor(tile/40),'coalBriquette')
    const xp=w.personality.paths.industrial.xp
    removeBuilding(w,tile%40,Math.floor(tile/40))
    const job=w.rebuilding!.jobs.find(j=>j.tile===tile)!
    expect(rebuildCost(w,job).coal).toBe(0)
    for(let i=0;i<1500 && !w.buildings[tile];i++) { chooseRebuild(w);w.timeMs+=50;advanceRebuilding(w,50) }
    expect(w.buildings[tile]?.kind).toBe(kind)
    if(kind==='assembler') expect(w.buildings[tile]).toMatchObject({recipeId:'coalBriquette'})
    expect(w.personality.paths.industrial.xp).toBe(xp)
    expect(load(w).homestead!.expansion[key]).toBe(tile)
  })

})
