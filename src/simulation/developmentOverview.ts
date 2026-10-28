import { chainCost, expansionLayout } from './homesteadExpansion'
import type { ChainKind } from './homesteadExpansion'
import { LINK_KINDS, LINK_NAMES, linkCost, linkCurrency } from './infrastructureRules'
import { ITEM_DEFINITIONS } from './items'
import { materialStore } from './homestead'
import type { ProjectMaterial } from './projectRegistry'
import { PETE_PROJECTS } from './projectRegistry'
import { currentProject, projectResources } from './secretProject'
import type { NextDevelopment } from './nextDevelopment'
import type { ProjectStatus } from './peteStatus'
import type { World } from './world'

const CHAINS: Record<string, ChainKind> = { Forststation: 'forestry', 'Kisten-Assembler': 'crates', Eisenofen: 'iron', Erzförderer: 'ironMining', 'Zahnrad-Assembler': 'gears', Kupferofen: 'copper', 'Kabel-Assembler': 'cables', Kupferförderer: 'copperMining', 'Schaltkreis-Assembler': 'circuits', Dampfantrieb: 'steam', Kohleförderung: 'coalMining', Kesselgreifer: 'coalFeed', Kohlestampfer: 'briquettes', Dampfwerkstatt: 'steamWorkshop', Förderaufzug: 'steamHoist' }
// A copied, read-only summary. Costs come from the same rules used at payment time.
export function developmentOverview(world: World, step: NextDevelopment, projects: ProjectStatus[]) {
  const h = world.homestead!, s = h.infrastructure, store = materialStore(world)
  const project = projects.find(p => p.path === step.path && p.name === step.name)
  const definition = PETE_PROJECTS.find(d => d.id === project?.id)
  const saved = definition ? world[definition.state] : null
  const active = currentProject(world)
  const kind = s.plan && step.name === LINK_NAMES[s.plan.kind] ? s.plan.kind : LINK_KINDS.find(k => step.name.endsWith(LINK_NAMES[k]))
  const link = s.links.find(p => p.kind === kind)
  const pavilion = step.name === 'Obstgarten-Pavillon'
  const chain = h.expansion.plan && CHAINS[step.name] === h.expansion.plan.kind ? h.expansion.plan : null
  const order = s.order === step.path && step.name.toLowerCase().endsWith('ausbau')
  const building = order || saved?.phase === 'building' || kind && s.plan?.kind === kind || pavilion && h.task === 'buildPavilion' || step.name === 'Wasserrad' && !!s.wheelPlan || !!h.expansion.plan && CHAINS[step.name] === h.expansion.plan.kind
  const repair = step.name.startsWith('Wiederaufbau:') || pavilion && !!s.pavilion?.stage && world.buildings[s.pavilion.tile]?.kind !== 'petePavilion'
  const costs: Partial<Record<ProjectMaterial, number>> = kind ? { [linkCurrency(kind)]: repair ? 1 : linkCost(kind) } : pavilion ? { woodPanel: 4, woodenCrate: 2, wood: 12 } : CHAINS[step.name] ? chainCost(CHAINS[step.name]) : step.name === 'Sägewerk' ? { wood: 12 } : step.name === 'Wasserrad' ? { wood: 10 } : saved ? projectResources(saved) : definition ? definition.resources : step.name === 'Hofausbau' ? { woodenCrate: 2 } : step.name === 'Werkstattausbau' ? { ironGear: 4 } : step.name === 'Inventor-Ausbau' ? { copperCable: 4, electronicCircuit: 2 } : step.name === 'Industrial-Ausbau' ? { coalBriquette: 6 } : {}
  const garden = world.gardenProject?.phase === 'complete' ? world.buildings[world.gardenProject.tiles[0]] : null
  const source = saved?.crate !== null && saved?.crate !== undefined ? world.buildings[saved.crate] : store
  const paid = saved?.phase === 'building' || building && Object.values(h.carried).some(n => n > 0)
  const missing = Object.entries(costs).flatMap(([key, amount]) => {
    const item = key as ProjectMaterial, available = item === 'chickenFeed' ? (garden?.kind === 'peteGarden' ? garden.feed ?? 0 : 0) : item === 'fruit' ? world.developmentLife?.fruit ?? 0 : item === 'sapling' ? world.developmentLife?.saplings ?? 0 : source?.kind === 'supplyCrate' ? item === 'wood' ? source.wood : source.inventory[item] : 0
    const reserve = kind && linkCurrency(kind) === 'wood' && kind !== 'woodReturn' && !repair ? 12 : 0
    const shortage = Math.max(0, amount + reserve - available)
    return !paid && shortage ? [`${shortage} ${item === 'chickenFeed' ? 'Hühnerfutter' : item === 'fruit' ? 'Fruit' : item === 'sapling' ? 'Sapling' : ITEM_DEFINITIONS[item].label}${reserve ? ' einschließlich Reserve' : ''}`] : []
  })
  const completed = step.name === 'Entwicklung abgeschlossen'
  const progress = kind && s.plan?.kind === kind ? `${s.built}/${s.plan.parts.length} Bauteile` : pavilion ? `${s.pavilion?.stage ?? 0}/3 Stufen · ${h.task === 'buildPavilion' ? h.elapsedMs / 1000 : 0}/8 s` : saved ? `${saved.built}/${saved.tiles.length} Bauteile` : building ? `${h.elapsedMs / 1000} s Arbeit` : completed ? 'Alle geplanten Ausbauten stehen' : 'Nächster offener Schritt'
  let blockage: string | null = null
  if (!store && !completed) blockage = 'Ein erreichbares Materiallager fehlt.'
  else if (building && !missing.length && kind && s.plan) {
    const part = s.plan.parts[s.built]
    if (part && (world.water[part.tile] || world.buildings[part.tile])) blockage = 'Das nächste Bauteil ist belegt oder liegt im Wasser; bezahltes Material bleibt erhalten.'
  } else if (pavilion && (world.orchardProject?.phase !== 'complete' || world.buildings[world.orchardProject.tiles[0]]?.kind !== 'peteDevelopment')) blockage = 'Der Obstgarten fehlt; bezahltes Pavillonmaterial bleibt erhalten.'
  else if (pavilion && s.pavilion && (world.water[s.pavilion.tile] || world.buildings[s.pavilion.tile] && world.buildings[s.pavilion.tile]?.kind !== 'petePavilion')) blockage = 'Der Pavillon-Bauplatz ist blockiert; bezahltes Material bleibt erhalten.'
  else if (pavilion && world.personality.paths.eco.level < 5) blockage = 'Eco Level 5 fehlt.'
  else if (pavilion && s.eco < 3) blockage = `Zuerst Hofausbau ${s.eco}/3 abschließen.`
  else if (pavilion && world.produced.woodenCrate < 8) blockage = `Erst ${world.produced.woodenCrate}/8 Holzkisten tatsächlich produziert.`
  else if (project && !project.ready && !missing.length && !building) blockage = project.reason
  else if (active && active !== saved && !building && !completed) blockage = 'Ein bereits begonnenes Projekt wird zuerst abgeschlossen.'
  else if (!building && !completed && !missing.length && (pavilion || step.name.toLowerCase().endsWith('ausbau')) && world.timeMs < s.nextOrderAtMs) blockage = `Nächster Auftrag in ${Math.ceil((s.nextOrderAtMs - world.timeMs) / 1000)} s.`
  if (repair && link) blockage = 'Ein Teil der ursprünglichen Verbindung fehlt oder ist verdreht.'
  return { ...step, target: chain ? expansionLayout(chain)[chain.built]?.tile ?? step.target : step.target, phase: completed ? 'Abgeschlossen' : repair ? 'Wiederaufbau' : building ? paid ? 'Bau · bezahlt' : 'Material abholen' : missing.length ? 'Material fehlt' : blockage ? 'Wartet' : 'Planung offen', progress, missing, blockage }
}
