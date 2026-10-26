import { awardActivity } from './personality'
import { generationKw } from './power'
import { SIZE } from './world'
import type { Building, World } from './world'
export function steamShare(world: World, building: Building): number {
  const id = world.power?.assignments[building.y * SIZE + building.x]
  const network = world.power?.networks.find(n => n.id === id)
  if (!network?.capacityKw) return 0
  const steam = network.generatorIndices.reduce((sum, i) => { const b = world.buildings[i]; return sum + (b?.kind === 'steamEngine' ? generationKw(world, b) : 0) }, 0)
  return steam / network.capacityKw
}
export function steamWorkDuration(kind: 'steamWorkshop' | 'steamHoist'): number { return kind === 'steamWorkshop' ? 6000 : 8000 }
export function advanceSteamWork(world: World, delta: number): void {
  for (const index of Object.keys(world.power?.consumers ?? {})) {
    const b = world.buildings[Number(index)]
    if (b?.kind !== 'steamWorkshop' && b?.kind !== 'steamHoist' || b.cycles === Number.MAX_SAFE_INTEGER) continue
    const fraction = (world.power?.consumers[b.y * SIZE + b.x]?.speedFraction ?? 0) * steamShare(world, b)
    b.elapsedMs = Math.min(steamWorkDuration(b.kind), b.elapsedMs + delta * fraction)
    if (b.elapsedMs >= steamWorkDuration(b.kind) - 1e-8) {
      b.elapsedMs = 0; b.cycles++
      if (world.homestead?.expansion[b.kind] === b.y * SIZE + b.x) awardActivity(world.personality, { path: 'industrial', xp: 3 })
    }
  }
}
