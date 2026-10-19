import { GameCanvas } from './game/GameCanvas'
import { useGameStore } from './state/gameStore'
import type { Tool } from './state/gameStore'
import { FURNACE_INPUT_CAPACITY, FURNACE_OUTPUT_CAPACITY, RECIPES } from './simulation/recipes'
import { inventoryTotal } from './simulation/items'
const tools: { tool: Tool; label: string; hint: string; key: string; icon: string }[] = [
  { tool: 'miner', label: 'Mining machine', hint: '1 ore / sec · requires iron', key: '1', icon: '⚙' },
  { tool: 'belt', label: 'Conveyor belt', hint: 'Single lane · follows arrow', key: '2', icon: '➜' },
  { tool: 'storage', label: 'Storage chest', hint: 'Stores ore and iron plates', key: '3', icon: '▣' },
  { tool: 'furnace', label: 'Furnace', hint: '1 ore → 1 plate · 2 seconds', key: '4', icon: '♨' },
  { tool: 'remove', label: 'Remove building', hint: 'Discards contained resources', key: 'X', icon: '×' },
]
const statuses = { processing: 'Processing', 'waiting-input': 'Waiting for ore', 'output-full': 'Output full' }
export default function App() {
  const { stats, tool, direction, message, inspection, select, rotate } = useGameStore()
  return <div className="app-shell">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3"><span className="brand-mark">M</span><div><h1>MINI FACTORIO</h1><p className="eyebrow">A small beginning. An industrial future.</p></div></div>
      <span className="version"><i /> IRONWORKS / SPRINT 03</span>
    </header>
    <main>
      <aside className="flex flex-col gap-7 p-6">
        <section><p className="eyebrow">STORAGE & PRODUCTION</p>
          <div className="resource"><span className="ore-icon">▰</span><div><strong>{stats.storedPlates.toLocaleString()}</strong><p>Iron plates in storage</p></div></div>
          <div className="stats"><span>Iron ore in storage</span><b>{stats.storedOre.toLocaleString()}</b></div>
          <div className="stats"><span>Total ore mined</span><b>{stats.oreMined.toLocaleString()}</b></div>
          <div className="stats"><span>Total plates smelted</span><b>{stats.platesSmelted.toLocaleString()}</b></div>
          <div className="stats"><span>Mining machines</span><b>{stats.miners}</b></div>
          <div className="stats"><span>Furnaces</span><b>{stats.furnaces}</b></div>
          <div className="stats"><span>Maximum mining</span><b>{stats.miners} ore / sec</b></div>
          <div className="stats"><span>Maximum smelting</span><b>{stats.furnaces * 1000 / RECIPES.ironSmelting.durationMs} plates / sec</b></div>
        </section>
        {inspection && <section className="inspection" aria-label="Building inspection">
          <p className="eyebrow">{inspection.kind === 'furnace' ? 'FURNACE INSPECTION' : 'STORAGE INSPECTION'}</p>
          {inspection.kind === 'storage' ? <><div className="stats"><span>Iron ore</span><b>{inspection.inventory.iron}</b></div><div className="stats"><span>Iron plates</span><b>{inspection.inventory.ironPlate}</b></div></> : <>
            <h2>{inspection.recipe}</h2><p className="inspection-recipe">1 ore → 1 plate · 2 seconds · No fuel needed</p>
            <div className="stats"><span>Status</span><b>{statuses[inspection.status]}</b></div>
            <div className="stats"><span>Output direction</span><b>{inspection.direction}</b></div>
            <div className="stats"><span>Input ore</span><b>{inspection.input.iron} / {FURNACE_INPUT_CAPACITY}</b></div>
            <div className="stats"><span>Output plates</span><b>{inspection.output.ironPlate} / {FURNACE_OUTPUT_CAPACITY}</b></div>
            <div className="stats"><span>Reserved output slots</span><b>{inventoryTotal(inspection.reserved)}</b></div>
            <div className="stats"><span>Processing progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
            <progress aria-label="Smelting progress" value={inspection.progress} max={1} />
            {inspection.status === 'processing' && <p className="inspection-note">One ore committed to this batch.</p>}
            {inspection.outputWaiting && <p className="inspection-warning" role="status">Output waiting for conveyor</p>}
          </>}
        </section>}
        <section><p className="eyebrow mb-3">BUILDINGS · FREE TO BUILD</p>
          <div className="flex flex-col gap-2">{tools.map(option => <button key={option.key} className={`building ${tool === option.tool ? 'selected' : ''}`} onClick={() => select(tool === option.tool ? null : option.tool)} aria-pressed={tool === option.tool}><span className="machine-icon">{option.icon}</span><span><strong>{option.label}</strong><small>{option.hint}</small></span><span className="key">{option.key}</span></button>)}</div>
          <button className="building mt-3" onClick={rotate} disabled={tool !== 'miner' && tool !== 'belt' && tool !== 'furnace'}><span><strong>Output: {direction}</strong><small>Remove and replace to redirect buildings</small></span><span className="key">R</span></button>
        </section>
        <section className="mission"><p className="eyebrow">YOUR FIRST PRODUCTION CHAIN</p><h2>Mine. Smelt. Store.</h2><p>Feed ore into the rear or sides of a furnace. Connect its arrow to a belt and storage. Two seconds turn each ore into a plate. Full outputs pause smelting.</p></section>
        <div className="controls"><p className="eyebrow mb-3">FIELD MANUAL</p><p><kbd>W A S D</kbd><span>Move camera</span></p><p><kbd>SCROLL</kbd><span>Zoom in / out</span></p><p><kbd>1 / 2 / 3 / 4</kbd><span>Choose building</span></p><p><kbd>R / X</kbd><span>Rotate / remove</span></p><p><kbd>ESC</kbd><span>Cancel / inspect</span></p></div>
        <p className="session-note">Session only · Refresh to start a new world</p>
      </aside>
      <section className="world-panel"><div className="world-heading"><span><i /> GRASSLAND / SECTOR 01</span><span>40 × 40 TILES</span></div><GameCanvas /><div className="world-footer"><span role="status">{message}</span><span className="legend"><i /> Iron deposit</span></div></section>
    </main>
  </div>
}
