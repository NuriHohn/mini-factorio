import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { PLAYER_TOOLS, TOOL_HOTKEYS } from './toolMetadata'
beforeEach(() => useGameStore.setState(useGameStore.getInitialState(), true))
const key = (code: string) => useGameStore.getState().handleToolKey({ code, repeat: false })
describe('categorized build menu', () => {
  it('defaults to Factory and categorizes every existing player tool exactly once', () => {
    expect(useGameStore.getState().buildTab).toBe('factory')
    expect(new Set(PLAYER_TOOLS.map(t => t.tool)).size).toBe(PLAYER_TOOLS.length)
    expect(PLAYER_TOOLS.filter(t => t.tab === 'pete').map(t => t.tool)).toEqual(['radar', 'sprinkler'])
    expect(PLAYER_TOOLS.filter(t => t.tab === 'factory').map(t => t.tool)).toEqual(expect.arrayContaining(['miner', 'belt', 'splitter', 'furnace', 'assembler', 'inserter', 'storage', 'powerPole', 'generator', 'remove']))
    expect(PLAYER_TOOLS.map(t => t.tool)).not.toContain('prison')
    expect(Object.keys(TOOL_HOTKEYS)).toHaveLength(PLAYER_TOOLS.length)
  })
  it.each(['belt', 'remove', 'furnace'] as const)('cancels %s on a category change', tool => {
    useGameStore.getState().select(tool)
    useGameStore.getState().setBuildTab('pete')
    expect(useGameStore.getState()).toMatchObject({ buildTab: 'pete', tool: null })
    useGameStore.getState().setBuildTab('factory')
    expect(useGameStore.getState().tool).toBeNull()
  })
  it('auto-selects the correct tab for every hotkey and keeps ESC idempotent', () => {
    for (const metadata of PLAYER_TOOLS) {
      useGameStore.getState().setBuildTab(metadata.tab === 'factory' ? 'pete' : 'factory')
      key(metadata.code)
      expect(useGameStore.getState()).toMatchObject({ tool: metadata.tool, buildTab: metadata.tab })
      key('Escape'); key('Escape')
      expect(useGameStore.getState()).toMatchObject({ tool: null, buildTab: metadata.tab })
    }
  })
  it('does not cancel a tool when clicking its already active tab', () => {
    key('Digit9'); useGameStore.getState().setBuildTab('pete')
    expect(useGameStore.getState().tool).toBe('radar')
    key('Digit9'); expect(useGameStore.getState().tool).toBeNull()
    key('KeyX'); expect(useGameStore.getState()).toMatchObject({ tool: 'remove', buildTab: 'factory' })
  })
  it('queues only one save command at a time and keeps feedback separate from tool selection', () => {
    key('Digit9')
    useGameStore.getState().requestSave({ kind: 'save' }); useGameStore.getState().requestSave({ kind: 'load' })
    useGameStore.getState().saveFeedback('Unavailable', true)
    expect(useGameStore.getState()).toMatchObject({ tool: 'radar', saveBusy: true, saveRequest: { kind: 'save' }, saveStatus: { error: true, message: 'Unavailable' } })
  })
})
