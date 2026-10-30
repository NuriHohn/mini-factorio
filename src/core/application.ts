import type { ComponentType } from 'react'
import type Phaser from 'phaser'
import type { World, Position, Radar, Prison } from '../simulation/world'
import type { Viewport } from '../game/viewport'
import type { CombatTool } from '../simulation/revenge'
import type { CombatImpact } from '../factory/revengeSystem'
import type { SaveAdapter } from './saveAdapter'

export type PlayMode = 'factory' | 'petesWorld'
export interface ApplicationParts {
  HeaderActions: ComponentType
  WorldHeading: ComponentType
  Panels: ComponentType
  Toolbar: ComponentType
}
export interface FactorySceneFeatures {
  destroy: () => void
  attack: (world: World, tool: CombatTool, position: Position) => CombatImpact | null
  impact: (impact: CombatImpact, world: World) => void
  draw: (g: Phaser.GameObjects.Graphics, world: World, tile: number, scene: Phaser.Scene, view: Viewport) => void
  security: (g: Phaser.GameObjects.Graphics, world: World, building: Radar | Prison, tile: number) => void
  police: (g: Phaser.GameObjects.Graphics, world: World, tile: number, view: Viewport) => void
}
export interface SceneRuntime {
  mode: PlayMode
  save: SaveAdapter
  createWorld: () => World
  advance: (world: World, delta: number) => void
  activate: () => void
  prioritize?: (world: World, id: string | null) => boolean
  features?: FactorySceneFeatures
}
export async function loadRuntime(mode: PlayMode): Promise<SceneRuntime> {
  return mode === 'petesWorld' ? (await import('../pete/scene')).peteRuntime() : (await import('../factory/scene')).factoryRuntime()
}
export async function loadApplication(mode: PlayMode): Promise<ApplicationParts> {
  return mode === 'petesWorld' ? import('../pete/application') : import('../factory/application')
}
