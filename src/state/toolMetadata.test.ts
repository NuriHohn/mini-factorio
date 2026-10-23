import { TECHNOLOGY_IDS } from '../simulation/research'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { PLAYER_TOOLS, TOOL_HOTKEYS, toolMetadata } from './toolMetadata'
beforeEach(() => useGameStore.setState({ ...useGameStore.getInitialState(), research: { balanceUnits: '0', unlocked: TECHNOLOGY_IDS } }, true))
const key = (code: string) => useGameStore.getState().handleToolKey({ code, repeat: false })
describe('categorized build menu', () => {
  it('defaults to Factory and categorizes every existing player tool exactly once', () => {
    expect(useGameStore.getState().buildTab).toBe('factory')
    expect(new Set(PLAYER_TOOLS.map(t => t.tool)).size).toBe(PLAYER_TOOLS.length)
    expect(PLAYER_TOOLS.filter(t => t.tab === 'pete').map(t => t.tool)).toEqual(['playfulSpray', 'radar', 'spiderWeb', 'sprinkler', 'flySwatter', 'drill', 'lightningBeam', 'remove'])
    expect(PLAYER_TOOLS.filter(t => t.tab === 'factory').map(t => t.tool)).toEqual(['miner', 'furnace', 'assembler'])
    expect(PLAYER_TOOLS.filter(t => t.tab === 'logistics').map(t => t.tool)).toEqual(['belt', 'footbridge', 'storage', 'inserter', 'splitter'])
    expect(PLAYER_TOOLS.filter(t => t.tab === 'power').map(t => t.tool)).toEqual(['waterwheel', 'generator', 'powerPole'])
    expect(PLAYER_TOOLS.map(t => t.tool)).not.toContain('prison')
    expect(Object.keys(TOOL_HOTKEYS)).toHaveLength(PLAYER_TOOLS.filter(t => t.code).length)
  })
  it.each(['belt', 'remove', 'furnace'] as const)('cancels %s on a category change', tool => {
    useGameStore.getState().select(tool)
    const other = toolMetadata(tool).tab === 'pete' ? 'factory' : 'pete'
    useGameStore.getState().setBuildTab(other)
    expect(useGameStore.getState()).toMatchObject({ buildTab: other, tool: null })
    useGameStore.getState().setBuildTab('factory')
    expect(useGameStore.getState().tool).toBeNull()
  })
  it('auto-selects the correct tab for every hotkey and keeps ESC idempotent', () => {
    for (const metadata of PLAYER_TOOLS) {
      useGameStore.getState().setBuildTab(metadata.tab === 'factory' ? 'pete' : 'factory')
      if (metadata.code) key(metadata.code)
      else useGameStore.getState().select(metadata.tool)
      expect(useGameStore.getState()).toMatchObject({ tool: metadata.tool, buildTab: metadata.tab })
      key('Escape'); key('Escape')
      expect(useGameStore.getState()).toMatchObject({ tool: null, buildTab: metadata.tab })
    }
  })
  it('does not cancel a tool when clicking its already active tab', () => {
    key('Digit9'); useGameStore.getState().setBuildTab('pete')
    expect(useGameStore.getState().tool).toBe('radar')
    key('Digit9'); expect(useGameStore.getState().tool).toBeNull()
    key('KeyX'); expect(useGameStore.getState()).toMatchObject({ tool: 'remove', buildTab: 'pete' })
  })
  it('queues only one save command at a time and keeps feedback separate from tool selection', () => {
    key('Digit9')
    useGameStore.getState().requestSave({ kind: 'save' }); useGameStore.getState().requestSave({ kind: 'load' })
    useGameStore.getState().saveFeedback('Unavailable', true)
    expect(useGameStore.getState()).toMatchObject({ tool: 'radar', saveBusy: true, saveRequest: { kind: 'save' }, saveStatus: { error: true, message: 'Unavailable' } })
  })
})
