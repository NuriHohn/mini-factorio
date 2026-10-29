import type { World, Position } from '../simulation/world'
import type { TechnologyId } from '../simulation/research'
import type { AnalyticsSnapshot } from '../factory/analytics'

// Optional application dependency. Pete never installs or calls these services.
export interface FactoryStateServices {
  analytics: (world: World) => AnalyticsSnapshot
  researchRate: (world: World) => number
  purchase: (world: World, id: TechnologyId) => string | null
  release: (world: World, index: number, atMs: number) => boolean
  web: (world: World, position: Position) => string
}
let services: FactoryStateServices | null = null
export function configureFactoryState(next: FactoryStateServices | null): void { services = next }
export function factoryStateServices(): FactoryStateServices | null { return services }
