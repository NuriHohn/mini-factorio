import type { World } from '../simulation/world'

export interface ProductionCredit {
  research: (world: World, kind: 'miner' | 'furnace' | 'assembler', fromMs: number, toMs: number) => void
  observe: (world: World, delta: number) => void
}
