import { PERSONALITY_PATHS } from './personality'
import type { PersonalityPath } from './personality'
import type { World } from './world'

export const BUILD_STRATEGIES = ['production', 'transport', 'storage'] as const
export type BuildStrategy = typeof BUILD_STRATEGIES[number]
export const STRATEGY_LABELS: Record<BuildStrategy, string> = { production: '⚙ Produktion', transport: '➜ Transport', storage: '▣ Lager' }
export const PATH_GOALS = PERSONALITY_PATHS.flatMap(path => BUILD_STRATEGIES.filter(strategy => strategy !== 'storage' || path === 'eco').map(strategy => `path:${path}:${strategy}`))

export function developmentFocus(world: World): { path: PersonalityPath; strategy: BuildStrategy } | null {
  const id = world.homestead?.priority
  if (!id || !PATH_GOALS.includes(id)) return null
  const [, path, strategy] = id.split(':')
  return { path: PERSONALITY_PATHS.find(p => p === path)!, strategy: BUILD_STRATEGIES.find(s => s === strategy)! }
}
