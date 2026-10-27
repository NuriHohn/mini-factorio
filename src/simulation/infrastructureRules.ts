import type { Direction } from './world'

export const LINK_KINDS = ['iron', 'gearFeed', 'gearReturn', 'copper', 'cableFeed', 'cableReturn'] as const
export type LinkKind = typeof LINK_KINDS[number]
export interface InfrastructurePart { tile: number; kind: 'belt' | 'inserter' | 'powerPole' | 'generator' | 'waterwheel'; direction: Direction }
export interface Connection { kind: LinkKind; source: number; target: number; receiver?: number; parts: InfrastructurePart[] }
export interface WheelSite { tile: number; direction: Direction; poles: number[] }
export interface LoadingSite { input: number; output: number; pole: number }
export interface Infrastructure {
  links: Connection[]
  plan: Connection | null
  built: number
  repair: boolean
  wheel: WheelSite | null
  wheelPlan: WheelSite | null
  eco: number
  craftsman: number
  inventor: number
  loading: LoadingSite | null
  loadingPlan: LoadingSite | null
  loadingCargo: 'coal' | 'coalBriquette' | null
  order: 'eco' | 'craftsman' | 'inventor' | null
  nextOrderAtMs: number
}
export function createInfrastructure(): Infrastructure { return { links: [], plan: null, built: 0, repair: false, wheel: null, wheelPlan: null, eco: 0, craftsman: 0, inventor: 0, loading: null, loadingPlan: null, loadingCargo: null, order: null, nextOrderAtMs: 0 } }
export const LINK_NAMES: Record<LinkKind, string> = { iron: 'Eisenlieferung zum Lager', gearFeed: 'Plattenzufuhr für Zahnräder', gearReturn: 'Zahnradlieferung zum Lager', copper: 'Kupferlieferung zum Lager', cableFeed: 'Plattenzufuhr für Kabel', cableReturn: 'Kabellieferung zum Lager' }
export function copperLink(kind: LinkKind): boolean { return kind === 'copper' || kind === 'cableFeed' || kind === 'cableReturn' }
export function feedLink(kind: LinkKind): boolean { return kind === 'gearFeed' || kind === 'cableFeed' }
export function linkMaterial(kind: LinkKind): 'ironPlate' | 'ironGear' | 'copperPlate' | 'copperCable' { return kind === 'gearReturn' ? 'ironGear' : kind === 'cableReturn' ? 'copperCable' : copperLink(kind) ? 'copperPlate' : 'ironPlate' }
