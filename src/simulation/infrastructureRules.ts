import type { Direction } from './world'

export const LINK_KINDS = ['iron', 'gearFeed', 'gearReturn'] as const
export type LinkKind = typeof LINK_KINDS[number]
export interface InfrastructurePart { tile: number; kind: 'belt' | 'inserter' | 'powerPole' | 'generator' | 'waterwheel'; direction: Direction }
export interface Connection { kind: LinkKind; source: number; target: number; parts: InfrastructurePart[] }
export interface WheelSite { tile: number; direction: Direction; poles: number[] }
export interface Infrastructure {
  links: Connection[]
  plan: Connection | null
  built: number
  repair: boolean
  wheel: WheelSite | null
  wheelPlan: WheelSite | null
  eco: number
  craftsman: number
  order: 'eco' | 'craftsman' | null
  nextOrderAtMs: number
}
export function createInfrastructure(): Infrastructure { return { links: [], plan: null, built: 0, repair: false, wheel: null, wheelPlan: null, eco: 0, craftsman: 0, order: null, nextOrderAtMs: 0 } }
export const LINK_NAMES: Record<LinkKind, string> = { iron: 'Eisenlieferung zum Lager', gearFeed: 'Plattenzufuhr für Zahnräder', gearReturn: 'Zahnradlieferung zum Lager' }
