import { create } from 'zustand'
interface State {
  ore: number; miners: number; selected: boolean; message: string
  select: (selected: boolean) => void
}
export const useGameStore = create<State>(set => ({
  ore: 0, miners: 0, selected: true, message: 'Place your first miner on an iron deposit.',
  select: selected => set({ selected, message: selected ? 'Choose an iron deposit to place a miner.' : 'Exploring · Press 1 to select a miner.' }),
}))

