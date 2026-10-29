import { TECHNOLOGIES, TECHNOLOGY_IDS, hasTechnology, RP_UNITS, RP_RATES } from '../simulation/research'
import type { ResearchState, TechnologyId } from '../simulation/research'
import { RECIPES } from '../simulation/recipes'
import type { World } from '../simulation/world'

export function purchaseError(research: ResearchState, id: TechnologyId): string | null {
  if (!Object.hasOwn(TECHNOLOGIES, id)) return 'Unknown technology.'
  if (hasTechnology(research, id)) return 'Already researched.'
  const technology = TECHNOLOGIES[id]
  if (technology.prerequisite && !hasTechnology(research, technology.prerequisite)) return `Requires ${TECHNOLOGIES[technology.prerequisite].name}.`
  if (BigInt(research.balanceUnits) < BigInt(technology.cost) * RP_UNITS) return 'Insufficient research points.'
  return null
}
export function purchaseTechnology(world: World, id: TechnologyId): string | null {
  const error = purchaseError(world.research, id)
  if (error) return error
  world.research.balanceUnits = (BigInt(world.research.balanceUnits) - BigInt(TECHNOLOGIES[id].cost) * RP_UNITS).toString()
  world.research.unlocked = TECHNOLOGY_IDS.filter(technology => technology === id || hasTechnology(world.research, technology))
  return null
}
export function awardResearch(world: World, kind: keyof typeof RP_RATES, fromMs: number, toMs: number): void {
  const productiveNs = Math.round(toMs * 1_000_000) - Math.round(fromMs * 1_000_000)
  if (productiveNs <= 0) return
  const units = BigInt(productiveNs) * BigInt(RP_RATES[kind])
  world.research.balanceUnits = (BigInt(world.research.balanceUnits) + units).toString()
}
export function researchBalance(research: ResearchState): number { return Number(research.balanceUnits) / Number(RP_UNITS) }
export function formatResearchBalance(research: ResearchState): string {
  const hundredths = BigInt(research.balanceUnits) * 100n / RP_UNITS
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}`
}
// Current effective rate, read from allocation/readiness, never maximum installed capacity.
export function researchRate(world: World): number {
  let rate = 0
  world.buildings.forEach((building, index) => {
    if (!building) return
    const speed = world.power?.consumers[index]?.speedFraction ?? 0
    if (building.kind === 'miner' && !building.item && world.tiles[index]) rate += RP_RATES.miner * speed
    if ((building.kind === 'sawmill' || building.kind === 'furnace' || building.kind === 'assembler') && building.job && building.job.elapsedMs < RECIPES[building.job.recipeId].durationMs) rate += RP_RATES[building.kind === 'sawmill' ? 'furnace' : building.kind] * speed
  })
  return rate
}
