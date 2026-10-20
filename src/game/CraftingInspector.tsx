import type { Inspection } from '../simulation/inspection'
import { inventoryTotal } from '../simulation/items'
import { RECIPES } from '../simulation/recipes'
import type { FurnaceRecipeMode } from '../simulation/recipes'
import { InventoryView, RecipeAmounts } from './InventoryView'

const statuses = { processing: 'Processing', 'waiting-input': 'Waiting for ingredients', 'output-full': 'Output full', 'waiting-recipe': 'Waiting for more ingredients' }
export function CraftingInspector({ inspection, requestRecipe }: {
  inspection: Extract<Inspection, { kind: 'furnace' | 'assembler' }>
  requestRecipe: (mode: FurnaceRecipeMode) => void
}) {
  const furnace = inspection.kind === 'furnace'
  const selectorId = `${inspection.kind}-recipe`
  return <>
    <h2>{furnace ? 'Furnace' : 'Assembler'}</h2>
    <div className="stats"><span>{furnace || inspection.recipeMode === 'auto' ? 'Detected recipe' : 'Selected recipe'}</span><b>{inspection.recipe}</b></div>
    {!furnace && <div className="stats"><span>Recipe mode</span><b>{inspection.recipeMode === 'auto' ? 'Auto' : 'Manual'}</b></div>}
    <label className="recipe-label" htmlFor={selectorId}>{furnace ? 'Recipe mode' : 'Assembler recipe'}</label>
    <select id={selectorId} value={inspection.recipeMode} disabled={inspection.recipeChangeError !== null} aria-describedby="recipe-help" onChange={event => {
      if (event.currentTarget.value === 'auto') { requestRecipe('auto'); return }
      const recipe = Object.values(RECIPES).find(recipe => recipe.machine === inspection.kind && recipe.id === event.currentTarget.value)
      if (recipe) requestRecipe(recipe.id)
    }}><option value="auto">Auto</option>{Object.values(RECIPES).filter(recipe => recipe.machine === inspection.kind).map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</select>
    <p className="inspection-note" id="recipe-help">{inspection.recipeChangeError ?? (furnace ? 'Auto detects incoming ore and stays locked until both buffers and the active batch are empty. Change mode only while empty and idle.' : 'Auto prioritizes complete circuit batches. Single-ingredient batches wait 2 seconds for more ingredients. Selecting a recipe locks Manual mode; mode changes require empty buffers and no active batch.')}</p>
    {inspection.recipeId && <p className="inspection-recipe"><RecipeAmounts amounts={inspection.requirements} /> → <RecipeAmounts amounts={inspection.products} /> · {inspection.durationMs / 1000} seconds at full power</p>}
    <div className="stats"><span>Status</span><b>{inspection.status === 'processing' && inspection.electrical.speedFraction === 0 ? 'Paused · no power' : statuses[inspection.status]}</b></div>
    {!furnace && inspection.recipeMode === 'auto' && <div className="stats"><span>Recipe wait remaining</span><b>{(inspection.recipeWaitRemainingMs / 1000).toFixed(2)} s</b></div>}
    <div className="stats"><span>Crafting speed</span><b>{inspection.craftingSpeed.toFixed(1)}</b></div>
    <div className="stats"><span>Output direction</span><b>{inspection.direction}</b></div>
    <section aria-label="Input inventory"><div className="stats"><span>Input buffer</span><b>{inventoryTotal(inspection.input)}{inspection.inputCapacity !== null ? ` / ${inspection.inputCapacity}` : ' queued'}</b></div><InventoryView inventory={inspection.input} expected={inspection.inputCapacity === null ? inspection.inputCapacities : inspection.requirements} capacities={inspection.inputCapacities} /></section>
    <section aria-label="Output inventory"><div className="stats"><span>Output buffer</span><b>{inventoryTotal(inspection.output)} / {inspection.outputCapacity}</b></div><InventoryView inventory={inspection.output} expected={inspection.products} /></section>
    <div className="stats"><span>Reserved output slots</span><b>{inventoryTotal(inspection.reserved)}</b></div>
    {inventoryTotal(inspection.reserved) > 0 && <section aria-label="Reserved products"><InventoryView inventory={inspection.reserved} /></section>}
    <div className="stats"><span>Processing progress</span><b>{Math.round(inspection.progress * 100)}%</b></div>
    <progress aria-label={furnace ? 'Smelting progress' : 'Crafting progress'} value={inspection.progress} max={1} />
    {inspection.status === 'processing' && <p className="inspection-note">Recipe ingredients committed to this batch.</p>}
    {inspection.outputWaiting && <p className="inspection-warning" role="status">Output waiting for conveyor</p>}
  </>
}
