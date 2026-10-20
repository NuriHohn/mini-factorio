# Implemented architecture

This describes the current source, including offline persistence and categorized build tools. Gameplay values and selection policies are maintained in [Game design](GAME_DESIGN.md); proposed systems belong in [Roadmap](ROADMAP.md).

## Ownership and source map

TypeScript spans all layers. Simulation modules have no React, Phaser, Zustand or DOM dependency. Functions mutate an explicitly supplied `World`; `FactoryScene` owns the live instance. React never owns a second simulation or receives mutable inventories. Phaser owns rendering/input; Zustand carries commands and copied summaries. Gameplay timers and decisions use simulation state, never wall-clock timers or rendering callbacks.

| Source | Responsibility |
| --- | --- |
| [`world.ts`](../src/simulation/world.ts) | `World`, building union, flat terrain/building arrays, injectable generation, direction helpers, placement/removal validation |
| [`items.ts`](../src/simulation/items.ts) | `ITEM_DEFINITIONS`, ore/plate/component categories, typed IDs and inventory helpers |
| [`recipes.ts`](../src/simulation/recipes.ts) | `RECIPES`, quantities, durations, compatibility, `MACHINE_DEFINITIONS`, `hasRecipeInputs` |
| [`step.ts`](../src/simulation/step.ts) | `advanceWorld`, elapsed remainder, fixed-step orchestration and mining |
| [`splitters.ts`](../src/simulation/splitters.ts) | Compact 1×1 relative ports/directions and stage duration; scheduling commits in shared transport |
| [`splitterPath.ts`](../src/game/splitterPath.ts), [`SplitterInspector.tsx`](../src/game/SplitterInspector.tsx) | Continuous intake/front/left visual paths and copied status presentation |
| [`transport.ts`](../src/simulation/transport.ts) | Shared belt/splitter transfer arbitration, recipe/input reservations, staged routing and buffered machine output |
| [`inserters.ts`](../src/simulation/inserters.ts) | Step-start source budgets, deterministic pickup/delivery, powered swing/return, held items and port/status queries |
| [`crafting.ts`](../src/simulation/crafting.ts) | Shared jobs, power-scaled processing, output reservations, status and assembler mode/manual validation |
| [`smelting.ts`](../src/simulation/smelting.ts) | Furnace incoming recipe probes and `changeFurnaceRecipe`; legacy processing exports delegate to shared crafting |
| [`assemblerRecipes.ts`](../src/simulation/assemblerRecipes.ts) | One-time Auto candidate selection/locking, initial wait clock and per-item capacities |
| [`navigation.ts`](../src/simulation/navigation.ts) | Shared stable cardinal neighbors, breadth-first reachability and paths for Pete/police |
| [`police.ts`](../src/simulation/police.ts) | Radar queries, single dispatch, pursuit/arrest/transport, timed imprisonment/release, actor/exit reservations and lifecycle validation |
| [`policeVisuals.ts`](../src/game/policeVisuals.ts) | Radar/prison graphics, flash, car/passenger, bars and jailbreak dust |
| [`pete.ts`](../src/simulation/pete.ts) | Seeded NPC movement/pathfinding, scare hit testing, projectile impact and authoritative sabotage timers |
| [`sprinklers.ts`](../src/simulation/sprinklers.ts) | Full-power/range queries, deterministic targeting, water phases, source removal and obstacle-aware escape |
| [`sprinklerVisuals.ts`](../src/game/sprinklerVisuals.ts) | Procedural sprinkler/jet/wet Pete and bounded cosmetic puddles |
| [`peteVisuals.ts`](../src/game/peteVisuals.ts) | Procedural goblin, pumpkin/web/tear animation and transient sabotage splatter |
| [`power.ts`](../src/simulation/power.ts) | Cached networks, assignment, working demand, allocation and read-only pole preview |
| [`inspection.ts`](../src/simulation/inspection.ts) | Copied building/electrical snapshots and derived world statistics |
| [`beltConnections.ts`](../src/simulation/beltConnections.ts) | Topology-derived visual inputs and stable primary lane |
| [`FactoryScene.ts`](../src/game/FactoryScene.ts) | Live world, input, command validation, stepping, procedural rendering and summary publication |
| [`beltPath.ts`](../src/game/beltPath.ts) | Pure tile-local straight/quarter-circle paths for lanes and item positions |
| [`inserterArm.ts`](../src/game/inserterArm.ts), [`InserterInspector.tsx`](../src/game/InserterInspector.tsx) | Pure arm path and copied inserter-state presentation |
| [`cameraMovement.ts`](../src/game/cameraMovement.ts) | Framework-independent movement, normalized diagonals and viewport-aware bounds |
| [`GameCanvas.tsx`](../src/game/GameCanvas.tsx) | Phaser host/effect, resize observer and cleanup |
| [`gameStore.ts`](../src/state/gameStore.ts) | Authoritative tool enum, shared toggle/hotkey/inspection actions, direction, recipe intents and copied summaries |
| [`App.tsx`](../src/App.tsx) | React sidebar composition, statistics, inspector and electricity overview |
| [`toolMetadata.ts`](../src/state/toolMetadata.ts), [`BuildToolbar.tsx`](../src/game/BuildToolbar.tsx) | Central player-tool/hotkey/category metadata and tabbed tool presentation |
| [`saveGame.ts`](../src/persistence/saveGame.ts), [`validation.ts`](../src/persistence/validation.ts) | Versioned JSON encoding, strict validation, detached reconstruction and reference linking |
| [`storage.ts`](../src/persistence/storage.ts), [`SaveControls.tsx`](../src/game/SaveControls.tsx) | Independent offline slots, active-gameplay autosave cadence, feedback and UI commands |
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
5. `allocatePower`: refresh topology if invalidated, then calculate current demand and proportional supply. `advancePolice` then uses this current allocation for detection, advances one police operation or releases/escapes a prisoner. `advanceSprinklers` then uses the same current allocation; a dispatched/committed police case blocks new spraying.
6. `advanceInserters`: atomically pick up/deliver in inserter tile order using allocated power and the step-start budget.
7. `advanceCrafting`: progress/complete existing jobs, finalize undecided assembler detection, and start eligible jobs without changing locked recipes.
8. Mining: advance unblocked miners by allocated power fraction; buffer completed ore and update `mined`.

Each fixed step first advances `World.timeMs` by 50 ms and runs `advancePete`. Projectile impacts set a building-owned absolute `sabotageUntilMs`; power allocation sees that state in the same boundary. `sabotageRemaining` is the shared read-only timer query for allocation, inspection and visuals. Suppressing working demand reuses existing zero-speed production pause behavior without modifying jobs or duplicating crafting logic. Normal transport/export remains unchanged.

New crafting jobs begin with zero elapsed time; finished products export on a later step. An assembler completing a job keeps its locked recipe and may start the next batch at that boundary. Readiness newly supplied by an inserter receives processing power on a subsequent allocation; new jobs still start at zero. Phaser also calls `allocatePower` after stepping for current visual/inspection data; that call does not advance simulation time.

## Crafting and inventories

Recipes contain quantity maps rather than one hardcoded ingredient/product. Furnace and assembler selection policies feed the same `canStartCrafting`/`advanceCrafting` core. Manual changes pass `recipeChangeError` and compatibility checks; UI disabling alone is insufficient.

Job creation atomically checks complete ingredients and output space, subtracts ingredients, and stores `ProcessingJob.inputs`, `outputs`, `recipeId` and `elapsedMs`. Committed inputs leave the input buffer but remain accountable in the job. Job outputs reserve capacity; they are not physical products yet. Completion atomically adds all outputs, increments `World.produced` by their actual quantities, and clears the job once. Missing input or insufficient output space prevents a new job. Zero power preserves jobs and prevents starting; fractional supply scales elapsed processing by machine crafting speed.

Furnace `incomingRecipe` is a read-only probe; transport reserves its chosen recipe across simultaneous deliveries. `assemblerRecipes.ts` owns the distinct assembler detection/waiting policy. Both feed shared crafting through simulation-owned `recipeLocked`, job and buffer state; selection must not move into rendering or a second crafting engine. The authoritative Auto/Manual policies, retained pre-lock stock and switching restrictions are in [Game design](GAME_DESIGN.md#automatic-and-manual-recipes).

## Transport and electricity

Transport first plans against unchanged occupancy, reserving capacity per destination and item, then commits accepted transfers. Furnace recipe reservations prevent mixed simultaneous arrivals selecting different recipes. Source tile order resolves competing inputs. New arrivals do not travel twice in the same step. Machine outputs target only front belts and choose the first available product in item registry order, one unit per machine per step. Rejections retain the source item. Visual input priority is separate from transport arbitration.

Inserters reuse `canReceive`/`deliverItem` from transport for ports, input limits, belt occupancy and furnace recipe detection. They extract finished output only, select chest items in item registry order among currently acceptable candidates, and remove a physical unit into their own held-item field. Carrying does not reserve future destination capacity: delivery is revalidated, so blocking, removal or recipe changes retain the item safely. The half-second outward and return phases advance with allocated power. Reaching a blocked drop point stops demand until delivery becomes possible.

The ephemeral `InserterFrame` bounds pickups by old source quantities even if belts or earlier inserters add replacement units. Initially occupied destination belts remain unavailable to inserter delivery for that step. Existing belt transfers and automatic machine belt output run first; inserter claims then commit sequentially in stable tile order against current quantities and capacities. This prevents overbooking and passing new arrivals through two transfers in one step. The frame is not stored in world or UI state.

Power topology is cached against `topologyRevision`; successful placement/removal increments it. Pole edges join connected components. Machines/generators use their lowest-index covering pole, giving one deterministic network assignment. Coverage overlap alone never joins networks. `allocatePower` recomputes working demand each call and supplies each requesting consumer at `min(1, network capacity / network demand)`. Uncovered consumers receive zero. `powerOverview` keeps network surpluses separate from deficits. `polePlacementPreview` uses the same connectivity functions without mutating topology.

## Commands, rendering and lifecycle

Toolbar clicks and non-repeating placement/deletion hotkeys use the same atomic `select` toggle action; Escape explicitly requests null and is idempotent in normal mode. `tool` is the only placement/removal authority: React derives `aria-pressed` and styling from it, while Phaser reads it for previews and click behavior. Inspection is admitted only when it is null. Player-facing toggling, Escape, focus and category rules are in [Game design](GAME_DESIGN.md#world-items-and-controls). A scene-managed DOM key listener delivers Escape even with form focus and is removed on scene shutdown; other tool keys ignore form editing.

React sends a recipe intent through Zustand; `FactoryScene.update` revalidates it against the live building before stepping. `inspectBuilding`, `electricalDetails` and `worldStats` derive copied summaries. Store publication compares values and avoids unchanged updates; item positions stay outside Zustand.

Phaser draws terrain, machines, wires, coverage, items and placement previews procedurally. Furnace glow and assembler gear angles derive from actual job elapsed time, so processing animation pauses without power. Inserter arms and held-item positions follow their actual powered phase elapsed time, using a pure tile-local swing path. Straight/curved item paths use the actual belt entry; topology connections remain visible when empty. Pole preview links are cached by hovered tile and topology revision in world coordinates, so camera transforms do not require connectivity recalculation. React's canvas effect disconnects its observer and destroys Phaser on cleanup, including Strict Mode remounts.

## Invariants and extension points

Preserve nonnegative integer quantities, complete atomic batches, output inventory plus reservations within capacity, and stable transfer/selection priorities. Count active job inputs and held inserter items in material conservation, never promised outputs. A gear represents two iron units; a cable half a copper unit; a circuit one iron plus 1.5 copper units. Deliberate building removal is the discard exception and preserves lifetime counters. Chest totals are stored inventory, not total world inventory.

Preserve existing item/recipe/building IDs and reuse the item/recipe/machine registries, shared crafting, transport, power and inspection systems. Placement, capacity and recipe/mode changes must be validated by simulation APIs, not only UI checks. Extend the existing metadata and shared core before adding special cases. Keep future machine ports/capacity policies in simulation data, invalidate topology through supported operations, and extend snapshot/UI presentation without exposing live state. Do not introduce a second crafting engine or renderer-dependent planning rules. Preserve the two distinct Auto policies and their regression suites.

## NPC state and rendering lifetime

`World.pete` holds a normal, web-reaction, police-custody or water-reaction state, tile-to-tile interpolation, a seeded 32-bit LCG, escape path, cooldown, crying/web clocks and at most one in-flight pumpkin. Pete and police share stable cardinal neighbor order and breadth-first path queries; breadth-first search only runs for a new escape route or topology change. For web fleeing, a reachable destination minimizes distance to any corner, then tile index. Wandering tests empty adjacent tiles; construction reserves Pete's current/next tile, and cached pole previews include these reservations in their key.

Projectile snapshots retain the target building identity as well as its tile index: deletion/replacement cannot redirect a hit. The target reference is serializable with `structuredClone`, and no unbounded event history is retained. Elapsed sabotage timestamps on removed buildings have no world effect. Existing fixed-step remainders make behavior independent of frame partitions.

Phaser checks Pete's world-space hit region before tool/inspection dispatch. A consumed click cannot place/delete a building, including repeated clicks during fleeing/crying. Eligible free-Pete clicks restart only the bounded web animation; protected water/custody clicks are consumed without a scare. The [gameplay click/state rules](GAME_DESIGN.md#pumpkin-pete) determine eligibility. Movement carries unused fixed-step time across tile boundaries and uses shared walking/fleeing constants. Zustand only dispatches this command and copied inspection data; NPC positions/inventories remain authoritative in the scene's world. Camera conversion is shared with building clicks.

A single reused graphics layer redraws Pete, the bounded projectile/web effect and currently sabotaged buildings. Splatter reads building position and authoritative remaining time on every frame; no particle objects or independent expiry timers are allocated. It disappears on expiry or deletion, with a building-identity check guarding stale references. Bubbles, tears and walking bobs derive from simulation time, so rendering cannot extend a disable duration. One reused text object labels Pete.

## Police custody invariants

`World.police` owns at most one car/case, a bounded radar-flash snapshot, retry time, and a topology-revision cache of radar indices. Empty factories do not run a tile scan per step. Radar demand and full-allocation detection use the shared simulation power/range queries, never a Phaser approximation; values are in [Game design](GAME_DESIGN.md#police-radar-traps-and-prison). Dispatch is arbitrated by radar tile order after allocation. Prison creation uses supported placement and invalidates topology; it never overwrites a building or consumes the only reachable edge entry.

The car holds its continuous position, current/next tile, bounded route, route revision/target, `RESPONDING`/`ARRESTING`/`TRANSPORTING` phase, arrest elapsed time and the prison building identity. Routes replan at tile boundaries when the target or topology changes. Construction reserves car current/next tiles and prison exits. Obstructed/unreachable return routes abort safely with the passenger released, not moved through a wall.

Pete adds `ARRESTED`, `TRANSPORTED`, `IMPRISONED`, a prison identity, imprisonment start boundary, re-arrest grace deadline and bounded jailbreak snapshot. His cooldown still advances in `advancePete`, but custody stops independent movement and sabotage. Arrest cancels in-flight pumpkin state. Prison arrival records `imprisonedAtMs`; escape compares elapsed simulation time against the shared imprisonment duration. Release/escape sets the shared absolute grace deadline without touching sabotage cooldown. Gameplay durations belong to [police/prison rules](GAME_DESIGN.md#police-radar-traps-and-prison).

The prison inspector receives copied elapsed/remaining times, occupancy and an imprisonment timestamp token. Zustand queues `{index, imprisonedAtMs}` release intent; the scene applies it through `releasePete` before stepping. Validation checks current mode, building identity and timestamp, so duplicate/stale commands cannot release another case. Switching tools/inspection cancels pending release intent. Imprisoned Pete yields pointer priority to his prison; during arrest/transport his clicks remain consumed. Removal is handled synchronously through the supported building-removal hook, which frees a captive or cancels an arrival before the prison disappears.

Graphics reuse the existing effects layer and simulation snapshots; flashing lights, angry eyebrows, shaking bars and dust have no gameplay authority or independent timers. An empty prison remains inspectable. Removing it immediately removes bars; jailbreak dust is bounded and naturally expires. Police/prisons have no item inventories and do not participate in transport or recipes.

## Compact splitter extension

`Splitter` is one logical 1×1 building in the existing flat building array. It adds a direction, optional intake packet, two optional outgoing packets (front/left), next-output preference, per-output delivered counts and placement time. Packets hold an item type and stage progress; capacity is bounded at three total. No multi-tile occupancy structure or second transport engine is introduced.

`advanceTransport` orders sources by tile, then front/left output slot. It ages only existing belts/packets, reserves all external belt/splitter deliveries against unchanged occupancy and shared machine recipe/capacity maps, then plans intake-to-output routes against unchanged slots. External deliveries commit before internal routes, but all plans predate either commit. New arrivals cannot be routed, just-vacated output slots cannot be reused, and new outgoing packets start at zero progress. A route changes the round-robin preference only when committed; in-flight destination capacity is rechecked on actual delivery rather than reserved for 250 ms. Stuck output packets never block the other outgoing slot.

Shared `canReceive`/`deliverItem` enforce rear-only splitter input and one intake reservation. `createInserterFrame` budgets physical outgoing packets; extraction rechecks the correct front/left slot, readiness, direction and budget, then counts the departure once. Existing buffers, recipes, actor occupancy, topology invalidation and machine exports keep their existing rules.

`splitterDirections`/`splitterPorts` are the shared geometry authority for preview, transport, belt connections, inspection and inserters. Pure game path functions join rear edge → center → selected edge continuously and align with neighboring belt entry. Phaser draws static branching lanes and interpolates only simulation packet progress; no routing decisions occur in rendering. Inspector packets/arrays are value copies. Delivered average is cumulative departures divided by simulation time since placement, not an instantaneous throughput estimate.

## Versioned offline persistence

`src/persistence/saveGame.ts` owns `SAVE_FORMAT` and `SAVE_VERSION` (currently 2), JSON snapshots and detached reconstruction. `validation.ts` validates every required field, rejects unknown fields/IDs, checks finite bounded numbers, complete inventories, ports, buffer limits, recipe/job reservations, actor movement and cross-object references. No Phaser or React imports are needed. JSON is limited to 2 MiB. Version 1 (Sprint 9) is explicitly accepted with its original strict Pete/building shape, then reconstructed with `water: null`; it cannot contain new sprinkler buildings or water fields/modes. All other authoritative values and references follow the same validation and reconstruction. Subsequent saves write version 2. Unknown versions are rejected clearly; there is no best-effort partial loading.

The document contains `{ format, version, savedAt, map, game, view }`. `savedAt` is ISO UTC wall-clock metadata only. `map` records the supported dimensions. `game` contains tiles, tile-indexed buildings, counters, time/remainder, topology revision, Pete's RNG/movement/effects/timers and police/prison authoritative state. Building fields retain all item packets, elapsed progress, recipe modes/locks, committed jobs/reserved outputs, inventories and splitter round robin/counters. Object references (prison and pumpkin target) become validated building indices, then are linked to candidate building objects on decode. A projectile whose target was already deleted is omitted, matching its next-step cancellation; no resource or timer is discarded.

Power allocations/networks and police radar caches are derived and excluded. Decoder rebuilds power from buildings and invalidates the radar cache. Path/topology revisions remain serialized because they affect deterministic navigation decisions; cached future paths may be stale after placement and are revalidated by normal movement logic. Phaser graphics, input listeners, React state, active tools, inspection commands, DOM objects and file handles are never serialized. `view` restores camera scroll/zoom, output direction and power overlay; tool/inspection reset is intentional.

`SaveSession` in `storage.ts` owns two localStorage keys: `mini-factorio.manual-save` and `mini-factorio.autosave`. It uses consistent synchronous snapshots, prevents reentrant saves, tracks last-success timestamps and accumulates active gameplay against `AUTOSAVE_INTERVAL_MS`. The save controls/cadence are documented in [Game design](GAME_DESIGN.md#offline-save-and-load). Autosave never writes the manual slot. Storage exceptions do not erase old data. `download.ts` creates a local JSON download, with no network service or extra dependency. Persistence uses no backend, accounts, tokens, IndexedDB or named-slot manager.

React `SaveControls` sends commands through Zustand. `FactoryScene` validates/reconstructs first, confirms replacement, stages terrain graphics while hidden and commits the candidate into the existing scene. Failure restores the old world/view/store; old terrain is destroyed only after success. Loading never restarts the scene or registers more listeners/loops. Confirmation-frame deltas are discarded so time spent in the browser dialog is not replayed into the simulation. Load/import/export do not write a browser slot. Startup only reads metadata; loading is explicit.

### Extending persistence

Keep stable building/item/recipe IDs. When authoritative fields change, update the encoder, strict validator and round-trip/determinism/corruption tests together. An incompatible schema needs a new `SAVE_VERSION`; add an explicit migration and fixture tests before claiming older-version support. Do not add silent defaults that drop items, jobs or NPC timers. Keep derived caches outside the file and reconstruct them through simulation APIs.

### Build menu metadata

`src/state/toolMetadata.ts` is the central source for player-selectable tools, labels, hotkeys and Factory/Pumpkin Pete category membership. `BuildToolbar` renders the selected category; `gameStore` remains the single authority for active tool and tab. Selecting a cross-category hotkey updates both together. Category changes call the same tool cancellation action as Escape. Automatic entities are absent from the tool registry. Save controls are a separate sidebar section and never become build tools.

## Sprinkler and water reaction ownership

`Sprinkler` adds only `cooldownUntilMs` and completed `sprays` to the one-tile building union. `sprinklers.ts` reuses shared power, Euclidean range, cardinal neighbors and breadth-first paths. It adds no inventory, transport branch, recipe or independent NPC loop. Placement/removal still invalidates topology normally. Demand and readiness/jet checks reuse `SPRINKLER_KW` and current allocation; [Game design](GAME_DESIGN.md#anti-goblin-sprinkler) owns the values and power-interruption behavior.

`Pete.water` is null outside `SPRAYED`/`SLIPPING`/`COMPLAINING`/`WATER_FLEEING`. During a reaction it holds the source position snapshot, an active source index only while spraying, remaining phase milliseconds and deterministic complaint index. Existing Pete tile/next/progress/path/revision/escape fields carry navigation. Stationary phases preserve sub-tile position and reserve existing current/next tiles; entering/leaving water fleeing rescales interpolation to/from ordinary movement speed without teleporting. The reachable escape destination maximizes squared distance from the source, ties by tile index, with topology-based replanning. Reaching the destination/enclosure does not shorten the reaction or trigger crying.

`advancePete` always advances shared sabotage/web/jailbreak clocks first. Water slip/complaint/flee phases advance there and return before ordinary wandering/sabotage. Spraying waits until `advanceSprinklers` after current power allocation and police processing; its first boundary initializes the shared spray duration without aging immediately. Completion initializes slipping and the source cooldown once. Later reaction phases use their shared unscaled simulation-time constants; durations are in the [reaction table](GAME_DESIGN.md#anti-goblin-sprinkler). Step-start water state suppresses new sprinkler activation on the same boundary that its reaction ends; this ephemeral guard is reconstructed naturally from saved state. Police dispatch wins simultaneous eligibility; existing approach/custody and post-release grace block activation. Water reactions block new dispatch, not committed cases. Interrupting the projectile discards only its not-yet-landed action and never changes already-disabled machines or sabotage cooldown.

Version-2 persistence validates the phase/mode pair, 50 ms bounded phase time, source type/position, complaint index, cooldown, navigation and absence of conflicting custody/projectile/grace state. Source deletion synchronously starts slipping and clears its index; later navigation uses a position snapshot rather than a removed building reference. Version-1 upgrade is explicit and tested; slots are not overwritten by migration/loading. Detached reconstruction and transactional scene restoration remain unchanged. No rendering entities are saved.

`WaterVisuals` samples rendered flee positions at most every 400 simulation ms into a maximum of 14 puddles, expiring after 5 seconds. This cosmetic history resets on world replacement and never affects movement, resources, placement or power. Immediate-mode jets/droplets/slip splashes and wet-goblin poses have bounded draw counts. The existing single Pete text label becomes the complaint bubble text, so loads and repeated reactions do not add labels/listeners/emitters.
