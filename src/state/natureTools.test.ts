import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { brushMode, NATURE_TOOLS, plantingSpecies } from './natureTools'
import { PLAYER_TOOLS, TOOL_HOTKEYS } from './toolMetadata'
import { createWorld } from '../simulation/world'
import { chopTree, MATURE_TREE_MS, plantTree } from '../simulation/nature'
beforeEach(() => {
  useGameStore.setState({ tool: null, buildTab: 'factory', brushSize: 3, researchOpen: false })
  useGameStore.getState().publish(createWorld(() => .5, { nature: false, water: false }))
})
describe('Nature toolbar and copied inventory', () => {
  it('registers Nature controls and the treehouse without replacing any existing shortcut', () => {
    expect(PLAYER_TOOLS.filter(t => t.tab === 'nature').map(t => t.tool)).toEqual(['fishingDock', 'supplyCrate', 'treehouse', ...NATURE_TOOLS])
    expect(TOOL_HOTKEYS).toMatchObject({ Digit1: 'miner', Digit9: 'radar', Digit0: 'splitter', KeyX: 'remove', KeyB: 'spiderWeb', KeyG: 'sprinkler' })
    expect(PLAYER_TOOLS.some(t => t.tool === ('tree' as string))).toBe(false)
    for (const tool of NATURE_TOOLS) {
      useGameStore.setState({ playMode: ['placeGrove', 'placeIron', 'placeCopper'].includes(tool) ? 'petesWorld' : 'factory' })
      useGameStore.getState().select(tool)
      expect(useGameStore.getState()).toMatchObject({ tool, buildTab: 'nature' })
      useGameStore.getState().select(tool); expect(useGameStore.getState().tool).toBe(null)
    }
    expect(plantingSpecies('plantBirch')).toBe('birch')
    expect(brushMode('eraseDecoration')).toBe(null); expect(brushMode('axe')).toBeUndefined()
  })
  it('keeps cancellation, category switching, keyboard tools and brush sizes consistent', () => {
    useGameStore.getState().select('flowers'); useGameStore.getState().setBrushSize(5)
    expect(useGameStore.getState()).toMatchObject({ brushSize: 5, tool: 'flowers' })
    useGameStore.getState().handleToolKey({ code: 'Escape', repeat: false })
    expect(useGameStore.getState().tool).toBe(null)
    useGameStore.getState().select('plantOak'); useGameStore.getState().setBuildTab('pete')
    expect(useGameStore.getState().tool).toBe(null)
    useGameStore.getState().handleToolKey({ code: 'Digit1', repeat: false })
    expect(useGameStore.getState()).toMatchObject({ tool: 'miner', buildTab: 'factory' })
  })
  it('publishes exactly collected global wood while factory item statistics stay separate', () => {
    const w = createWorld(() => .5, { nature: false, water: false })
    plantTree(w, 5, 5, 'oak'); w.timeMs = MATURE_TREE_MS; chopTree(w, 5, 5)
    useGameStore.getState().publish(w)
    expect(useGameStore.getState().wood).toBe(3)
    expect(useGameStore.getState().stats.stored.wood).toBe(0)
    chopTree(w, 5, 5); useGameStore.getState().publish(w)
    expect(useGameStore.getState().wood).toBe(3)
    useGameStore.getState().publish(createWorld(() => .5, { nature: false, water: false }))
    expect(useGameStore.getState().wood).toBe(0)
  })
})
