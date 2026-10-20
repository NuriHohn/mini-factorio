import { useGameStore } from '../state/gameStore'
import { BUILD_TABS, PLAYER_TOOLS } from '../state/toolMetadata'
export function BuildToolbar() {
  const { buildTab, setBuildTab, tool, select, direction, rotate } = useGameStore()
  return <section aria-label="Build toolbar">
    <div className="build-tabs" role="tablist" aria-label="Building categories">{BUILD_TABS.map(tab => <button key={tab.id} className="build-tab" role="tab" id={`tab-${tab.id}`} aria-controls="build-panel" aria-selected={buildTab === tab.id} tabIndex={buildTab === tab.id ? 0 : -1} onClick={() => setBuildTab(tab.id)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? BUILD_TABS[0] : event.key === 'End' ? BUILD_TABS.at(-1)! : BUILD_TABS[(BUILD_TABS.findIndex(t => t.id === buildTab) + (event.key === 'ArrowLeft' ? BUILD_TABS.length - 1 : 1)) % BUILD_TABS.length]
      setBuildTab(next.id)
      document.getElementById(`tab-${next.id}`)?.focus()
    }}>{tab.label}</button>)}</div>
    <div id="build-panel" role="tabpanel" aria-labelledby={`tab-${buildTab}`} className="flex flex-col gap-2">{PLAYER_TOOLS.filter(option => option.tab === buildTab).map(option => <button key={option.tool} className="building" data-tool={option.tool} onClick={() => select(option.tool)} aria-pressed={tool === option.tool}><span className="machine-icon">{option.icon}</span><span><strong>{option.label}</strong><small>{option.hint}</small></span><span className="key">{option.key}</span></button>)}</div>
    <button className="building mt-3" onClick={rotate} disabled={!['miner', 'belt', 'furnace', 'assembler', 'inserter', 'splitter'].includes(tool ?? '')}><span><strong>Output: {direction}</strong><small>Remove and replace to redirect buildings</small></span><span className="key">R</span></button>
  </section>
}
