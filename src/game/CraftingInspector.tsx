import { useGameStore } from '../state/gameStore'
import type { Inspection } from '../simulation/inspection'
import { inventoryTotal } from '../simulation/items'
import { RECIPES } from '../simulation/recipes'
import type { FurnaceRecipeMode } from '../simulation/recipes'
import { InventoryView, RecipeAmounts } from './InventoryView'

const detectionStatuses = { undetected: 'Waiting for automatic detection', choosing: 'Choosing initial recipe', 'automatic-locked': 'Locked automatically', 'manual-locked': 'Locked manually' }
const statuses = { processing: 'Processing', 'waiting-input': 'Waiting for ingredients', 'output-full': 'Output full', 'waiting-recipe': 'Waiting for more ingredients' }
export function CraftingInspector({ inspection, requestRecipe }: {
  inspection: Extract<Inspection, { kind: 'furnace' | 'assembler' | 'sawmill' }>
  requestRecipe: (mode: FurnaceRecipeMode) => void
}) {
  const mode = useGameStore(state => state.playMode)
  const furnace = inspection.kind === 'furnace'
  const selectorId = `${inspection.kind}-recipe`
  return <>
    <h2>{furnace ? 'Furnace' : inspection.kind === 'sawmill' ? 'Sägewerk' : 'Assembler'}</h2>
    <div className="stats"><span>{inspection.recipeLocked ? 'Locked recipe' : 'Candidate recipe'}</span><b>{inspection.recipe}</b></div>
    <div className="stats"><span>Detection status</span><b>{!furnace && !inspection.recipeId ? 'Select a recipe manually' : detectionStatuses[inspection.detectionStatus]}</b></div>
    {!furnace && <div className="stats"><span>Recipe mode</span><b>Manual</b></div>}
    <label className="recipe-label" htmlFor={selectorId}>{furnace ? 'Recipe mode' : inspection.kind === 'sawmill' ? 'Fixed sawmill recipe' : 'Assembler recipe'}</label>
    <select id={selectorId} value={furnace ? inspection.recipeMode : inspection.recipeId ?? ''} disabled={mode === 'petesWorld' || inspection.kind === 'sawmill' || inspection.recipeChangeError !== null} aria-describedby="recipe-help" onChange={event => {
      if (event.currentTarget.value === 'auto') { requestRecipe('auto'); return }
      const recipe = Object.values(RECIPES).find(recipe => recipe.machine === inspection.kind && recipe.id === event.currentTarget.value)
      if (recipe) requestRecipe(recipe.id)
    }}>{furnace ? <option value="auto" disabled={inspection.recipeLocked}>Auto (once after placement)</option> : <option value="" disabled>Choose a recipe…</option>}{Object.values(RECIPES).filter(recipe => recipe.machine === inspection.kind && (inspection.peteCircuit ? recipe.id === 'peteCircuit' || recipe.id === inspection.recipeId : recipe.id !== 'peteCircuit')).map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select>
    {inspection.peteCircuit && inspection.recipeId === 'electronicCircuit' && <p className="inspection-note">Altcharge: Bereits vorhandenes Eisen wird fertig verarbeitet. Danach nutzt Pete ausschließlich Kupferplatten und Kabel; neues Eisen wird nicht abgeholt.</p>}
    <p className="inspection-note" id="recipe-help">{inspection.recipeLocked ? 'This recipe stays locked, even when empty. A manual change requires empty buffers and no active batch.' : furnace ? 'The first accepted ore permanently locks its recipe.' : 'Choose a recipe manually. Unconfigured assemblers do not accept ingredients or produce items.'}</p>
    {inspection.recipeChangeError && <p className="inspection-note">{inspection.recipeChangeError}</p>}
    {inspection.recipeId && <p className="inspection-recipe"><RecipeAmounts amounts={inspection.requirements} /> → <RecipeAmounts amounts={inspection.products} /> · {inspection.durationMs / 1000} seconds at full power</p>}
    <div className="stats"><span>Status</span><b>{inspection.electrical.state === 'sabotaged' ? 'Paused · sabotaged' : inspection.status === 'processing' && inspection.electrical.speedFraction === 0 ? 'Paused · no power' : !furnace && !inspection.recipeId ? 'Select a recipe' : statuses[inspection.status]}</b></div>
    <div className="stats"><span>Crafting speed</span><b>{inspection.craftingSpeed.toFixed(1)}</b></div>
    <div className="stats"><span>Output direction</span><b>{inspection.direction}</b></div>
    <section aria-label="Input inventory"><div className="stats"><span>Input buffer</span><b>{inventoryTotal(inspection.input)}{inspection.inputCapacity !== null ? ` / ${inspection.inputCapacity}` : ' queued'}</b></div><InventoryView inventory={inspection.input} expected={inspection.inputCapacity === null ? inspection.inputCapacities : inspection.requirements} capacities={inspection.inputCapacities} /></section>
    <section aria-label="Output inventory"><div className="stats"><span>Output buffer</span><b>{inventoryTotal(inspection.output)} / {inspection.outputCapacity}</b></div><InventoryView inventory={inspection.output} expected={inspection.products} /></section>
    <div className="stats"><span>Reserved output slots</span><b>{inventoryTotal(inspection.reserved)}</b></div>
    {inventoryTotal(inspection.reserved) > 0 && <section aria-label="Reserved products"><InventoryView inventory={inspection.reserved} /></section>}
    <div className="stats"><span>Processing progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
    <progress aria-label={furnace ? 'Smelting progress' : 'Crafting progress'} value={inspection.progress} max={1} />
    {inspection.status === 'processing' && <p className="inspection-note">Recipe ingredients committed to this batch.</p>}
    {inspection.outputWaiting && <p className="inspection-warning" role="status">Output waiting for transport</p>}
  </>
}
