import { RevengeHUD } from './game/RevengeHUD'
import { ResearchPanel } from './game/ResearchPanel'
import { AnalyticsPanel } from './game/AnalyticsPanel'
import { useEffect, useRef } from 'react'
import { InventoryView } from './game/InventoryView'
import { PowerInspector } from './game/PowerInspector'
import { GameCanvas } from './game/GameCanvas'
import { useGameStore } from './state/gameStore'
import { BuildToolbar } from './game/BuildToolbar'
import { SaveControls } from './game/SaveControls'
import { InserterInspector } from './game/InserterInspector'
import { SplitterInspector } from './game/SplitterInspector'
import { CraftingInspector } from './game/CraftingInspector'
import { ITEM_DEFINITIONS, ITEMS, inventoryTotal } from './simulation/items'
export default function App() {
  const { stats, electricity, powerOverlay, togglePowerOverlay, message, requestRecipe, requestRelease, inspected, inspection } = useGameStore()
  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => { if (inspected !== null && sidebar.current) sidebar.current.scrollTop = 0 }, [inspected])
  return <div className="app-shell">
    <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3"><span className="brand-mark">M</span><div><h1>MINI FACTORIO</h1><p className="eyebrow">A small beginning. An industrial future.</p></div></div>
      <ResearchPanel />
      <span className="version"><i /> SPRINT 12</span>
    </header>
    <main>
      <aside ref={sidebar} className="flex flex-col gap-7 p-6">
        {inspection && <section className="inspection" aria-label="Building inspection">
          <p className="eyebrow">{inspection.kind === 'powerPole' ? 'POWER POLE' : inspection.kind.toUpperCase()} INSPECTION</p>
          {inspection.kind !== 'storage' && inspection.kind !== 'prison' && inspection.kind !== 'splitter' && <PowerInspector details={inspection.electrical} />}
          {inspection.kind === 'splitter' ? <SplitterInspector inspection={inspection} /> : inspection.kind === 'prison' ? <>
            <h2>Pete’s prison</h2>
            <div className="stats"><span>Occupant</span><b>{inspection.occupied ? 'Angry Pete' : 'Empty'}</b></div>
            <div className="stats"><span>Imprisonment elapsed</span><b>{(inspection.elapsedMs / 1000).toFixed(2)} s</b></div>
            <div className="stats"><span>Automatic escape in</span><b>{(inspection.remainingMs / 1000).toFixed(2)} s</b></div>
            <button className="building" disabled={!inspection.occupied} onClick={requestRelease}>Release Pete</button>
            <p className="inspection-note">Release is immediate. Pete escapes after 60 simulation seconds; release grants 10 seconds of radar grace. Exit: {inspection.exit.x}, {inspection.exit.y}.</p>
          </> : inspection.kind === 'sprinkler' ? <>
            <h2>Anti-Goblin Sprinkler</h2>
            <div className="stats"><span>State</span><b>{inspection.status}</b></div>
            <div className="stats"><span>Detection radius</span><b>{inspection.radius} tiles</b></div>
            <div className="stats"><span>Power required</span><b>5 kW</b></div>
            <div className="stats"><span>Cooldown remaining</span><b>{(inspection.cooldownMs / 1000).toFixed(2)} s</b></div>
            <div className="stats"><span>Successful sprays</span><b>{inspection.sprays}</b></div>
            <p className="inspection-note">Requires full power. Spray pauses during shortages. Police and release grace take priority. No water supply needed.</p>
          </> : inspection.kind === 'radar' ? <>
            <h2>Radar trap</h2>
            <div className="stats"><span>Detection radius</span><b>{inspection.radius} tiles</b></div>
            <div className="stats"><span>Radar</span><b>{inspection.active ? 'Active' : 'Inactive · needs full 5 kW'}</b></div>
            <div className="stats"><span>Police operation</span><b>{inspection.operation}</b></div>
            <p className="inspection-note">One police operation at a time. {inspection.prison ? `Prison at ${inspection.prison.x}, ${inspection.prison.y}.` : 'A prison appears at a reachable map edge on first dispatch.'}</p>
          </> : inspection.kind === 'storage' ? <InventoryView inventory={inspection.inventory} showAll /> : inspection.kind === 'furnace' || inspection.kind === 'assembler' ? <CraftingInspector inspection={inspection} requestRecipe={requestRecipe} /> : inspection.kind === 'inserter' ? <InserterInspector inspection={inspection} /> : inspection.kind === 'miner' ? <>
            <div className="stats"><span>Extracting</span><b>{inspection.resource ? ITEM_DEFINITIONS[inspection.resource].label : 'No deposit'}</b></div>
            <div className="stats"><span>Mining progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
            <div className="stats"><span>Output buffer</span><b>{inspection.buffered ? '1 ore · blocked' : 'Empty'}</b></div>
          </> : inspection.kind === 'generator' ? <>
            <div className="stats"><span>Generation capacity</span><b>{inspection.capacityKw} kW</b></div>
            <div className="stats"><span>Actual generation</span><b>{inspection.actualKw.toFixed(1)} kW</b></div>
            <p className="inspection-note">No fuel needed. Requires a pole within 3 tiles.</p>
          </> : inspection.kind === 'powerPole' ? <>
            <div className="stats"><span>Coverage radius</span><b>{inspection.coverageRadius} tiles</b></div>
            <div className="stats"><span>Machines in radius</span><b>{inspection.coveredMachines}</b></div>
            <p className="inspection-note">Highlighted machines are in this pole’s radius. Amber highlights belong to another network.</p>
          </> : null}
        </section>}
        <SaveControls />
        <section><p className="eyebrow">STORAGE & PRODUCTION</p>
          <div className="resource"><span className="ore-icon">◆</span><div><strong>{inventoryTotal(stats.stored).toLocaleString()}</strong><p>Items in storage</p></div></div>
          <table className="resource-table" aria-label="Resource statistics"><thead><tr><th>Item</th><th>Stored</th><th>Lifetime</th></tr></thead><tbody>{ITEMS.map(item => <tr key={item}><th><span className="item-swatch" style={{ backgroundColor: `#${ITEM_DEFINITIONS[item].visual.color.toString(16).padStart(6, '0')}` }} />{ITEM_DEFINITIONS[item].label}</th><td>{stats.stored[item].toLocaleString()}</td><td>{(ITEM_DEFINITIONS[item].category === 'ore' ? stats.mined[item] : stats.produced[item]).toLocaleString()}</td></tr>)}</tbody></table>
          <p className="inspection-note">Lifetime: ore mined · products crafted</p>
          <div className="stats"><span>Mining machines</span><b>{stats.miners}</b></div>
          <div className="stats"><span>Furnaces</span><b>{stats.furnaces}</b></div>
          <div className="stats"><span>Assemblers</span><b>{stats.assemblers}</b></div>
          <div className="stats"><span>Inserters</span><b>{stats.inserters}</b></div>
          <div className="stats"><span>Maximum crafting</span><b>{stats.maxCraftingPerSec.toFixed(2)} products / sec</b></div>
          <div className="stats"><span>Maximum mining</span><b>{stats.maxMiningPerSec} ore / sec</b></div>
          <div className="stats"><span>Maximum smelting</span><b>{stats.maxSmeltingPerSec} products / sec</b></div>
        </section>
        <section className="electricity-overview" aria-label="Electricity overview"><p className="eyebrow">ELECTRICITY</p>
          <div className="stats"><span>Installed capacity</span><b>{electricity.installedKw} kW</b></div>
          <div className="stats"><span>Connected capacity</span><b>{electricity.connectedKw} kW</b></div>
          <div className="stats"><span>Requested power</span><b>{electricity.requestedKw.toFixed(1)} kW</b></div>
          <div className="stats"><span>Supplied power</span><b>{electricity.suppliedKw.toFixed(1)} kW</b></div>
          <div className="stats"><span>Unused capacity</span><b>{electricity.surplusKw.toFixed(1)} kW</b></div>
          <div className="stats"><span>Unmet demand</span><b>{electricity.deficitKw.toFixed(1)} kW</b></div>
          <div className="stats"><span>Power networks</span><b>{electricity.networks}</b></div>
          <button className={`building mt-3 ${powerOverlay ? 'overlay-enabled' : ''}`} aria-pressed={powerOverlay} onClick={togglePowerOverlay}><span><strong>Electricity overlay</strong><small>Coverage, wires and machine power</small></span><span className="key">P</span></button>
        </section>
        <BuildToolbar />
        <section className="mission"><p className="eyebrow">POWER YOUR FACTORY</p><h2>Generate. Connect. Produce.</h2><p>Place a generator (5) and a pole (6). Machines need a pole within 3 tiles; poles connect within 6 tiles. Shortages slow all working machines proportionally. Belts always run. Furnaces detect ore automatically. Choose an assembler recipe in its inspector before supplying ingredients. The analytics panel shows actual production and bottlenecks.</p></section>
        <div className="controls"><p className="eyebrow mb-3">FIELD MANUAL</p><p><kbd>W A S D</kbd><span>Move camera</span></p><p><kbd>SCROLL</kbd><span>Zoom in / out</span></p><p><kbd>1–9 / 0 / G / B</kbd><span>Choose building</span></p><p><kbd>R / X</kbd><span>Rotate / remove</span></p><p><kbd>P</kbd><span>Electricity overlay</span></p><p><kbd>ESC</kbd><span>Cancel / inspect</span></p></div>
        <p className="session-note">Offline saves · Load to restore your factory</p>
      </aside>
      <section className="world-panel"><div className="world-heading"><span><i /> GRASSLAND / SECTOR 01</span><span>40 × 40 TILES</span></div><RevengeHUD /><GameCanvas /><div className="world-footer"><span role="status">{message}</span><span className="legend">{powerOverlay ? 'Green full · Amber reduced · Red no power · Blue idle' : <>◆ Iron · <span className="copper-legend">◆ Copper</span></>}</span></div></section>
      <AnalyticsPanel />
    </main>
  </div>
}
