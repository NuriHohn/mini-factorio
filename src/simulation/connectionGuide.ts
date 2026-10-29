import { connectionComplete, infrastructurePickupAllowed } from './infrastructure'
import { LINK_NAMES, feedLink, linkMaterial } from './infrastructureRules'
import { inventoryTotal, ITEM_DEFINITIONS } from './items'
import { canReceive } from './transport'
import { SIZE } from './world'
import { fuelAutomation, mainFuel } from './productionLogistics'
import type { Item } from './items'
import { steamShare } from './steamWork'
import type { World } from './world'

export function connectionGuide(world: World, index: number): { reason: string; action: string; tiles: number[]; source: number; target: number } | null {
  const s = world.homestead?.infrastructure
  const link = s && [...s.links, ...(s.plan ? [s.plan] : [])].find(p => p.source === index || p.target === index || p.parts.some(p => p.tile === index))
  if (!link) return null
  const material = linkMaterial(link.kind), source = world.buildings[link.source], target = world.buildings[link.target], armPart = link.parts.find(p => p.kind === 'inserter')!, arm = world.buildings[armPart.tile]
  const coordinate = (tile: number) => `${tile % SIZE}, ${Math.floor(tile / SIZE)}`
  const materials: Item[] = link.kind === 'circuitFeed' ? target?.kind === 'assembler' && target.recipeId === 'electronicCircuit' ? ['copperCable'] : ['copperPlate', 'copperCable'] : link.kind === 'loadingReturn' ? ['coal', 'coalBriquette'] : [material]
  const action = `${LINK_NAMES[link.kind]} · ${materials.map(item => ITEM_DEFINITIONS[item].label).join(' + ')} · Quelle (${coordinate(link.source)}) → Ziel (${coordinate(link.target)}). Persönliche Lieferungen bleiben bei Ausfällen möglich.`
  let reason = 'Die Verbindung transportiert echte Gegenstände.'
  const assignment = world.power?.assignments[armPart.tile], network = world.power?.networks.find(n => n.id === assignment)
  const available = materials.filter(item => (source?.kind === 'belt' ? Number(source.item === item) : source?.kind === 'supplyCrate' && item === 'wood' ? source.wood : source?.kind === 'supplyCrate' || source?.kind === 'fuelDepot' ? source.inventory[item] : source?.kind === 'furnace' || source?.kind === 'assembler' ? source.output[item] : 0) > 0)
  const stock = available.length
  const moving = available.find(item => infrastructurePickupAllowed(world, armPart.tile, item)) ?? material
  const tail = link.parts.at(-1)!
  if (s?.plan?.kind === link.kind) reason = `Bau oder Wiederaufbau: ${s.built}/${link.parts.length} Teile; bereits abgeholtes Material bleibt erhalten.`
  else if (!source || !target) reason = 'Quelle oder Ziel fehlt. Pete benötigt den Wiederaufbau am ursprünglichen Ort.'
  else if (!connectionComplete(world, link)) reason = 'Ein Verbindungsteil fehlt oder zeigt in die falsche Richtung.'
  else if ((arm?.sabotageUntilMs ?? 0) > world.timeMs) reason = 'Der Greifer ist vorübergehend gestoppt.'
  else if (!network?.capacityKw) reason = 'Dem Greifer fehlt ein angeschlossenes Stromnetz mit Erzeugung.'
  else if (link.kind === 'circuitFeed' && target.kind === 'assembler' && target.recipeId === 'electronicCircuit') reason = 'Vorhandene Altchargen werden mit Kabeln fertig verarbeitet; danach nur Kupferplatten und Kabel, kein neues Eisen.'
  else if (feedLink(link.kind) && target.kind === 'assembler' && target.recipeId !== (link.kind === 'circuitFeed' ? 'peteCircuit' : link.kind === 'stampFeed' ? 'coalBriquette' : link.kind === 'cableFeed' ? 'copperCable' : 'ironGear')) reason = 'Die gewählte Zielrezeptur passt nicht zur gelieferten Zutat.'
  else if (!stock && arm?.kind === 'inserter' && !arm.item && !link.parts.some(p => { const b = world.buildings[p.tile]; return b?.kind === 'belt' && !!b.item })) reason = 'An der Quelle ist noch kein passender Gegenstand zur Abholung bereit.'
  else if (stock && !available.some(item => infrastructurePickupAllowed(world, armPart.tile, item))) reason = link.kind === 'stampFeed' || link.kind === 'loadingFeed' || link.kind === 'loadingReturn' ? 'Brennstoffreserve oder Vorratsziel hat Vorrang; vorhandene Fracht bleibt erhalten.' : 'Vorratsziel erreicht oder Zutaten für andere Projekte reserviert.'
  else if (link.receiver !== undefined && world.buildings[link.receiver] && !canReceive(world.buildings[link.receiver]!, moving, tail.direction)) reason = 'Der gemeinsam genutzte Lagerzulauf wartet auf freien Platz.'
  else if (!canReceive(target, moving, tail.direction)) reason = 'Das Ziel kann derzeit nichts annehmen: Bestand, Rezept oder Eingang prüfen.'
  else if (arm?.kind === 'inserter' && (world.power?.consumers[armPart.tile]?.requestedKw ?? 0) > 0 && (world.power?.consumers[armPart.tile]?.speedFraction ?? 0) < 1) reason = 'Der Greifer erhält weniger als seine benötigte Leistung und wartet oder arbeitet langsamer.'
  return { reason, action, source: link.source, target: link.target, tiles: [link.source, ...link.parts.map(p => p.tile), ...(link.receiver === undefined ? [] : [link.receiver]), link.target] }
}
export function loadingGuide(world: World, index: number) {
  const h = world.homestead, s = h?.infrastructure, site = s?.loading ?? s?.loadingPlan
  if (!h || !s || !site || ![site.input, site.output, site.pole, h.expansion.steamHoist].includes(index)) return null
  const input = world.buildings[site.input], output = world.buildings[site.output]
  const ready = input?.kind === 'fuelDepot' ? inventoryTotal(input.inventory) : 0, stored = output?.kind === 'fuelDepot' ? inventoryTotal(output.inventory) : 0
  const hoist = h.expansion.steamHoist === null ? null : world.buildings[h.expansion.steamHoist]
  const powered = hoist?.kind === 'steamHoist' && (world.power?.consumers[h.expansion.steamHoist!]?.speedFraction ?? 0) * steamShare(world, hoist) > 0
  return { reason: s.loadingPlan ? `Bezahlter Verladeplatz: ${s.built}/3 Bauteile.` : input?.kind !== 'fuelDepot' || output?.kind !== 'fuelDepot' || world.buildings[site.pole]?.kind !== 'powerPole' ? 'Ein Verladepuffer oder Strommast fehlt; Fracht bleibt bis zum Wiederaufbau im Aufzug.' : stored >= 24 && (s.loadingCargo || ready) ? 'Ausgabepuffer voll; der Aufzug hält seine echte Fracht und den Arbeitsfortschritt.' : fuelAutomation(world) && mainFuel(world) < 8 ? 'Kesselreserve hat Vorrang; Fracht und Fortschritt bleiben erhalten.' : !powered ? 'Dem Aufzug fehlt wirksame Dampfleistung; Fracht und Fortschritt bleiben erhalten.' : s.loadingCargo ? `Im Aufzug: 1 ${ITEM_DEFINITIONS[s.loadingCargo].label}; tatsächliche Dampfleistung bewegt die Fracht.` : ready ? 'Brennstoff liegt zur nächsten Verladung bereit.' : 'Eingabepuffer leer; der Aufzug behält seine bisherige Testlast.', action: `Verladeplatz · Eingang ${ready}/24 · Ausgang ${stored}/24 · acht Sekunden tatsächliche Dampfarbeit pro Gegenstand · ${s.cargoCycles} echte Frachttransporte · Industrial-Ausbau ${s.industrial}/3.`, source: site.input, target: site.output, tiles: [site.input, h.expansion.steamHoist!, site.output, site.pole] }
}
