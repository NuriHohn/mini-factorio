import { TOOL_HINTS, toolHintId } from '../state/toolHints'
import { brushMode } from '../state/natureTools'
import { combatTool } from '../simulation/revenge'
import { buildingTechnologyError } from '../simulation/research'
import { useGameStore } from '../state/gameStore'
import { BUILD_TABS, PLAYER_TOOLS, toolMetadata } from '../state/toolMetadata'
export function BuildToolbar() {
  const { hintUses, peaceful, revenge, simulationTime, research, brushSize, setBrushSize, wood, buildTab, setBuildTab, tool, select, direction, rotate } = useGameStore()
  const error = (id: typeof PLAYER_TOOLS[number]['tool']) => buildingTechnologyError(research, id) ?? (id === 'treehouse' ? peaceful ? 'Only one treehouse · Pete already has a home.' : wood < 20 ? `20 Wood required · ${wood} available` : null : null)
  const hint = toolHintId(tool)
  const selected = tool ? toolMetadata(tool) : null
  return <section className="construction-toolbar" aria-label="Build toolbar">
    <div className="toolbar-top">
      <div className="build-tabs" role="tablist" aria-label="Building categories">{BUILD_TABS.map(tab => <button key={tab.id} className="build-tab" role="tab" id={`tab-${tab.id}`} aria-controls="build-panel" aria-selected={buildTab === tab.id} tabIndex={buildTab === tab.id ? 0 : -1} onClick={() => setBuildTab(tab.id)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? BUILD_TABS[0] : event.key === 'End' ? BUILD_TABS.at(-1)! : BUILD_TABS[(BUILD_TABS.findIndex(t => t.id === buildTab) + (event.key === 'ArrowLeft' ? BUILD_TABS.length - 1 : 1)) % BUILD_TABS.length]
        setBuildTab(next.id)
        document.getElementById(`tab-${next.id}`)?.focus()
      }}><span aria-hidden="true">{tab.icon}</span> {tab.label}</button>)}</div>
      <span className="selected-tool" aria-live="polite">{selected ? <><span aria-hidden="true">{selected.icon}</span> {selected.label}</> : 'Explore'}</span>
      {hint && (hintUses[hint] ?? 0) < 3 && <span className="tool-hint" role="note">{TOOL_HINTS[hint]}</span>}
    </div>
    <div className="toolbar-tools">
      <div id="build-panel" role="tabpanel" aria-labelledby={`tab-${buildTab}`} className="tool-icons">{PLAYER_TOOLS.filter(option => option.tab === buildTab).map(option => {
        const reason = error(option.tool)
        const fundingOnly = option.tool === 'treehouse' && !peaceful && wood < 20
        const cooldown = combatTool(option.tool) && revenge.playerReadyAtMs > simulationTime ? `${((revenge.playerReadyAtMs - simulationTime) / 1000).toFixed(1)} s cooldown` : ''
        return <button key={option.tool} className={`building tool-icon${fundingOnly ? ' tool-unaffordable' : ''}`} disabled={!!reason && !fundingOnly} title={`${option.label} · ${reason ?? option.hint}${fundingOnly ? ' · Preview only' : ''}${cooldown ? ` · ${cooldown}` : ''}${option.code ? ` (${option.key})` : ''}`} aria-label={`${option.label}${reason ? ` · ${reason}` : ''}`} data-tool={option.tool} onClick={() => select(option.tool)} aria-pressed={tool === option.tool}>
          <span className="machine-icon" aria-hidden="true">{option.icon}</span><strong>{option.label}</strong>
          {reason && <span className="lock-mark" aria-hidden="true">{option.tool === 'treehouse' ? '!' : '🔒'}</span>}
          {option.code && <span className="tool-key" aria-hidden="true">{option.key}</span>}
          {combatTool(option.tool) && <progress aria-label={`${option.label} shared cooldown`} max={revenge.playerCooldownMs || 1} value={Math.max(0, (revenge.playerCooldownMs || 1) - Math.max(0, revenge.playerReadyAtMs - simulationTime))} />}
        </button>
      })}</div>
      <div className="toolbar-options">
        {brushMode(tool) !== undefined && <fieldset className="brush-options"><legend>Brush size</legend>{([1, 3, 5] as const).map(size => <button key={size} className="save-action" aria-pressed={brushSize === size} onClick={() => setBrushSize(size)}>{size}×{size}</button>)}</fieldset>}
        {['miner', 'belt', 'furnace', 'assembler', 'inserter', 'splitter'].includes(tool ?? '') && <button className="save-action rotate-tool" title="Rotate output clockwise (R)" aria-label={`Rotate output: ${direction}`} onClick={rotate}>↻ <span>{direction}</span></button>}
      </div>
    </div>
  </section>
}
