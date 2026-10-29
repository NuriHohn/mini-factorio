import { useGameText } from './useGameText'
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
  const t = useGameText()
  const mode = useGameStore(state => state.playMode)
  const furnace = inspection.kind === 'furnace'
  const selectorId = `${inspection.kind}-recipe`
  return <>
    <h2>{furnace ? t('Furnace') : inspection.kind === 'sawmill' ? 'Sägewerk' : t('Assembler')}</h2>
    <div className="stats"><span>{inspection.recipeLocked ? t('Locked recipe') : t('Candidate recipe')}</span><b>{t(inspection.recipe)}</b></div>
    <div className="stats"><span>{t('Detection status')}</span><b>{!furnace && !inspection.recipeId ? t('Select a recipe manually') : t(detectionStatuses[inspection.detectionStatus])}</b></div>
    {!furnace && <div className="stats"><span>{t('Recipe mode')}</span><b>{t('Manual')}</b></div>}
    <label className="recipe-label" htmlFor={selectorId}>{furnace ? t('Recipe mode') : inspection.kind === 'sawmill' ? t('Fixed sawmill recipe') : t('Assembler recipe')}</label>
    <select id={selectorId} value={furnace ? inspection.recipeMode : inspection.recipeId ?? ''} disabled={mode === 'petesWorld' || inspection.kind === 'sawmill' || inspection.recipeChangeError !== null} aria-describedby="recipe-help" onChange={event => {
      if (event.currentTarget.value === 'auto') { requestRecipe('auto'); return }
      const recipe = Object.values(RECIPES).find(recipe => recipe.machine === inspection.kind && recipe.id === event.currentTarget.value)
      if (recipe) requestRecipe(recipe.id)
    }}>{furnace ? <option value="auto" disabled={inspection.recipeLocked}>{t('Auto (once after placement)')}</option> : <option value="" disabled>{t('Choose a recipe…')}</option>}{Object.values(RECIPES).filter(recipe => recipe.machine === inspection.kind && (inspection.peteCircuit ? recipe.id === 'peteCircuit' || recipe.id === inspection.recipeId : recipe.id !== 'peteCircuit')).map(recipe => <option key={recipe.id} value={recipe.id}>{t(recipe.label)}</option>)}</select>
    {inspection.peteCircuit && inspection.recipeId === 'electronicCircuit' && <p className="inspection-note">Altcharge: Bereits vorhandenes Eisen wird fertig verarbeitet. Danach nutzt Pete ausschließlich Kupferplatten und Kabel; neues Eisen wird nicht abgeholt.</p>}
    <p className="inspection-note" id="recipe-help">{inspection.recipeLocked ? t('This recipe stays locked, even when empty. A manual change requires empty buffers and no active batch.') : furnace ? t('The first accepted ore permanently locks its recipe.') : t('Choose a recipe manually. Unconfigured assemblers do not accept ingredients or produce items.')}</p>
    {inspection.recipeChangeError && <p className="inspection-note">{t(inspection.recipeChangeError)}</p>}
    {inspection.recipeId && <p className="inspection-recipe"><RecipeAmounts amounts={inspection.requirements} /> → <RecipeAmounts amounts={inspection.products} /> · {inspection.durationMs / 1000} {t('seconds at full power')}</p>}
    <div className="stats"><span>Status</span><b>{inspection.electrical.state === 'sabotaged' ? t('Paused · sabotaged') : inspection.status === 'processing' && inspection.electrical.speedFraction === 0 ? t('Paused · no power') : !furnace && !inspection.recipeId ? t('Select a recipe') : t(statuses[inspection.status])}</b></div>
    <div className="stats"><span>{t('Crafting speed')}</span><b>{inspection.craftingSpeed.toFixed(1)}</b></div>
    <div className="stats"><span>{t('Output direction')}</span><b>{t(inspection.direction)}</b></div>
    <section aria-label={t('Input inventory')}><div className="stats"><span>{t('Input buffer')}</span><b>{inventoryTotal(inspection.input)}{inspection.inputCapacity !== null ? ` / ${inspection.inputCapacity}` : ' queued'}</b></div><InventoryView inventory={inspection.input} expected={inspection.inputCapacity === null ? inspection.inputCapacities : inspection.requirements} capacities={inspection.inputCapacities} /></section>
    <section aria-label={t('Output inventory')}><div className="stats"><span>{t('Output buffer')}</span><b>{inventoryTotal(inspection.output)} / {inspection.outputCapacity}</b></div><InventoryView inventory={inspection.output} expected={inspection.products} /></section>
    <div className="stats"><span>{t('Reserved output slots')}</span><b>{inventoryTotal(inspection.reserved)}</b></div>
    {inventoryTotal(inspection.reserved) > 0 && <section aria-label={t('Reserved products')}><InventoryView inventory={inspection.reserved} /></section>}
    <div className="stats"><span>{t('Processing progress')}</span><b>{Math.round(inspection.progress * 100)}%</b></div>
    <progress aria-label={furnace ? t('Smelting progress') : t('Crafting progress')} value={inspection.progress} max={1} />
    {inspection.status === 'processing' && <p className="inspection-note">{t('Recipe ingredients committed to this batch.')}</p>}
    {inspection.outputWaiting && <p className="inspection-warning" role="status">{t('Output waiting for transport')}</p>}
  </>
}
