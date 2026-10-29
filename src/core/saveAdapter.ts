import { decodeSave, encodeSave } from '../persistence/saveGame'
import type { LoadedGame, ViewState } from '../persistence/saveGame'
import type { World } from '../simulation/world'
import type { PlayMode } from './application'

export interface SaveAdapter {
  mode: PlayMode
  read: (text: string) => LoadedGame
  write: (world: World, view: ViewState, savedAt: string) => string
  accept: (world: World) => void
}
// Historical schema decoding remains shared. A mode adapter owns admission to its live world.
export function modeSaveAdapter(mode: PlayMode): SaveAdapter {
  const accept = (world: World) => {
    if (!!world.miniFactory !== (mode === 'petesWorld')) throw new Error(`This save belongs to ${world.miniFactory ? 'Petes Welt' : 'Factory'}.`)
  }
  return {
    mode, accept,
    read: text => { const loaded = decodeSave(text); accept(loaded.world); return loaded },
    write: (world, view, savedAt) => { accept(world); return encodeSave(world, view, savedAt) },
  }
}
