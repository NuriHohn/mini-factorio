import { create } from 'zustand'
import { rotate } from '../simulation/world'
import type { BuildingKind, Direction } from '../simulation/world'
export type Tool = BuildingKind | 'remove' | null
interface State {
  ore: number; miners: number; stored: number; tool: Tool; direction: Direction; message: string
  inspected: number | null; inventory: number | null
  select: (tool: Tool) => void
  rotate: () => void
}
export const useGameStore = create<State>(set => ({
  ore: 0, miners: 0, stored: 0, tool: 'miner', direction: 'east', inspected: null, inventory: null,
  message: 'Place a miner on iron, then connect its arrow to belts and storage.',
  select: tool => set({ tool, inspected: null, inventory: null, message: tool === 'remove' ? 'Click a building to remove it. Contained ore will be discarded.' : tool ? `Place ${tool} · R rotates direction.` : 'Exploring · Click storage to inspect its inventory.' }),
  rotate: () => set(state => ({ direction: rotate(state.direction) })),
}))
