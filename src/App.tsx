import { GameCanvas } from './game/GameCanvas'
import { useGameStore } from './state/gameStore'
export default function App() {
  const { ore, miners, selected, message, select } = useGameStore()
  return <div className="app-shell">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3"><span className="brand-mark">M</span><div><h1>MINI FACTORIO</h1><p className="eyebrow">A small beginning. An industrial future.</p></div></div>
      <span className="version"><i /> PROTOTYPE 01</span>
    </header>
    <main>
      <aside className="flex flex-col gap-7 p-6">
        <section><p className="eyebrow">PRODUCTION</p><div className="resource"><span className="ore-icon">◆</span><div><strong>{ore.toLocaleString()}</strong><p>Iron ore produced</p></div></div><div className="stats"><span>Production rate</span><b>{miners} / sec</b></div><div className="stats"><span>Active miners</span><b>{miners.toString().padStart(2, '0')}</b></div></section>
        <section><p className="eyebrow mb-3">BUILDINGS</p><button className={`building ${selected ? 'selected' : ''}`} onClick={() => select(!selected)} aria-pressed={selected}><span className="machine-icon">⚙</span><span><strong>Mining machine</strong><small>Extracts iron from deposits</small></span><span className="key">1</span></button><div className="flex justify-between text-xs mt-3 text-slate-400"><span>1 ore / second</span><span className="text-emerald-400">Free to build</span></div></section>
        <section className="mission"><p className="eyebrow">YOUR FIRST FACTORY</p><h2>Start with the essentials.</h2><p>Select a mining machine, then place it on a blue-gray iron deposit. Every miner adds to your production.</p></section>
        <div className="controls"><p className="eyebrow mb-3">FIELD MANUAL</p><p><kbd>W A S D</kbd><span>Move camera</span></p><p><kbd>SCROLL</kbd><span>Zoom in / out</span></p><p><kbd>CLICK</kbd><span>Place miner</span></p><p><kbd>1 / ESC</kbd><span>Select / cancel</span></p></div>
        <p className="session-note">Session only · Refresh to start a new world</p>
      </aside>
      <section className="world-panel"><div className="world-heading"><span><i /> GRASSLAND / SECTOR 01</span><span>40 × 40 TILES</span></div><GameCanvas /><div className="world-footer"><span role="status">{message}</span><span className="legend"><i /> Iron deposit</span></div></section>
    </main>
  </div>
}

