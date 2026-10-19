import { GameCanvas } from './game/GameCanvas'
import { useGameStore } from './state/gameStore'
import type { Tool } from './state/gameStore'
const tools: { tool: Tool; label: string; hint: string; key: string; icon: string }[] = [
  { tool: 'miner', label: 'Mining machine', hint: '1 ore / sec · requires iron', key: '1', icon: '⚙' },
  { tool: 'belt', label: 'Conveyor belt', hint: 'Single lane · follows arrow', key: '2', icon: '➜' },
  { tool: 'storage', label: 'Storage chest', hint: 'Collects incoming iron ore', key: '3', icon: '▣' },
  { tool: 'remove', label: 'Remove building', hint: 'Discards contained ore', key: 'X', icon: '×' },
]
export default function App() {
  const { ore, miners, stored, tool, direction, message, inventory, select, rotate } = useGameStore()
  return <div className="app-shell">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3"><span className="brand-mark">M</span><div><h1>MINI FACTORIO</h1><p className="eyebrow">A small beginning. An industrial future.</p></div></div>
      <span className="version"><i /> CONVEYOR SPRINT</span>
    </header>
    <main>
      <aside className="flex flex-col gap-7 p-6">
        <section><p className="eyebrow">PRODUCTION</p><div className="resource"><span className="ore-icon">◆</span><div><strong>{stored.toLocaleString()}</strong><p>Iron ore in storage</p></div></div>
          <div className="stats"><span>Total mined</span><b>{ore.toLocaleString()}</b></div>
          <div className="stats"><span>Maximum production</span><b>{miners} / sec</b></div>
          <div className="stats"><span>Mining machines</span><b>{miners}</b></div>
          {inventory !== null && <div className="stats"><span>Selected chest</span><b>{inventory.toLocaleString()} iron</b></div>}
        </section>
        <section><p className="eyebrow mb-3">BUILDINGS · FREE TO BUILD</p>
          <div className="flex flex-col gap-2">{tools.map(option => <button key={option.key} className={`building ${tool === option.tool ? 'selected' : ''}`} onClick={() => select(tool === option.tool ? null : option.tool)} aria-pressed={tool === option.tool}><span className="machine-icon">{option.icon}</span><span><strong>{option.label}</strong><small>{option.hint}</small></span><span className="key">{option.key}</span></button>)}</div>
          <button className="building mt-3" onClick={rotate} disabled={tool !== 'miner' && tool !== 'belt'}><span><strong>Output: {direction}</strong><small>Remove and replace to redirect buildings</small></span><span className="key">R</span></button>
        </section>
        <section className="mission"><p className="eyebrow">YOUR FIRST SUPPLY LINE</p><h2>Mine. Move. Store.</h2><p>Place a miner on iron. Run belts from its output arrow into a chest. Full belts pause production. Press Escape, then click a chest to inspect it.</p></section>
        <div className="controls"><p className="eyebrow mb-3">FIELD MANUAL</p><p><kbd>W A S D</kbd><span>Move camera</span></p><p><kbd>SCROLL</kbd><span>Zoom in / out</span></p><p><kbd>1 / 2 / 3</kbd><span>Choose building</span></p><p><kbd>R / X</kbd><span>Rotate / remove</span></p><p><kbd>ESC</kbd><span>Cancel / inspect</span></p></div>
        <p className="session-note">Session only · Refresh to start a new world</p>
      </aside>
      <section className="world-panel"><div className="world-heading"><span><i /> GRASSLAND / SECTOR 01</span><span>40 × 40 TILES</span></div><GameCanvas /><div className="world-footer"><span role="status">{message}</span><span className="legend"><i /> Iron deposit</span></div></section>
    </main>
  </div>
}
