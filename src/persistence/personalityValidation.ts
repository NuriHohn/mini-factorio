import { completedProjects, createPersonality, INFLUENCE_LIMIT, levelForXp, PERSONALITY_PATHS, PROJECT_REWARD_IDS, PROJECT_REWARDS } from '../simulation/personality'
import type { Personality } from '../simulation/personality'
import type { World } from '../simulation/world'
import * as v from './validation'
export function restorePersonality(value: unknown, world: World): Personality {
  const r = v.object(value, 'game.personality', ['paths', 'dominant', 'rewardedProjects'])
  const paths = v.object(r.paths, 'personality.paths', PERSONALITY_PATHS), state = createPersonality()
  state.dominant = v.choice(r.dominant, 'personality.dominant', PERSONALITY_PATHS)
  for (const path of PERSONALITY_PATHS) {
    const p = `personality.paths.${path}`, raw = v.object(paths[path], p, ['xp', 'level', 'influence'])
    const xp = v.count(raw.xp, `${p}.xp`), level = v.number(raw.level, `${p}.level`, 1, 5, true), influence = v.count(raw.influence, `${p}.influence`, INFLUENCE_LIMIT)
    if (level !== levelForXp(xp)) v.invalid(p, 'level does not match XP')
    state.paths[path] = { xp, level, influence }
  }
  state.rewardedProjects = v.array(r.rewardedProjects, 'personality.rewardedProjects', undefined, PROJECT_REWARD_IDS.length).map(id => v.choice(id, 'personality.rewardedProjects', PROJECT_REWARD_IDS))
  const completed = completedProjects(world)
  if (new Set(state.rewardedProjects).size !== state.rewardedProjects.length || completed.length !== state.rewardedProjects.length || completed.some(id => !state.rewardedProjects.includes(id))) v.invalid('personality.rewardedProjects', 'rewards must match completed projects exactly once')
  const projectXp = state.rewardedProjects.reduce((sum, id) => sum + PROJECT_REWARDS[id].xp, 0)
  if (state.paths.eco.xp < projectXp) v.invalid('personality.paths.eco.xp', 'missing completed project XP')
  return state
}
