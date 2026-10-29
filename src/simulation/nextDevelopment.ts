import { loadingParts } from './loading'
import type { RebuildOwner } from './rebuilding'
import { IMPROVEMENTS, IMPROVEMENT_RULES } from './homesteadExpansion'
import { INDUSTRIAL_CHAINS } from './industrialRules'
import { XP_THRESHOLDS } from './personality'
import { currentProject } from './secretProject'
import { PROJECT_NAMES } from './peteStatus'
import { PETE_PROJECTS, retiredIndustrial } from './projectRegistry'
import { developmentOverview } from './developmentOverview'
import { copperLink, industrialLink, ecoLink, linkCurrency, linkCost } from './infrastructureRules'
import { materialStore } from './homestead'
import { connectionComplete, infrastructureBlockage, orderTarget, wheelParts, partComplete } from './infrastructure'
import { LINK_NAMES } from './infrastructureRules'
import { PATH_LABELS, PERSONALITY_PATHS } from './personality'
import type { PersonalityPath } from './personality'
import type { ProjectStatus } from './peteStatus'
import type { World } from './world'

function repairPath(owner: RebuildOwner): PersonalityPath | null {
  if (owner.type === 'project') return PETE_PROJECTS.find(p => p.id === owner.id)!.path
  if (owner.type === 'chain') {
    const kind = owner.plan.kind
    if (kind === 'steam' || INDUSTRIAL_CHAINS.some(k => k === kind)) return 'industrial'
    if (['copper', 'copperMining', 'cables', 'circuits'].includes(kind)) return 'inventor'
    return ['iron', 'ironMining', 'gears'].includes(kind) ? 'craftsman' : 'eco'
  }
  return owner.type === 'mill' || owner.type === 'prototype' ? 'eco' : null
}

export interface NextDevelopment { path: PersonalityPath; name: string; reason: string; target: number | null }
export function nextDevelopments(world: World, projects: ProjectStatus[]) {
  const h = world.homestead
  if (!h) return []
  const e = h.expansion, s = h.infrastructure, store = materialStore(world)
  const step = (name: string, done: boolean, target: number | null = h.store, reason?: string) => ({ name, done, target, reason })
  const complete = (id: 'workshopProject' | 'verandaProject' | 'bicycleProject' | 'experimentProject' | 'treasureProject' | 'flightProject' | 'orchardProject' | 'coopProject' | 'gardenProject' | 'campfireProject' | 'houseProject' | 'nurseryProject' | 'project') => world[id]?.phase === 'complete'
  const orders = (path: 'eco' | 'craftsman' | 'inventor' | 'industrial') => step(path === 'eco' ? 'Hofausbau' : path === 'inventor' ? 'Inventor-Ausbau' : path === 'industrial' ? 'Industrial-Ausbau' : 'Werkstattausbau', s[path] >= 3, orderTarget(world, path) ?? h.store, `${s[path]}/3 Ausbaustufen · ${PATH_LABELS[path]} ${path === 'industrial' ? 5 : 4} · ${path === 'eco' ? `${store?.inventory.woodenCrate ?? 0}/2 Holzkisten` : path === 'industrial' ? `6 Briketts · acht Brennstoff Reserve · ${s.cargoCycles}/10 echte Frachttransporte` : path === 'inventor' ? `${store?.inventory.copperCable ?? 0}/4 Kabel und ${store?.inventory.electronicCircuit ?? 0}/2 Schaltkreise` : `${store?.inventory.ironGear ?? 0}/4 Zahnräder`} · ${world.timeMs < s.nextOrderAtMs ? `nächster Auftrag in ${Math.ceil((s.nextOrderAtMs - world.timeMs) / 1000)} s` : 'acht Sekunden Arbeit; neue bezahlbare Grundprojekte gehen vor'}`)
  const paths = {
    eco: [step('Fence', complete('project')), step('Chicken coop', complete('coopProject')), step('Campfire', complete('campfireProject')), step('Vegetable garden', complete('gardenProject')), step('Sägewerk', h.millBuilt === 3, h.millAnchor), step('Orchard', complete('orchardProject')), step('Forststation', e.forestry !== null, e.forestry), step('Kisten-Assembler', e.assembler !== null, e.assembler), step('Wasserrad', s.wheel !== null, s.wheel?.tile ?? h.millAnchor, `${store?.wood ?? 0}/10 Holz · Eco 3 · zuerst Obstgarten, Kistenproduktion und Angelsteg · erreichbares Ufer nahe dem Hof; bis zu zwei neue Masten verbinden das bestehende Netz`), step('Angelsteg und Ruderboot', h.waterworks.dock !== null, h.waterworks.dock?.tile ?? h.store), step('Tree nursery', complete('nurseryProject')), orders('eco'), ...(['woodReturn', 'panelReturn', 'crateReturn'] as const).map(kind => step(LINK_NAMES[kind], s.links.some(p => p.kind === kind), kind === 'woodReturn' ? e.forestry : kind === 'panelReturn' ? h.millAnchor : e.assembler, `Eco 4 · 6 Holz Baukosten${kind === 'woodReturn' ? '' : '; 12 Holz bleiben reserviert'} · kurze freie Strecke · persönliche Lieferungen bei Ausfällen`)), step('Obstgarten-Pavillon', s.pavilion?.stage === 3, s.pavilion?.tile ?? world.orchardProject?.tiles[0] ?? h.store, `Eco 5 · Hofausbau 3/3 · acht tatsächlich produzierte Holzkisten · ${s.pavilion?.stage ?? 0}/3 Stufen · je 4 Holzplatten und 2 Holzkisten · 12 Holz Reserve`)],
    craftsman: [step('Eisenofen', e.furnace !== null, e.furnace), step('Workshop', complete('workshopProject')), step('Treehouse veranda', complete('verandaProject')), step('Erzförderer', e.miner !== null, e.miner), step('Zahnrad-Assembler', e.gearAssembler !== null, e.gearAssembler), step('Bicycle', complete('bicycleProject')), step('Lastenfahrrad', h.cargoBicycle, h.bikeTile ?? world.bicycleProject?.tiles[0] ?? h.store), ...(['iron', 'gearFeed', 'gearReturn'] as const).map(kind => step(LINK_NAMES[kind], s.links.some(p => p.kind === kind), kind === 'iron' ? e.furnace : e.gearAssembler, `${store?.inventory.ironPlate ?? 0}/8 Eisenplatten · vorhandenes Lastenrad${kind === 'iron' ? '' : ' und Eisenlieferung'} · freie kurze Bandstrecke, Abholgreifer und lokaler Stromanschluss; bei Platzmangel weiter persönliche Lieferungen`)), step('Treehouse annex', complete('houseProject')), orders('craftsman')],
    inventor: [step('Kupferofen', e.copperFurnace !== null, e.copperFurnace), step('Kabel-Assembler', e.cableAssembler !== null, e.cableAssembler), step('Experiment table', complete('experimentProject')), step('Treasure chest', complete('treasureProject')), step('Kupferförderer', e.copperMiner !== null, e.copperMiner), step('Schaltkreis-Assembler', e.circuitAssembler !== null, e.circuitAssembler), step('Flight workshop', complete('flightProject')), ...(['copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn'] as const).map(kind => step(LINK_NAMES[kind], s.links.some(p => p.kind === kind), kind === 'circuitFeed' || kind === 'circuitReturn' ? e.circuitAssembler : kind === 'copper' ? e.copperFurnace : e.cableAssembler, `${store?.inventory.copperPlate ?? 0}/8 Kupferplatten · Inventor 4 · Kupferförderer · 24 Platten bleiben vor der Flugwerkstatt reserviert · kurze freie Bandstrecke erforderlich`)), orders('inventor')],
    industrial: [step('Dampfantrieb', e.steamEngine !== null, e.steamEngine), step('Kohleförderung', e.coalMiner !== null, e.coalMiner), step('Kesselgreifer', e.coalInserter !== null, e.coalInserter), step('Kohlestampfer', e.briquetteAssembler !== null, e.briquetteAssembler), step('Dampfwerkstatt', e.steamWorkshop !== null, e.steamWorkshop), step('Förderaufzug', e.steamHoist !== null, e.steamHoist), step('Verladeplatz', s.loading !== null, e.steamHoist, `${store?.inventory.coal ?? 0}/6 Kohle als echter Anfangsvorrat · zuerst ein abgeschlossener Aufzugzyklus · zwei freie Pufferplätze in Reichweite`), ...(['stampFeed', 'loadingFeed', 'loadingReturn'] as const).map(kind => step(LINK_NAMES[kind], s.links.some(p => p.kind === kind), kind === 'stampFeed' ? e.briquetteAssembler : e.steamHoist, `${store?.inventory.coal ?? 0}/6 Kohle Baukosten · Kesselreserve acht Brennstoff · kurze freie Strecke; persönliche Lieferungen bei Ausfällen`)), orders('industrial')],
  }
  // Include every finite original project; recurring care is never a completion goal.
  for (const definition of PETE_PROJECTS) {
    if (definition.repeatable || retiredIndustrial(world, definition)) continue
    if (!paths[definition.path].some(p => p.name === PROJECT_NAMES[definition.id])) {
      const saved = world[definition.state]
      paths[definition.path].push(step(PROJECT_NAMES[definition.id], saved?.phase === 'complete', saved?.tiles[0] ?? h.store))
    }
  }
  paths.eco.push(step('Lagerdach', (store?.storeTier ?? 0) > 0, h.store, 'Acht Holzplatten aus dem eigenen Sägewerk.'))
  for (const id of IMPROVEMENTS) paths.eco.push(step(IMPROVEMENT_RULES[id].label, e.improvements[id] !== undefined, e.improvements[id] ?? (id === 'coopAwning' ? world.coopProject?.tiles[0] : id === 'storeShelves' ? h.store : world.gardenProject?.tiles[0]) ?? h.store))
  const linkPath = (kind: Parameters<typeof ecoLink>[0]) => ecoLink(kind) ? 'eco' : industrialLink(kind) ? 'industrial' : copperLink(kind) ? 'inventor' : 'craftsman'

  return PERSONALITY_PATHS.map(path => {
    const repair = world.rebuilding?.jobs.find(j => repairPath(j.owner) === path || repairPath(j.owner) === null)
    if (repair) return { path, name: 'Wiederaufbau', reason: 'Ein vorhandenes Bauteil fehlt. Bezahlte Arbeit und erreichte Entwicklung bleiben erhalten.', target: repair.tile }
    const missingWheel = path === 'eco' && s.wheel ? wheelParts(s.wheel).find(p => !partComplete(world, p)) : null
    if (missingWheel) return { path, name: 'Wiederaufbau: Wasserrad', reason: 'Ein ursprüngliches Rad- oder Mastbauteil fehlt; erreichte Entwicklung bleibt erhalten.', target: missingWheel.tile }
    const missingLoading = path === 'industrial' && s.loading ? loadingParts(s.loading).find(p => world.buildings[p.tile]?.kind !== p.kind) : null
    if (missingLoading) return { path, name: 'Wiederaufbau: Verladeplatz', reason: 'Ein ursprünglicher Frachtpuffer oder Mast fehlt; erreichte Entwicklung bleibt erhalten.', target: missingLoading.tile }
    const dock = path === 'eco' ? h.waterworks.dock : null
    if (dock && world.buildings[dock.tile]?.kind !== 'fishingDock') return { path, name: 'Wiederaufbau: Angelsteg', reason: 'Der ursprüngliche Angelsteg fehlt; erreichte Entwicklung bleibt erhalten.', target: dock.tile }


    if (path === 'eco' && (h.task === 'buildPavilion' || s.pavilion && s.pavilion.stage > 0 && world.buildings[s.pavilion.tile]?.kind !== 'petePavilion')) return { path, name: 'Obstgarten-Pavillon', reason: s.pavilion!.repair || h.task !== 'buildPavilion' ? 'Wiederaufbau am ursprünglichen Ort; bezahlte Stufen und Erfahrung bleiben erhalten.' : `${s.pavilion!.stage}/3 Stufen · acht Sekunden Arbeit · bezahltes Material bleibt erhalten.`, target: s.pavilion!.tile }
    if (s.plan && path === linkPath(s.plan.kind)) {
      const part = s.plan.parts[s.built]
      const item = linkCurrency(s.plan.kind), label = item === 'wood' ? 'Holz' : item === 'coal' ? 'Kohle' : item === 'copperPlate' ? 'Kupferplatten' : 'Eisenplatten'
      return { path, name: LINK_NAMES[s.plan.kind], reason: infrastructureBlockage(world) ?? `${s.built}/${s.plan.parts.length} Bauteile · ${h.carried[item] ? 'Material abgeholt' : `${(item === 'wood' ? store?.wood : store?.inventory[item]) ?? 0}/${s.repair ? 1 : linkCost(s.plan.kind)} ${label}`} · vier Sekunden je Bauteil`, target: part?.tile ?? s.plan.source }
    }
    if (s.order === path) { const order = orders(path); return { path, name: order.name, reason: order.reason ?? 'Bezahlter Ausbauauftrag wird fortgesetzt.', target: order.target } }
    if (path === 'eco' && s.wheelPlan) return { path, name: 'Wasserrad', reason: infrastructureBlockage(world) ?? `${s.built}/${wheelParts(s.wheelPlan).length} Bauteile · ${h.carried.wood ? 'Zehn Holz abgeholt' : `${store?.wood ?? 0}/10 Holz`} · vier Sekunden je Bauteil`, target: wheelParts(s.wheelPlan)[s.built]?.tile ?? s.wheelPlan.tile }
    const broken = s.links.find(p => linkPath(p.kind) === path && !connectionComplete(world, p))
    if (broken) return { path, name: `Wiederaufbau: ${LINK_NAMES[broken.kind]}`, reason: `${(ecoLink(broken.kind) ? store?.wood : store?.inventory[linkCurrency(broken.kind)]) ?? 0}/1 ${path === 'eco' ? 'Holz' : path === 'industrial' ? 'Kohle' : path === 'inventor' ? 'Kupferplatte' : 'Eisenplatte'} je fehlendem Bauteil · ursprüngliche Strecke · persönliche Lieferungen bleiben möglich`, target: broken.parts.find(p => world.buildings[p.tile]?.kind !== p.kind)?.tile ?? broken.source }
    const active = currentProject(world)
    const activeDefinition = active && PETE_PROJECTS.find(p => world[p.state] === active)
    if (active && activeDefinition?.path === path && !activeDefinition.repeatable) return { path, name: PROJECT_NAMES[activeDefinition.id], reason: projects.find(p => p.id === activeDefinition.id)?.reason ?? 'Begonnenes Projekt wird fortgesetzt.', target: active.tiles[active.built] ?? active.tiles[0] }
    const chosen = paths[path].find(p => !p.done)
    if (!chosen) return world.personality.paths[path].level < XP_THRESHOLDS.length
      ? { path, name: 'Level 5 erreichen', reason: `${world.personality.paths[path].xp}/${XP_THRESHOLDS.at(-1)} XP · vorhandene Arbeit, Übungen und Ausflüge entwickeln Pete weiter.`, target: h.store ?? world.peace.home }
      : { path, name: 'Entwicklung abgeschlossen', reason: 'Level 5 und alle vorgesehenen Bauprojekte erreicht. Versorgung, Übungen und Ausflüge bleiben aktiv; weitere XP schalten keine neuen Stufen frei.', target: h.store ?? world.peace.home }
    const project = projects.find(p => p.path === path && p.name === chosen.name)
    const definition = PETE_PROJECTS.find(p => p.id === project?.id), original = definition ? world[definition.state] : null
    const blockage = (h.task === 'buildConnection' && path === 'craftsman' || h.task === 'buildWheel' && path === 'eco') ? infrastructureBlockage(world) : null
    return { path, name: chosen.name, reason: blockage ?? chosen.reason ?? project?.reason ?? 'Material und Voraussetzungen stehen unter Projekte und Anforderungen.', target: original?.tiles[original.built] ?? chosen.target ?? h.store ?? world.peace.home }
  }).map(step => {
    const goals = paths[step.path], level = world.personality.paths[step.path].level
    const overview = developmentOverview(world, step, projects)
    return { ...overview, completion: { level, maxLevel: XP_THRESHOLDS.length, finished: goals.filter(p => p.done).length, total: goals.length, state: overview.phase === 'Wiederaufbau' ? 'rebuilding' : goals.every(p => p.done) && level === XP_THRESHOLDS.length ? 'complete' : 'developing' } }
  })
}
