import { miniStatus } from '../simulation/petesWorld'
import { peteStatus } from '../simulation/peteStatus'
import { workStatus } from './workStatus'
import type { World } from '../simulation/world'
import { PETES_WORLD_TOOLS } from '../state/toolMetadata'
import type { Tool } from '../state/toolMetadata'

export function peteToolAllowed(tool: Tool): boolean {
  return tool === null || tool === 'axe' || tool === 'playfulSpray' || PETES_WORLD_TOOLS.includes(tool)
}
export function peteProjection(world: World, inspecting: boolean) {
  return { miniHint: miniStatus(world), peteInspection: inspecting ? peteStatus(world) : null, workStatus: workStatus(world) }
}
