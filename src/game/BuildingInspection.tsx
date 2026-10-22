import { RecipeAmounts } from './InventoryView'
import { inspectionSummary } from './inspectionSummary'
import { useEffect, useRef } from 'react'
import { useGameStore } from '../state/gameStore'
import { InventoryView } from './InventoryView'
import { PowerInspector } from './PowerInspector'
import { InserterInspector } from './InserterInspector'
import { SplitterInspector } from './SplitterInspector'
import { CraftingInspector } from './CraftingInspector'
import { ITEM_DEFINITIONS } from '../simulation/items'
export function BuildingInspection() {
  const { inspected, inspection, requestRecipe, requestRelease } = useGameStore()
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { if (panel.current) panel.current.scrollTop = 0 }, [inspected])
  if (!inspection) return null
  const summary = inspectionSummary(inspection)
  return <aside ref={panel} className="building-inspection" aria-label="Selected building">
    <button className="panel-dismiss" aria-label="Close building inspection" onClick={() => useGameStore.setState({ inspected: null, inspection: null, recipeRequest: null, releaseRequest: null })}>×</button>
    <section className="inspection" aria-label="Building inspection">
      <div className="inspection-summary">
        <h2><span aria-hidden="true">{summary.icon}</span> {summary.name}</h2>
        <p>{summary.description}</p><strong role="status">{summary.state}</strong>
        {summary.power && <p>Power: {summary.power}</p>}
        {inspection.kind === 'supplyCrate' && <>
          <InventoryView inventory={inspection.inventory} showAll />
          <div className="stats"><span>Supplied Wood</span><b>{inspection.wood}</b></div>
        </>}
        {inspection.kind === 'peteCoop' && <p>{inspection.adults} chickens · {inspection.chicks} chicks</p>}
        {inspection.kind === 'belt' && <p>Output: {inspection.direction} · {inspection.item ? ITEM_DEFINITIONS[inspection.item].label : 'No item'}</p>}
        {inspection.kind === 'furnace' || inspection.kind === 'assembler' ? <p>{inspection.recipe}{inspection.recipeId && <><br /><RecipeAmounts amounts={inspection.requirements} /> → <RecipeAmounts amounts={inspection.products} /></>}</p> : null}
      </div>
      <details className="inspection-technical" key={inspected}><summary>Details and settings</summary>
      {'electrical' in inspection && <PowerInspector details={inspection.electrical} />}
      {inspection.kind === 'peteGate' ? <p className="inspection-note">Pete builds this once for 3 supplied Wood after his yard. It opens from either side and closes after he passes. Chickens and chicks never use this doorway. Demolition has no refund.</p> : inspection.kind === 'peteCampfire' ? <p className="inspection-note">Pete builds this once after his coop, using 5 supplied Wood. Cooking and eating takes eight seconds and uses one collected egg only when finished. No fuel, buffs or production.</p> : inspection.kind === 'peteCoop' ? <p className="inspection-note">Pete collects reachable eggs while peaceful. Up to four eggs can wait near the coop. Two chicks arrive after 2½ simulation minutes; they stay small and never lay eggs. Collected eggs can be cooked at Pete’s campfire; no factory items or trade.</p> : inspection.kind === 'supplyCrate' ? <p className="inspection-note">6 Wood · {inspection.capacity} items total · No power. Input only; full crates stop incoming items. Click the Wood icon above the crate to unload 6 Wood. Pete may collect supplied Wood for his secret project. Other materials stay stored. Demolition discards contents; no Wood refund.</p> : inspection.kind === 'fishingDock' ? <>
        <div className="stats"><span>Fishing side</span><b>{inspection.direction}</b></div>
        <p className="inspection-note">8 Wood · No electricity or item production. Keep the rear land approach clear. Pete visits only while peaceful.</p>
      </> : inspection.kind === 'treehouse' ? <>
        <h2>Pete’s Treehouse</h2>
        <p className="inspection-note">♥ Pete is peaceful · {inspection.activity}. {inspection.gifts} gifts nearby. Escape, then click a gift to collect it.</p>
        <p className="inspection-note">Built with 20 Wood, no power needed. Demolition returns Pete to mischief; no Wood refund. Revenge progress is preserved.</p>
      </> : inspection.kind === 'tree' ? <>
        <h2>{inspection.species[0].toUpperCase() + inspection.species.slice(1)}</h2>
        <div className="stats"><span>Growth stage</span><b>{inspection.stage}</b></div>
        <div className="stats"><span>Age</span><b>{(inspection.ageMs / 60000).toFixed(1)} min</b></div>
        <div className="stats"><span>Axe yield</span><b>{inspection.wood} Wood</b></div>
        <p className="inspection-note">Young after 2 minutes; mature after 5. Use Nature → Axe to chop. The ore beneath stays intact.</p>
      </> : inspection.kind === 'splitter' ? <SplitterInspector inspection={inspection} /> : inspection.kind === 'prison' ? <>
        <h2>Pete’s prison</h2>
        <div className="stats"><span>Occupant</span><b>{inspection.occupied ? 'Angry Pete' : 'Empty'}</b></div>
        <div className="stats"><span>Imprisonment elapsed</span><b>{(inspection.elapsedMs / 1000).toFixed(2)} s</b></div>
        <div className="stats"><span>Automatic escape in</span><b>{(inspection.remainingMs / 1000).toFixed(2)} s</b></div>
        <button className="building" disabled={!inspection.occupied} onClick={requestRelease}>Release Pete</button>
        <p className="inspection-note">Release is immediate. Pete escapes after 60 simulation seconds; radars can detect him immediately after release. Exit: {inspection.exit.x}, {inspection.exit.y}.</p>
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
      </> : inspection.kind === 'generator' || inspection.kind === 'waterwheel' ? <>
        <div className="stats"><span>Generation capacity</span><b>{inspection.capacityKw} kW</b></div>
        <div className="stats"><span>Actual generation</span><b>{inspection.actualKw.toFixed(1)} kW</b></div>
        <p className="inspection-note">No fuel needed. Requires a pole within 3 tiles.{inspection.kind === 'waterwheel' && ` Facing ${inspection.direction} · ${inspection.waterAvailable ? 'water available' : 'restore adjacent water'}.`}</p>
      </> : inspection.kind === 'powerPole' ? <>
        <div className="stats"><span>Coverage radius</span><b>{inspection.coverageRadius} tiles</b></div>
        <div className="stats"><span>Machines in radius</span><b>{inspection.coveredMachines}</b></div>
        <p className="inspection-note">Highlighted machines are in this pole’s radius. Amber highlights belong to another network.</p>
      </> : null}
      </details>
    </section>
  </aside>
}
