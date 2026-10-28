import type { Direction } from './world'

export const LINK_KINDS = ['iron', 'gearFeed', 'gearReturn', 'copper', 'cableFeed', 'cableReturn', 'circuitFeed', 'circuitReturn', 'stampFeed', 'loadingFeed', 'loadingReturn', 'woodReturn', 'panelReturn', 'crateReturn'] as const
export type LinkKind = typeof LINK_KINDS[number]
export interface InfrastructurePart { tile: number; kind: 'belt' | 'inserter' | 'powerPole' | 'generator' | 'waterwheel'; direction: Direction }
export interface Connection { kind: LinkKind; source: number; target: number; receiver?: number; inlet?: number[]; parts: InfrastructurePart[] }
export interface WheelSite { tile: number; direction: Direction; poles: number[] }
export interface LoadingSite { input: number; output: number; pole: number }
export interface Pavilion { tile: number; spot: number; stage: number; repair: boolean }
export interface Infrastructure {
  pavilion: Pavilion | null
  links: Connection[]
  plan: Connection | null
  built: number
  repair: boolean
  wheel: WheelSite | null
  wheelPlan: WheelSite | null
  eco: number
  craftsman: number
  industrial: number
  cargoCycles: number
  inventor: number
  loading: LoadingSite | null
  loadingPlan: LoadingSite | null
  loadingCargo: 'coal' | 'coalBriquette' | null
  order: 'eco' | 'craftsman' | 'inventor' | 'industrial' | null
  nextOrderAtMs: number
}
export function createInfrastructure(): Infrastructure { return { pavilion: null, industrial: 0, cargoCycles: 0, links: [], plan: null, built: 0, repair: false, wheel: null, wheelPlan: null, eco: 0, craftsman: 0, inventor: 0, loading: null, loadingPlan: null, loadingCargo: null, order: null, nextOrderAtMs: 0 } }
export const LINK_NAMES: Record<LinkKind, string> = { iron: 'Eisenlieferung zum Lager', gearFeed: 'Plattenzufuhr für Zahnräder', gearReturn: 'Zahnradlieferung zum Lager', copper: 'Kupferlieferung zum Lager', cableFeed: 'Plattenzufuhr für Kabel', cableReturn: 'Kabellieferung zum Lager', circuitFeed: 'Zutaten für Schaltkreise', circuitReturn: 'Schaltkreise zum Lager', stampFeed: 'Kohle zum Stampfer', loadingFeed: 'Briketts zum Aufzug', loadingReturn: 'Verladefracht zum Kessellager', woodReturn: 'Forstholz zum Lager', panelReturn: 'Holzplatten zum Lager', crateReturn: 'Holzkisten zum Lager' }
export function copperLink(kind: LinkKind): boolean { return kind === 'copper' || kind === 'cableFeed' || kind === 'cableReturn' || kind === 'circuitFeed' || kind === 'circuitReturn' }
export function feedLink(kind: LinkKind): boolean { return kind === 'gearFeed' || kind === 'cableFeed' || kind === 'circuitFeed' || kind === 'stampFeed' }
export function industrialLink(kind: LinkKind): boolean { return kind === 'stampFeed' || kind === 'loadingFeed' || kind === 'loadingReturn' }
export function ecoLink(kind: LinkKind): boolean { return kind === 'woodReturn' || kind === 'panelReturn' || kind === 'crateReturn' }
export function linkCurrency(kind: LinkKind) { return ecoLink(kind) ? 'wood' : industrialLink(kind) ? 'coal' : copperLink(kind) ? 'copperPlate' : 'ironPlate' }
export function linkCost(kind: LinkKind): number { return industrialLink(kind) || ecoLink(kind) ? 6 : 8 }
export function linkMaterial(kind: LinkKind): 'ironPlate' | 'ironGear' | 'copperPlate' | 'copperCable' | 'electronicCircuit' | 'coal' | 'coalBriquette' | 'wood' | 'woodPanel' | 'woodenCrate' { return kind === 'woodReturn' ? 'wood' : kind === 'panelReturn' ? 'woodPanel' : kind === 'crateReturn' ? 'woodenCrate' : kind === 'stampFeed' ? 'coal' : industrialLink(kind) ? 'coalBriquette' : kind === 'circuitFeed' ? 'ironPlate' : kind === 'circuitReturn' ? 'electronicCircuit' : kind === 'gearReturn' ? 'ironGear' : kind === 'cableReturn' ? 'copperCable' : copperLink(kind) ? 'copperPlate' : 'ironPlate' }
