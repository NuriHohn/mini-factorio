import { materialStore } from './homestead'
import { connectionComplete, infrastructureBlockage, orderTarget, wheelParts } from './infrastructure'
import { LINK_NAMES } from './infrastructureRules'
import { PATH_LABELS, PERSONALITY_PATHS } from './personality'
import type { PersonalityPath } from './personality'
import type { ProjectStatus } from './peteStatus'
import type { World } from './world'

export interface NextDevelopment { path: PersonalityPath; name: string; reason: string; target: number | null }
export function nextDevelopments(world: World, projects: ProjectStatus[]): NextDevelopment[] {
  const h = world.homestead
  if (!h) return []
  const e = h.expansion, s = h.infrastructure, store = materialStore(world)
  const step = (name: string, done: boolean, target: number | null = h.store, reason?: string) => ({ name, done, target, reason })
  const complete = (id: 'workshopProject' | 'verandaProject' | 'bicycleProject' | 'experimentProject' | 'treasureProject' | 'flightProject' | 'orchardProject' | 'coopProject' | 'gardenProject' | 'campfireProject' | 'houseProject' | 'nurseryProject' | 'project') => world[id]?.phase === 'complete'
  const orders = (path: 'eco' | 'craftsman' | 'inventor') => step(path === 'eco' ? 'Hofausbau' : path === 'inventor' ? 'Inventor-Ausbau' : 'Werkstattausbau', s[path] >= 3, orderTarget(world, path) ?? h.store, `${s[path]}/3 Ausbaustufen · ${PATH_LABELS[path]} 4 · ${path === 'eco' ? `${store?.inventory.woodenCrate ?? 0}/2 Holzkisten` : path === 'inventor' ? `${store?.inventory.copperCable ?? 0}/4 Kabel und ${store?.inventory.electronicCircuit ?? 0}/2 Schaltkreise` : `${store?.inventory.ironGear ?? 0}/4 Zahnräder`} · ${world.timeMs < s.nextOrderAtMs ? `nächster Auftrag in ${Math.ceil((s.nextOrderAtMs - world.timeMs) / 1000)} s` : 'acht Sekunden Arbeit; neue bezahlbare Grundprojekte gehen vor'}`)
  const paths = {
    eco: [step('Fence', complete('project')), step('Chicken coop', complete('coopProject')), step('Campfire', complete('campfireProject')), step('Vegetable garden', complete('gardenProject')), step('Sägewerk', h.millBuilt === 3, h.millAnchor), step('Orchard', complete('orchardProject')), step('Forststation', e.forestry !== null, e.forestry), step('Kisten-Assembler', e.assembler !== null, e.assembler), step('Wasserrad', s.wheel !== null, s.wheel?.tile ?? h.millAnchor, `${store?.wood ?? 0}/10 Holz · Eco 3 · zuerst Obstgarten, Kistenproduktion und Angelsteg · erreichbares Ufer nahe dem Hof; bis zu zwei neue Masten verbinden das bestehende Netz`), step('Angelsteg und Ruderboot', h.waterworks.dock !== null, h.waterworks.dock?.tile ?? h.store), step('Tree nursery', complete('nurseryProject')), orders('eco')],
    craftsman: [step('Eisenofen', e.furnace !== null, e.furnace), step('Workshop', complete('workshopProject')), step('Treehouse veranda', complete('verandaProject')), step('Erzförderer', e.miner !== null, e.miner), step('Zahnrad-Assembler', e.gearAssembler !== null, e.gearAssembler), step('Bicycle', complete('bicycleProject')), step('Lastenfahrrad', h.cargoBicycle, h.bikeTile ?? world.bicycleProject?.tiles[0] ?? h.store), ...(['iron', 'gearFeed', 'gearReturn'] as const).map(kind => step(LINK_NAMES[kind], s.links.some(p => p.kind === kind), kind === 'iron' ? e.furnace : e.gearAssembler, `${store?.inventory.ironPlate ?? 0}/8 Eisenplatten · vorhandenes Lastenrad${kind === 'iron' ? '' : ' und Eisenlieferung'} · freie kurze Bandstrecke, Abholgreifer und lokaler Stromanschluss; bei Platzmangel weiter persönliche Lieferungen`)), step('Treehouse annex', complete('houseProject')), orders('craftsman')],
    inventor: [step('Kupferofen', e.copperFurnace !== null, e.copperFurnace), step('Kabel-Assembler', e.cableAssembler !== null, e.cableAssembler), step('Experiment table', complete('experimentProject')), step('Treasure chest', complete('treasureProject')), step('Kupferförderer', e.copperMiner !== null, e.copperMiner), step('Schaltkreis-Assembler', e.circuitAssembler !== null, e.circuitAssembler), step('Flight workshop', complete('flightProject')), ...(['copper', 'cableFeed', 'cableReturn'] as const).map(kind => step(LINK_NAMES[kind], s.links.some(p => p.kind === kind), kind === 'copper' ? e.copperFurnace : e.cableAssembler, `${store?.inventory.copperPlate ?? 0}/8 Kupferplatten · Inventor 4 · Kupferförderer · 24 Platten bleiben vor der Flugwerkstatt reserviert · kurze freie Bandstrecke erforderlich`)), orders('inventor')],
    industrial: [step('Dampfantrieb', e.steamEngine !== null, e.steamEngine), step('Kohleförderung', e.coalMiner !== null, e.coalMiner), step('Kesselgreifer', e.coalInserter !== null, e.coalInserter), step('Kohlestampfer', e.briquetteAssembler !== null, e.briquetteAssembler), step('Dampfwerkstatt', e.steamWorkshop !== null, e.steamWorkshop), step('Förderaufzug', e.steamHoist !== null, e.steamHoist), step('Verladeplatz', s.loading !== null, e.steamHoist, `${store?.inventory.coal ?? 0}/6 Kohle als echter Anfangsvorrat · zuerst ein abgeschlossener Aufzugzyklus · zwei freie gegenüberliegende Pufferplätze`)],
  }
  return PERSONALITY_PATHS.map(path => {
    if (s.plan && path === (['copper', 'cableFeed', 'cableReturn'].includes(s.plan.kind) ? 'inventor' : 'craftsman')) {
      const part = s.plan.parts[s.built]
      const item = path === 'inventor' ? 'copperPlate' : 'ironPlate', label = path === 'inventor' ? 'Kupferplatten' : 'Eisenplatten'
      return { path, name: LINK_NAMES[s.plan.kind], reason: infrastructureBlockage(world) ?? `${s.built}/${s.plan.parts.length} Bauteile · ${h.carried[item] ? 'Material abgeholt' : `${store?.inventory[item] ?? 0}/${s.repair ? 1 : 8} ${label}`} · vier Sekunden je Bauteil`, target: part?.tile ?? s.plan.source }
    }
    if (path === 'eco' && s.wheelPlan) return { path, name: 'Wasserrad', reason: infrastructureBlockage(world) ?? `${s.built}/${wheelParts(s.wheelPlan).length} Bauteile · ${h.carried.wood ? 'Zehn Holz abgeholt' : `${store?.wood ?? 0}/10 Holz`} · vier Sekunden je Bauteil`, target: wheelParts(s.wheelPlan)[s.built]?.tile ?? s.wheelPlan.tile }
    const broken = path === 'craftsman' || path === 'inventor' ? s.links.find(p => (['copper', 'cableFeed', 'cableReturn'].includes(p.kind) ? 'inventor' : 'craftsman') === path && !connectionComplete(world, p)) : null
    if (broken) return { path, name: `Wiederaufbau: ${LINK_NAMES[broken.kind]}`, reason: `${store?.inventory[path === 'inventor' ? 'copperPlate' : 'ironPlate'] ?? 0}/1 ${path === 'inventor' ? 'Kupferplatte' : 'Eisenplatte'} je fehlendem Bauteil · ursprüngliche Strecke · persönliche Lieferungen bleiben möglich`, target: broken.parts.find(p => world.buildings[p.tile]?.kind !== p.kind)?.tile ?? broken.source }
    const chosen = paths[path].find(p => !p.done)
    if (!chosen) return { path, name: 'Entwicklung abgeschlossen', reason: 'Die vorhandenen Anlagen, Übungen und Ausflüge bleiben aktiv.', target: h.store ?? world.peace.home }
    const project = projects.find(p => p.path === path && p.name === chosen.name)
    const blockage = (h.task === 'buildConnection' && path === 'craftsman' || h.task === 'buildWheel' && path === 'eco') ? infrastructureBlockage(world) : null
    return { path, name: chosen.name, reason: blockage ?? chosen.reason ?? project?.reason ?? 'Material und Voraussetzungen stehen unter Projekte und Anforderungen.', target: chosen.target ?? h.store ?? world.peace.home }
  })
}
