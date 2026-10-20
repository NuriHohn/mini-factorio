# Implemented architecture

This describes the current source, including assembler Auto detection and basic inserters. Gameplay values and selection policies are maintained in [Game design](GAME_DESIGN.md); proposed systems belong in [Roadmap](ROADMAP.md).

## Ownership and source map

TypeScript spans all layers. Simulation modules have no React, Phaser, Zustand or DOM dependency. Functions mutate an explicitly supplied `World`; `FactoryScene` owns the live instance. React never owns a second simulation.

| Source | Responsibility |
| --- | --- |
| [`world.ts`](../src/simulation/world.ts) | `World`, building union, flat terrain/building arrays, injectable generation, direction helpers, placement/removal validation |
| [`items.ts`](../src/simulation/items.ts) | `ITEM_DEFINITIONS`, ore/plate/component categories, typed IDs and inventory helpers |
| [`recipes.ts`](../src/simulation/recipes.ts) | `RECIPES`, quantities, durations, compatibility, `MACHINE_DEFINITIONS`, `hasRecipeInputs` |
| [`step.ts`](../src/simulation/step.ts) | `advanceWorld`, elapsed remainder, fixed-step orchestration and mining |
| [`transport.ts`](../src/simulation/transport.ts) | Snapshot transfer arbitration, input reservations, commit and buffered machine output |
| [`inserters.ts`](../src/simulation/inserters.ts) | Step-start source budgets, deterministic pickup/delivery, powered swing/return, held items and port/status queries |
| [`crafting.ts`](../src/simulation/crafting.ts) | Shared jobs, power-scaled processing, output reservations, status and assembler mode/manual validation |
| [`smelting.ts`](../src/simulation/smelting.ts) | Furnace incoming recipe probes and `changeFurnaceRecipe`; legacy processing exports delegate to shared crafting |
| [`assemblerRecipes.ts`](../src/simulation/assemblerRecipes.ts) | One-time Auto candidate selection/locking, initial wait clock and per-item capacities |
| [`power.ts`](../src/simulation/power.ts) | Cached networks, assignment, working demand, allocation and read-only pole preview |
| [`inspection.ts`](../src/simulation/inspection.ts) | Copied building/electrical snapshots and derived world statistics |
| [`beltConnections.ts`](../src/simulation/beltConnections.ts) | Topology-derived visual inputs and stable primary lane |
| [`FactoryScene.ts`](../src/game/FactoryScene.ts) | Live world, input, command validation, stepping, procedural rendering and summary publication |
| [`beltPath.ts`](../src/game/beltPath.ts) | Pure tile-local straight/quarter-circle paths for lanes and item positions |
| [`inserterArm.ts`](../src/game/inserterArm.ts), [`InserterInspector.tsx`](../src/game/InserterInspector.tsx) | Pure arm path and copied inserter-state presentation |
| [`cameraMovement.ts`](../src/game/cameraMovement.ts) | Framework-independent movement, normalized diagonals and viewport-aware bounds |
| [`GameCanvas.tsx`](../src/game/GameCanvas.tsx) | Phaser host/effect, resize observer and cleanup |
| [`gameStore.ts`](../src/state/gameStore.ts) | Authoritative tool enum, shared toggle/hotkey/inspection actions, direction, recipe intents and copied summaries |
| [`App.tsx`](../src/App.tsx) | React toolbar, controls, statistics, inspector and electricity overview |
| [`CraftingInspector.tsx`](../src/game/CraftingInspector.tsx), [`PowerInspector.tsx`](../src/game/PowerInspector.tsx), [`InventoryView.tsx`](../src/game/InventoryView.tsx) | Derived-value presentation; no production math or world mutations |
| [`main.tsx`](../src/main.tsx), [`index.css`](../src/index.css), [`vite.config.ts`](../vite.config.ts) | Strict Mode entry, active styles, React/Tailwind Vite plugins |

`App.css` and starter assets remain in the repository but are not used by the current application. Tests are colocated with source; see [Development](DEVELOPMENT.md#regression-coverage).

## State and exact update order

`World` holds ore-ID-or-null terrain, tile-indexed buildings (`y * SIZE + x`), per-item lifetime `mined`/`produced` inventories, elapsed remainder, topology revision and derived power state. Buildings contain buffers, belt progress/entry direction, machine jobs and selection state, plus inserter phase, elapsed swing time and held item. Terrain generation accepts an RNG; equal initial state and equal inputs/time progression must produce equivalent outcomes.

`advanceWorld` rejects nonpositive/nonfinite deltas, retains elapsed remainder and runs complete **50 ms** steps in this order:

1. `createInserterFrame`: capture relevant old source quantities and initially occupied destination belts.
2. `advanceTransport`: advance existing belt items and commit reserved transfers.
3. `outputMachines`: export buffered miner/furnace/assembler items; exclude belts just vacated by belt transport.
4. `prepareAssemblerRecipes`: resolve idle Auto recipes and advance unscaled waiting clocks before computing working demand.
5. `allocatePower`: refresh topology if invalidated, then calculate current demand and proportional supply.
6. `advanceInserters`: atomically pick up/deliver in inserter tile order using allocated power and the step-start budget.
7. `advanceCrafting`: progress/complete existing jobs, finalize undecided assembler detection, and start eligible jobs without changing locked recipes.
8. Mining: advance unblocked miners by allocated power fraction; buffer completed ore and update `mined`.

New crafting jobs begin with zero elapsed time; finished products export on a later step. An assembler completing a job keeps its locked recipe and may start the next batch at that boundary. Readiness newly supplied by an inserter receives processing power on a subsequent allocation; new jobs still start at zero. Phaser also calls `allocatePower` after stepping for current visual/inspection data; that call does not advance simulation time.

## Crafting and inventories

Recipes contain quantity maps rather than one hardcoded ingredient/product. Furnace and assembler selection policies feed the same `canStartCrafting`/`advanceCrafting` core. Manual changes pass `recipeChangeError` and compatibility checks; UI disabling alone is insufficient.

Job creation atomically checks complete ingredients and output space, subtracts ingredients, and stores `ProcessingJob.inputs`, `outputs`, `recipeId` and `elapsedMs`. Committed inputs leave the input buffer but remain accountable in the job. Job outputs reserve capacity; they are not physical products yet. Completion atomically adds all outputs, increments `World.produced` by their actual quantities, and clears the job once. Missing input or insufficient output space prevents a new job. Zero power preserves jobs and prevents starting; fractional supply scales elapsed processing by machine crafting speed.

Furnace `incomingRecipe` is read-only; transport reserves its chosen recipe across simultaneous deliveries. Assembler Auto examines buffered quantities only until its initial decision: candidates can change during the initial wait, then `recipeLocked` prevents all further automatic selection. Furnace detection locks on accepted ore. Manual selection also locks, and a locked building cannot rearm Auto. Initial wait and lock state live in simulation, not the renderer; unrelated pre-lock stock is retained and future deliveries are filtered by the locked ingredients. Exact policies and capacities: [Game design](GAME_DESIGN.md#automatic-and-manual-recipes).

## Transport and electricity

Transport first plans against unchanged occupancy, reserving capacity per destination and item, then commits accepted transfers. Furnace recipe reservations prevent mixed simultaneous arrivals selecting different recipes. Source tile order resolves competing inputs. New arrivals do not travel twice in the same step. Machine outputs target only front belts and choose the first available product in item registry order, one unit per machine per step. Rejections retain the source item. Visual input priority is separate from transport arbitration.

Inserters reuse `canReceive`/`deliverItem` from transport for ports, input limits, belt occupancy and furnace recipe detection. They extract finished output only, select chest items in item registry order among currently acceptable candidates, and remove a physical unit into their own held-item field. Carrying does not reserve future destination capacity: delivery is revalidated, so blocking, removal or recipe changes retain the item safely. The half-second outward and return phases advance with allocated power. Reaching a blocked drop point stops demand until delivery becomes possible.

The ephemeral `InserterFrame` bounds pickups by old source quantities even if belts or earlier inserters add replacement units. Initially occupied destination belts remain unavailable to inserter delivery for that step. Existing belt transfers and automatic machine belt output run first; inserter claims then commit sequentially in stable tile order against current quantities and capacities. This prevents overbooking and passing new arrivals through two transfers in one step. The frame is not stored in world or UI state.

Power topology is cached against `topologyRevision`; successful placement/removal increments it. Pole edges join connected components. Machines/generators use their lowest-index covering pole, giving one deterministic network assignment. Coverage overlap alone never joins networks. `allocatePower` recomputes working demand each call and supplies each requesting consumer at `min(1, network capacity / network demand)`. Uncovered consumers receive zero. `powerOverview` keeps network surpluses separate from deficits. `polePlacementPreview` uses the same connectivity functions without mutating topology.

## Commands, rendering and lifecycle

Toolbar clicks and non-repeating placement/deletion hotkeys use the same atomic `select` toggle action; Escape explicitly requests null and is idempotent in normal mode. `tool` is the only placement/removal authority: React derives `aria-pressed` and styling from it, while Phaser reads it for previews and click behavior. Inspection is admitted only when it is null. Overlay and keyboard focus have separate visual styles and do not represent active tools.

React sends a recipe intent through Zustand; `FactoryScene.update` revalidates it against the live building before stepping. `inspectBuilding`, `electricalDetails` and `worldStats` derive copied summaries. Store publication compares values and avoids unchanged updates; item positions stay outside Zustand.

Phaser draws terrain, machines, wires, coverage, items and placement previews procedurally. Furnace glow and assembler gear angles derive from actual job elapsed time, so processing animation pauses without power. Inserter arms and held-item positions follow their actual powered phase elapsed time, using a pure tile-local swing path. Straight/curved item paths use the actual belt entry; topology connections remain visible when empty. Pole preview links are cached by hovered tile and topology revision in world coordinates, so camera transforms do not require connectivity recalculation. React's canvas effect disconnects its observer and destroys Phaser on cleanup, including Strict Mode remounts.

## Invariants and extension points

Preserve nonnegative integer quantities, complete atomic batches, output inventory plus reservations within capacity, and stable transfer/selection priorities. Count active job inputs and held inserter items in material conservation, never promised outputs. A gear represents two iron units; a cable half a copper unit; a circuit one iron plus 1.5 copper units. Deliberate building removal is the discard exception and preserves lifetime counters. Chest totals are stored inventory, not total world inventory.

Extend the existing item/recipe/machine metadata and shared core before adding special cases. Keep future machine ports/capacity policies in simulation data, invalidate topology through supported operations, and extend snapshot/UI presentation without exposing live state. Do not introduce a second crafting engine or renderer-dependent planning rules. Preserve the two distinct Auto policies and their regression suites.
