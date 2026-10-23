import type { World } from './world'

export const PERSONALITY_PATHS = ['eco', 'craftsman', 'inventor', 'industrial'] as const
export type PersonalityPath = typeof PERSONALITY_PATHS[number]
export const PATH_LABELS: Record<PersonalityPath, string> = { eco: 'Eco', craftsman: 'Craftsman', inventor: 'Inventor', industrial: 'Industrial' }
export const XP_THRESHOLDS = [0, 20, 80, 200, 450] as const
export const INFLUENCE_LIMIT = 20
export const DOMINANCE_MARGIN = 4
export interface PathProgress { xp: number; level: number; influence: number }
export interface Personality { paths: Record<PersonalityPath, PathProgress>; dominant: PersonalityPath; rewardedProjects: ProjectReward[] }
export interface XpReward { path: PersonalityPath; xp: number }
export const PROJECT_REWARDS = {
  experiment: { path: 'inventor', xp: 10 },
  veranda: { path: 'craftsman', xp: 25 },
  workshop: { path: 'craftsman', xp: 10 },
  garden: { path: 'eco', xp: 20 },
  fence: { path: 'eco', xp: 5 },
  coop: { path: 'eco', xp: 10 },
  campfire: { path: 'eco', xp: 5 },
  yard: { path: 'eco', xp: 10 },
  gate: { path: 'eco', xp: 5 },
} as const satisfies Record<string, XpReward>
export type ProjectReward = keyof typeof PROJECT_REWARDS
export const PROJECT_REWARD_IDS = Object.keys(PROJECT_REWARDS) as ProjectReward[]
export const EGG_REWARD: XpReward = { path: 'eco', xp: 1 }
export function levelForXp(xp: number): number {
  return XP_THRESHOLDS.filter(threshold => xp >= threshold).length
}
export function createPersonality(): Personality {
  return { paths: { eco: { xp: 0, level: 1, influence: 0 }, craftsman: { xp: 0, level: 1, influence: 0 }, inventor: { xp: 0, level: 1, influence: 0 }, industrial: { xp: 0, level: 1, influence: 0 } }, dominant: 'eco', rewardedProjects: [] }
}
// Event-based recency: no wall clock, RNG or per-frame work. Future activities
// can supply a reward on any path; lifetime XP never decides dominance.
export function awardActivity(state: Personality, reward: XpReward): void {
  if (!Number.isSafeInteger(reward.xp) || reward.xp <= 0) throw new Error('XP rewards must be positive safe integers.')
  const progress = state.paths[reward.path]
  progress.xp = Math.min(Number.MAX_SAFE_INTEGER - reward.xp, progress.xp) + reward.xp
  progress.level = levelForXp(progress.xp)
  for (const path of PERSONALITY_PATHS) state.paths[path].influence = Math.max(0, state.paths[path].influence - 1)
  progress.influence = Math.min(INFLUENCE_LIMIT, progress.influence + 4)
  const challenger = PERSONALITY_PATHS.reduce((best, path) => state.paths[path].influence > state.paths[best].influence ? path : best, state.dominant)
  if (state.paths[challenger].influence >= state.paths[state.dominant].influence + DOMINANCE_MARGIN) state.dominant = challenger
}
export function rewardProject(state: Personality, id: ProjectReward): boolean {
  if (state.rewardedProjects.includes(id)) return false
  awardActivity(state, PROJECT_REWARDS[id])
  state.rewardedProjects.push(id)
  return true
}
export function completedProjects(world: World): ProjectReward[] {
  return PROJECT_REWARD_IDS.filter(id => ({ experiment: world.experimentProject, veranda: world.verandaProject, workshop: world.workshopProject, garden: world.gardenProject, fence: world.project, coop: world.coopProject, campfire: world.campfireProject, yard: world.yard, gate: world.gateProject })[id]?.phase === 'complete')
}
export function migratePersonality(world: World): Personality {
  const state = createPersonality()
  for (const id of completedProjects(world)) rewardProject(state, id)
  return state
}
