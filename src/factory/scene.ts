import { createFactoryWorld, advanceFactoryWorld } from './simulation'
import { installFactoryState } from './state'
import { attackWalker } from './revengeSystem'
import { RevengeVisuals } from '../game/RevengeVisuals'
import { drawSecurityBuilding, drawPoliceEffects } from '../game/policeVisuals'
import type { SceneRuntime } from '../core/application'
import { factorySave } from './save'

export function factoryRuntime(): SceneRuntime {
  const visuals = new RevengeVisuals()
  return {
    mode: 'factory', save: factorySave, createWorld: createFactoryWorld, advance: advanceFactoryWorld, activate: installFactoryState,
    features: {
      attack: attackWalker, impact: (impact, world) => visuals.impact(impact, world),
      draw: (g, world, tile, scene, view) => visuals.draw(g, world, tile, scene, view),
      destroy: () => visuals.destroy(), security: drawSecurityBuilding, police: drawPoliceEffects,
    },
  }
}
