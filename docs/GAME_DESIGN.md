# Implemented game design

The game is an offline browser factory sandbox with local saves. The following rules are implemented; [Roadmap](ROADMAP.md) contains proposals, not available mechanics. This document owns player-visible rules and values; implementation and resource-accounting contracts are in [Architecture](ARCHITECTURE.md).

## World, items and controls

The world is 40×40 tiles with one building per tile, unlimited deposits and free placement of researched buildings. Random clusters have injectable generation; distinct starter patches are guaranteed around iron `(20, 20)` and copper `(26, 20)`. Miners require ore; other buildings can occupy any empty in-bounds tile.

| Item ID | Label | Category |
| --- | --- | --- |
| `iron` | Iron ore | Ore; mineable |
| `copper` | Copper ore | Ore; mineable |
| `ironPlate` | Iron plate | Plate |
| `copperPlate` | Copper plate | Plate |
| `ironGear` | Iron gear | Component |
| `copperCable` | Copper cable | Component |
| `electronicCircuit` | Electronic circuit | Component |

Iron ore is blue-gray and copper ore orange-brown; plates are flat silver/copper rectangles. Components use gear, cable-loop and circuit-board shapes. Definitions: [`items.ts`](../src/simulation/items.ts).

Use WASD to move and the mouse wheel to zoom. Keys 1–9, 0 and G toggle the buildings below; B toggles Spider Web in the Pete tab; selecting another tool replaces the previous one. Pressing the active hotkey or clicking the active toolbar button cancels it. Deletion is mutually exclusive with placement; R rotates directional placement clockwise, X removes, P toggles the electricity overlay, and Escape cancels tools so clicking a building opens inspection. Escape in normal selection mode leaves that mode and any open inspection unchanged. Toolbar tool buttons suppress focus outlines for mouse and keyboard interaction; the existing green active-tool border identifies the selected tool. Buttons remain keyboard operable. Escape cancels even while a form control has focus; other tool hotkeys ignore text and recipe editing. The electricity-overlay toggle remains blue. Redirect an existing building by removing/replacing it. Removal discards contained items and active jobs but preserves lifetime mining/production. Normal placement previews are green/red for valid/invalid; pole colors are described below.

## Buildings and ports

| Key / building | Input and output | Capacity / full-power behavior |
| --- | --- | --- |
| 1 / Miner | On ore; outputs that ore only to front belt | One-item buffer; 1 ore per 1,000 ms; 30 kW |
| 2 / Belt | Rear/side belt, machine or inserter input; rejects head-on entry; outputs forward | One item; 500 ms travel; no electricity |
| 3 / Storage chest | Accepts belts/inserters from every side; extraction by inserter | Unlimited per-item inventory; no electricity |
| 4 / Furnace | Rear/side belts/inserters in, front belt or inserter out | Input 2 total; output 2 including reservations; 50 kW |
| 5 / Generator | Must be covered by a pole | 100 kW capacity; no fuel |
| 6 / Power pole | Links poles and covers generators/machines | 6-tile connection range; 3-tile coverage radius |
| 7 / Assembler | Rear/side belts/inserters in, front belt or inserter out | Per-item inputs below; output 4 including reservations; 60 kW |
| 8 / Inserter | One tile behind → one tile ahead; direction sets the arm ports | One held item; nominal 1 s cycle; 10 kW during movement |
| 0 / Compact splitter | One rear input; front and left outputs relative to orientation | 1×1; intake 1 + outgoing 1 per output; no electricity |
| 9 / Radar trap | Detects Pete within 3 tiles; full 5 kW allocation required | One tile; continuous 5 kW demand |
| G / Anti-Goblin Sprinkler | Detects Pete within 3 tiles; no item ports or recipes | One tile; continuous 5 kW demand; no water supply |

Furnaces and assemblers occupy one tile and have crafting speed 1.0. Neither needs fuel. Automatic machine output still targets belts; an intervening inserter can bridge a machine directly to another machine or chest. Output backpressure fills buffers and stops new work; a blocked miner does not accumulate blocked production time. Transport and already-buffered machine export continue without electricity.

Belts carry every item type and automatically draw straight/curved lanes from adjacent output directions, independent of item activity. Items animate along their actual input path. Rear visual input is primary, then sides in source tile order; transfer priority still follows source tile order. Newly delivered items move on the next simulation step, and just-vacated belts cannot be reused in the same step. Full loops jam; merges are deterministic, not fair.

## Basic inserters

Inserters occupy one empty tile and rotate with R before placement. The preview marks the pickup tile behind in amber and the drop tile ahead in green; both follow the camera/zoom. Edge placement is allowed but an out-of-world port cannot transfer. The inspector shows ports, connected building kinds, held item, phase/cycle progress, status and electrical allocation.

A powered idle arm takes one compatible item only when the current destination can accept it. Chests choose the first eligible item in registry order; this is deterministic, not a filter or fairness system. Belt items must have completed their 500 ms travel. Miner/furnace/assembler extraction is from the output face only; furnace/assembler inputs, committed jobs and reserved products cannot be extracted. Delivery uses the same rear/side machine and belt rules as direct connections, and can trigger furnace Auto detection or supply assembler Auto/Manual recipes.

The arm carries for 500 ms, delivers one item, then returns empty for 500 ms at full power. Initial pickup starts at zero elapsed time; a completed return may start the next pickup at that boundary, giving a nominal one-second repeating cycle. Both phases request 10 kW and scale with allocated power. Idle readiness also requests power to start; no power prevents pickup/delivery and freezes movement. Items remain in hand during outages. If a target fills, disappears or becomes incompatible mid-cycle, the arm finishes its outward swing and holds at the drop point, requesting no power while blocked. When space/compatibility and power return, it delivers and resumes. Destination capacity is rechecked at release, not reserved for the whole swing.

Existing belt transfers and automatic machine-to-belt output keep priority. Inserters then claim in tile order, limited by source quantities present at the beginning of the step. They cannot pick newly delivered stock or reuse a belt occupied at the start of that step. Direct belt-to-machine connections remain supported. Removing an arm discards its held item and preserves lifetime statistics. This basic model has no stack transfer, filter, long reach or direct inserter-to-inserter handoff.

## Recipes and buffers

Durations are processing time at full power, excluding assembler Auto waiting. Definitions: [`recipes.ts`](../src/simulation/recipes.ts).

| Recipe ID / machine | Ingredients | Products | Duration |
| --- | --- | --- | --- |
| `ironSmelting` / Furnace | 1 iron ore | 1 iron plate | 2,000 ms |
| `copperSmelting` / Furnace | 1 copper ore | 1 copper plate | 2,000 ms |
| `ironGear` / Assembler | 2 iron plates | 1 iron gear | 2,000 ms |
| `copperCable` / Assembler | 1 copper plate | 2 copper cables | 2,000 ms |
| `electronicCircuit` / Assembler | 1 iron plate + 3 copper cables | 1 electronic circuit | 3,000 ms |

Furnace input capacity is two queued items total. Assembler Manual input capacity is two batches per ingredient: gear 4 iron plates; cable 2 copper plates; circuit 2 iron plates and 6 cables. Before initial detection, Auto independently accepts up to **4 iron plates, 2 copper plates and 6 cables**. Once locked, only ingredients of that recipe are accepted, retaining their original Auto per-item capacities. Any previously buffered unrelated stock is preserved. A full buffer for one ingredient cannot prevent accepting another on a different input.

Committed job ingredients are outside queued input capacity. Output inventory plus reserved job products must fit the building's output capacity. A cable batch reserves two slots and increments lifetime cable production by two. Incompatible or excess items stay on their belts. Missing ingredients idle the machine; full output blocks new jobs. New jobs start at zero elapsed time and products can export on a subsequent simulation step.

## Automatic and manual recipes

**Furnaces:** Auto is the default, initially undetected. The first accepted compatible ore selects and permanently locks iron/copper smelting; simultaneous arrivals use source tile order. Draining every buffer does not reset the lock. Later incompatible ore stays on its belt or in the inserter's hand. Selecting a specific recipe manually also locks it. See [`smelting.ts`](../src/simulation/smelting.ts).

**Assemblers:** Newly placed machines require an explicit manual recipe in the inspector. Until selected, they accept no ingredients, request no working power and produce nothing. Only ingredients of the selected recipe are accepted, within the existing independent per-item capacities. There is no Auto option or detection delay. The selected recipe stays locked across empty buffers and Save & Load. See [`assemblerRecipes.ts`](../src/simulation/assemblerRecipes.ts) for input capacities and [`crafting.ts`](../src/simulation/crafting.ts) for validated selection.

An explicit recipe change on a configured furnace or assembler requires completely empty input/output buffers and no active job/reservations. Furnaces cannot rearm Auto after locking. Furnaces detect only when the incoming item identifies exactly one compatible recipe; ambiguous probes reject the item without choosing arbitrarily. Incompatible items remain on belts or held by inserters.

Legacy saves retain all jobs and stock, including unrelated speculative ingredients from former assembler Auto detection. Already locked recipes continue unchanged. Undecided legacy assemblers stop detecting and need a manual choice; their retained input may be used only by a recipe compatible with every buffered ingredient and capacity. Mixed legacy stock can still prevent safe selection; no input-buffer retrieval feature is implemented. Removal remains the explicit discard operation.

## Research and technology

New games start with **0 RP** and only **Basic Industry** researched. RP are an abstract currency, not an inventory item: no laboratories, science packs or additional recipes are needed. Productive miners earn **2 RP/min**, furnaces **5 RP/min**, and assemblers **12 RP/min** of actual processing time at full speed. Fractional power scales RP proportionally. Idle machines, missing ingredients, blocked outputs, unpowered or sabotaged machines earn nothing. Starting a crafting job grants no RP until it advances; finishing a batch credits only its remaining processing time. Miner fractional progress retains its existing carry behavior. Paused simulation never generates RP or catches up wall-clock time. Building removal preserves all earned RP.

| Stable technology ID | Technology | Cost | Prerequisite | Unlock |
| --- | --- | --- | --- | --- |
| `basicIndustry` | Basic Industry | 0 RP (default) | None | Miner, furnace, belts, chests, generators and power poles |
| `logistics1` | Logistics I | 30 RP | Basic Industry | Inserters |
| `automation1` | Automation I | 40 RP | Basic Industry | Assemblers and all existing assembler recipes |
| `logistics2` | Logistics II | 60 RP | Logistics I | Compact splitters |
| `analytics1` | Analytics I | 80 RP | Automation I | Production Analytics dashboard |

Purchases are manual, permanent and atomic: validate the prerequisite and full balance, deduct once, then unlock. Repeated purchases do not charge again. Placement is checked by the simulation; toolbar disabling cannot bypass research. Locked tools remain visible with the required technology, and locked hotkeys leave the current tool unchanged with explanatory feedback. After unlocking, all existing tool toggles, rotation and category behavior remain. Existing buildings keep running and remain inspectable/configurable. Pete tools, their hotkeys and automatic police/prison behavior remain available as before; Sprint 11 adds no technology for them.

The compact **Research** button shows available RP (two decimal places, truncated so an unaffordable technology never appears funded) and the current effective RP/min, excluding idle or blocked machines. It opens a separate, closable Technology dialog with prerequisite relationships, costs, unlock descriptions, researched/locked/available/affordable cards and selected-technology details. Purchases show a brief confirmation. Close or Escape restores focus to Research. Game tool/camera shortcuts are suspended inside the dialog; research and simulation continue. Opening Research collapses Analytics, keeping the two interfaces separate. Analytics remains visible but disabled with “Requires Analytics I” until unlocked; its underlying simulation and history collection always continue.

Research balance and technology IDs are persisted with nanosecond-resolution integer accounting; saving/loading preserves fractional RP exactly. Legacy version-1–4 saves initialize RP to 0 and unlock **all five** Sprint 11 technologies; retained buildings, production, inventories, analytics (where present), NPCs and saves keep their existing behavior. Version-5 malformed research state is rejected rather than silently reset.

## Production analytics

After researching Analytics I, the collapsible right-side panel shows actual production and consumption in **items/min over (now − 60 seconds, now] of simulation time**. At startup it uses the same fixed 60-second denominator without extrapolation. Mining counts creation at ore completion; crafting counts ingredient consumption when a job commits, and all product quantities when it completes. Reserved outputs, belts, inserters, chests and other relocations never count. Discarding a building does not subtract historical production or consumption.

History uses aligned, half-open **60-second buckets** intersecting the last **10 simulation minutes** (at most 11 buckets including boundary minutes); missing buckets are zero. The current minute is partial, with no extrapolation; the oldest intersecting minute supplies boundary context. Up to three item lines can be selected. Initially the chart follows the three most recently productive types, breaking simultaneous ties by item registry order; explicit choices stay selected until “Follow recent production” is clicked.

Configured production machines are miners on deposits and furnaces/assemblers with a locked recipe. Undetected furnaces, unconfigured assemblers, transport and power infrastructure are excluded. Utilization is productive simulation time divided by observed time since the current task was configured, averaged equally across currently configured machines. Configured idle machines contribute zero; advancing at reduced power counts as active processing. A newly started crafting job receives no processing time until the next step. Recipe changes start a fresh task measurement; removing a machine removes its utilization/diagnostic record, preserving global item history.

One bottleneck per configured machine becomes active after **10 continuous simulation seconds** with the same inactivity cause, in priority order **Sabotaged → No Power → Output Blocked → Missing Input**. No Power means no assigned generating network, not a zero idle request or merely reduced supply. A changed cause starts a fresh timer; resolved causes clear on the next fixed step. Longest-lasting problems sort first, with tile order breaking ties. Clicking one cancels tools, centers the existing camera and opens the machine inspector. Timers and history never advance while simulation is paused.

Analytics is saved and restored with production progress. Legacy saves begin observation at their saved simulation clock, without inventing historical rates from lifetime totals. Dashboard expansion and chart choices are view-only and are not persisted.

## Electricity and feedback

Machines start unpowered. Generators and consumers must be within pole coverage. Distances are Euclidean between tile centers and include the boundary. Only pole links join networks; overlapping coverage assigns a building to the lowest-index covering pole's network (row then column), never to multiple networks. Network IDs can change when poles split/merge.

Only working demand is allocated, including ready or moving inserters: miners with empty buffers and machines ready to start or actively processing. Missing ingredients, insufficient new-job output space and initial Auto detection waiting request zero. Each network gives all requesting consumers `min(1, capacity / demand)` of their demand; processing/mining speed scales proportionally, without priority or boosts. For example, 100 kW over 110 kW demand gives 90.9% speed. Surplus elsewhere cannot power a disconnected/overloaded network.

Zero power prevents starting jobs and preserves committed inputs, fractional progress and reserved products. Restoration resumes without catching up outage time. Assembler Auto waiting is a simulation clock, so it can expire during an outage. Furnace glow and assembler mechanisms follow processing progress and pause without power.

Pole placement/inspection shows a coverage circle and highlights covered machines; amber coverage highlights indicate assignment to another network. Placement also previews dashed links to every connectable pole: green valid/connected, orange valid/isolated, gray invalid. Isolated placement is allowed and hover never changes networks. P adds full-network coverage and machine outlines. Power badges show green full, amber reduced, red disconnected/no generation, blue idle. Inspections explain network assignment, requested/supplied power and shortages. Global statistics distinguish installed/connected capacity, surplus/deficit, chest inventory and lifetime production; nominal rates are not actual throughput.

## Pete

Exactly one immortal green goblin spawns near the starter factory at (17, 23). Pete walks at **1.3 tiles/second**, 30% faster than his former walking speed. Seeded choices and all timers use the deterministic simulation. Buildings are obstacles, deposits are walkable, and map edges are impassable. Construction reserves his current/next tile. An enclosed Pete waits safely until a route opens.

A wandering Pete can throw a pumpkin within the existing **Euclidean radius 2**, starting with a **2,000 ms cooldown** and resetting that cooldown on each launch. He prefers operational, non-sabotaged machinery; equal candidates use building tile order. Idle miners/furnaces/assemblers/inserters are fallback targets, but generators must actually be supplying a network. Eligible machinery is miners, furnaces, assemblers, inserters and active generators. Belts, splitters, chests, poles, radars, sprinklers and prisons are excluded by shared capabilities.

A pumpkin flies for **400 ms**, then disables the same building for **10,000 ms**. Removing/replacing the target cancels that projectile. An already-disabled building is not targeted and a committed impact never extends an existing disable. Multiple buildings can remain sabotaged at once. Removing a sabotaged building removes its effect; replacements inherit no sabotage.

Sabotaged consumers request no power: mining, crafting jobs and inserter movement/pickup/delivery freeze with inventories, reservations, progress and held items preserved. A sabotaged generator contributes no capacity until expiry; other generators share the remaining load normally. The inspector distinguishes installed generators from active ones and reports actual generation correctly. Belt transport, buffered machine exports and unaffected inserters continue; stock is never purged. Recovery resumes subject to normal power and backpressure. Orange mush/green slime visibly cover and dim each affected building until expiry, and its inspector says **Sabotaged by Pete** with remaining time.

Pete cannot begin sabotage during trapping, web fleeing/crying, water reactions or police custody. Sabotage cooldown continues through all these states. He has no combat, health or destructive actions. Internal `pumpkin` save fields and stable IDs remain unchanged despite the player-facing name becoming Pete.

## Spider Web tool

Select **Spider Web (B)** from Pete before firing. Clicking Pete in ordinary selection, placement or deletion mode does not throw a web. Tool toggling, Escape, mutual exclusion and category switching follow [the shared controls](#world-items-and-controls). Every selected-web click is consumed, so it cannot also place, remove or inspect a building.

A direct hit on Pete takes priority over the ground tile. His hitbox allows a forgiving **0.8-tile radius**, including his visible head/body. Wandering or trapped Pete immediately enters `FLEEING`; no second projectile collision is required. A trapped Pete is released immediately, while his original ground web remains. Fleeing runs at **5.85 tiles/second** (the unchanged 4.5× walking multiplier) toward a reachable map corner. Breadth-first routes avoid buildings and replan after topology changes. If corners are unreachable, the destination is a reachable tile nearest a corner, ties by tile index; an enclosure is a safe fallback. At the destination Pete cries for **10 seconds**, then wanders again. Repeated direct hits during fleeing/crying replay webs without changing routes, timers or cooldown. A prior pumpkin remains committed during a direct scare.

A click without a Pete hit fires a visible projectile at any valid map tile, including an occupied tile. It lands after **300 ms** and remains active for **10 seconds from landing**, with a short cosmetic fade afterward. Ground webs never modify terrain, reserve tiles, block construction/transport, consume electricity or affect other entities. At most **128 live/flying ground webs** are retained; additional ground shots are rejected with feedback rather than evicting an existing trap. Direct hits still work at that limit.

A wandering Pete stepping onto a landed web becomes surprised and `TRAPPED` at his current interpolated position. Movement and new sabotage stop; an unlanded pumpkin is cancelled, while existing machine disables keep their original expiry. Pete stays trapped only until that web's original expiration. Overlapping webs never replace the associated web or extend the trap. Release ignores overlapping live patches under Pete until they expire, preventing immediate retrapping by the same/overlapping web. Cooldown still counts down while trapped.

Existing fleeing, crying, water reactions and custody take priority over ground trapping. Police can pursue/arrest trapped Pete; arrest clears the trap association and continues the existing case. Direct web hits during water reactions or custody are consumed without an interrupt or ground patch. With no web tool selected, clicking a prison still opens its inspector. Sprinklers cannot start a reaction against trapped Pete. All transitions use the existing fixed-step loop.

Saves preserve flying/landed webs, original lifetimes, unique identities, trap association, overlap immunity and NPC progress. Version-1/2 upgrades initialize empty web state and rescale movement interpolation without moving Pete or resetting stored timers; a legacy remaining cooldown can exceed the new two-second default until it counts down naturally. No cosmetic fade history is saved.

## Compact splitter

Tool **0** places a single-tile splitter; R rotates its orientation before placement, and Escape or the active shortcut/button cancels normally. For orientation east, the input is west, the front output east and the left output north. All four rotations use the same relative ports. Placement preview marks the rear input amber, front green and left blue. Redirecting an existing splitter uses the existing remove-and-replace flow. Edge placement is allowed; off-world ports are blocked. No electricity is required, and Pete does not sabotage splitters.

Only travel in the splitter's facing direction is accepted, so belts/inserters can supply its **rear only**. Internal capacity is exactly **three items**: one intake slot and one outgoing slot per output. Intake travels from the rear edge to center over **250 ms**, then routes to an empty outgoing slot whose neighboring receiver can currently accept its item. That outgoing item travels from center to its output edge over **250 ms** before delivery. Left output follows a curved visual path. The total unobstructed internal traversal is **500 ms**; belt travel stays unchanged at 500 ms.

The next preference starts at front. Successful routing flips preference to the opposite of the selected output; if front is blocked, left is tried, and vice versa. Blocked attempts never flip it. Preference is for the next intake, independently of items already traveling in outgoing slots. Each output's in-flight item retains its chosen route; if that receiver fills meanwhile, the item waits at that edge while the other outgoing slot can continue. Items can overtake on different outputs during congestion. Both blocked routes retain all stock, eventually filling intake and stopping upstream arrivals. There are no filters or configurable priorities.

Splitters use the [shared transport invariants](ARCHITECTURE.md#compact-splitter-extension): an item cannot enter, route and depart in one step, and vacated slots wait until a later step before reuse. Chains and loops remain bounded and deterministic.

Outputs support neighboring belts, rear-compatible splitters and the shared inventory/recipe receivers. Belt connections/curves use only actual front/left output sides, regardless of occupancy. Existing direct belt-to-machine rules and machine automatic output-to-belt behavior are unchanged. An outward-facing inserter can extract only the corresponding **mature outgoing slot**, never queued intake or a newly routed item. Rear inserters use normal powered delivery; splitters themselves remain unpowered. Their start-of-step budgets and recipe checks remain intact.

The inspector shows facing/rear/output directions, input and outgoing items/progress, next preference, current blocked outputs, delivered counts and average delivered items/second since placement. Counters advance only on successful external delivery or inserter extraction, not internal routing. Removing the one-tile entity discards its buffered items under existing rules and preserves lifetime mining/crafting statistics.

## Police, radar traps and prison

Place a 1×1 **radar trap** with tool **9** on an empty tile. Placement/inspection previews its inclusive Euclidean **3-tile** detection radius. It continuously requests **5 kW** through existing poles and proportional power allocation. Detection requires the full 5 kW: disconnected, generation-free or partially supplied radars remain inactive. Pete cannot sabotage radar traps.

When a powered radar sees a free Pete (wandering, trapped, fleeing or crying), it flashes and dispatches one police car at a reachable empty map edge. Equal triggers use radar tile order. Exactly one operation runs at a time, even with overlapping traps. The first valid dispatch automatically creates a small prison on a reachable free edge tile; it is not a player placement tool. A separate empty edge entry and a clear prison exit must remain reachable. If no route exists, dispatch waits and retries once per simulation second. The radar inspector explains its power state, police phase, and prison coordinates.

The car drives at **6 tiles/second** through empty cardinal tiles, rerouting for Pete's position and building changes. When within arrest distance, it escorts Pete into the car over **750 ms** (`ARRESTED`), then visibly carries him back (`TRANSPORTED`). Police dispatch/transport needs no extra electricity. A dispatched case continues if its radar is removed or loses power. Arrest cancels an unlanded pumpkin; existing sabotage on machines still expires normally. Pete cannot move independently, sabotage or flee from clicks while in custody. Clicks during arrest/transport are consumed so tools cannot act through him.

In `IMPRISONED`, Pete stays inside the prison, grimaces angrily and rattles the bars. Normal selection clicks on the prison open its inspector instead of throwing webs. The inspector shows elapsed time, time to escape and **Release Pete**. Manual release immediately returns him to `WANDERING` on the reserved empty exit tile. If unreleased, he escapes at **exactly 60 seconds of imprisonment**, with briefly shaking bars and a dust cloud. Crying is not used for imprisonment. Timers use 50 ms simulation steps; wall-clock delays and power outages cannot extend/reset them.

All custody time counts down Pete's existing sabotage cooldown normally; arrest, release and escape never reset it. Release/escape grants **10 simulation seconds of grace against every radar**, including the original trap. After grace, remaining in a powered detection radius can trigger another case. Repeated/stale release commands cannot affect a new imprisonment.

Construction reserves the car's current/next tile and every prison exit. X can remove an empty or occupied prison. Removal during arrest/transport safely frees Pete at the car's free tile; removal while imprisoned frees him at the exit. Removing a prison during police arrival cancels that dispatch. If new walls disconnect a return route, the car safely releases its passenger where it is, with grace; it never drives through buildings or teleports a captive through them. A later valid dispatch can reuse an existing prison or create a replacement. No police combat, road network, prison power demand or prison management system is added.

## Production chains and limitations

Build miner → belt → furnace → belt → storage for either metal. For circuits, route iron plates to one assembler input and copper plates through a cable assembler to another input; send finished circuits by belt to storage. Separate ingredient belts avoid a blocked incompatible/excess item hiding needed ingredients behind it. One miner nominally supplies two full-power furnaces; actual throughput depends on power, delays and congestion.

Reloading creates a new session until a save is explicitly loaded. There is no automatic chest output, research, blueprint or Factory Architect yet. Chests require an inserter for extraction. Mixed-input head-of-line blocking and incomplete ingredient sets still require suitable deliveries/routing; Auto cannot invent missing materials. Rotation after placement requires destructive remove-and-replace. No fuel, depletion, electricity storage or player economy is implemented. Future proposals are listed separately in [Roadmap](ROADMAP.md).

## Offline save and load

**Save Game** replaces the manual browser slot. **Load Game** restores it after confirmation. **Load Autosave** restores the independent automatic slot. Autosave runs every 120,000 ms of visible, active simulation time, with no wall-clock/offline catch-up. A successful load starts a fresh autosave interval; it does not immediately overwrite either slot. Timestamps show the last successful save in each slot.

**Export JSON** downloads the current factory with a timestamped filename. **Import JSON** reads a local file, fully validates it, then asks before replacing the factory. Import/export leave browser slots unchanged. Saves include terrain, every building and item, crafting reservations/progress, splitter preferences, inserter-held items, electricity topology, Pete/police/prison state, simulation clock/remainder, camera, output direction and electricity overlay. Loads cancel tools and inspection and return the menu to Factory. Simulation advances only from the saved clock; no production is awarded for time away.

Malformed/incompatible saves, unsupported versions, invalid references, oversized files (over 2 MiB), unavailable storage and quota failures show errors without replacing the running factory. A failed write preserves the previous browser save. Clearing site data removes browser saves: export JSON for a portable backup. Startup checks slot metadata but never automatically loads a factory. New saves use version 5; valid version-1/2/3/4 saves load through explicit validated upgrades. All pre-Sprint-11 saves receive every Sprint 11 technology and 0 RP, preserving existing factories and dashboard access. Normal version-5 loading restores the exact research balance and unlocks. Unsupported versions remain rejected. The schema and migration contract are in [Architecture](ARCHITECTURE.md#versioned-offline-persistence).

## Build categories

**Factory** is the default tab for production, transport, storage, power and removal. **Pete** contains the player-placeable radar trap and Anti-Goblin Sprinkler, plus the Spider Web tool. Police cars and prisons remain automatic entities. Switching tabs cancels the active placement/removal tool. Existing hotkeys automatically select the tool's tab, and Escape cancels the tool without switching categories. Only the active tool has a light-green selected border; keyboard/mouse tool interaction remains available without a focus outline.

## Anti-Goblin Sprinkler

Tool **G** selects the 1×1 sprinkler in Pete, following the shared [controls](#world-items-and-controls) and [category rules](#build-categories). Preview and inspection show its **3-tile inclusive Euclidean radius**, using the same distance query as radars. The nozzle aims at Pete during spraying. Its inspector shows electrical allocation/network, Ready/Spraying/Cooling down/Unpowered, cooldown remaining and completed successful sprays. No fuel, water, pipes, item ports or recipes are needed.

Sprinklers continuously request **5 kW**, including cooldown, sharing proportional allocation with production. Detection and actual spray progress require the full 5 kW, like radars. A shortage stops the jet and pauses the active spray without losing progress; restoring full supply resumes it. Cooldown runs on simulation time even without power. Sprinklers cannot be sabotaged.

Only ordinary wandering Pete, including an interruptible in-flight sabotage projectile, is eligible. Multiple eligible sprinklers select the lowest building tile index; unsuccessful contenders remain ready. A successful activation freezes Pete in place, cancels an in-flight pumpkin and suppresses webs/new sabotage without resetting his global sabotage cooldown. Previously landed sabotage remains until its original expiry. The current tick's projectile impacts happen before detection and are not undone. The following sequence starts at the activation boundary:

| Phase | Duration | Behavior |
| --- | --- | --- |
| `SPRAYED` | 1,000 ms at full power | Attached blue water jet, droplets and wet Pete; stationary |
| `SLIPPING` | 1,000 ms | Backside fall and splash; source starts 10,000 ms cooldown and increments completed-spray count |
| `COMPLAINING` | 2,000 ms | Stationary angry Pete; deterministic complaint bubble |
| `WATER_FLEEING` | 8,000 ms | Obstacle-aware running at the shared 5.85 tiles/sec fleeing speed; then ordinary wandering |

Complaints rotate deterministically from the activation tick and source tile; no extra randomness/service is required. Water fleeing selects the reachable tile farthest from the source snapshot, then lowest tile index. It replans after topology changes and waits safely if enclosed or at its destination. Water fleeing ends after exactly eight seconds even if no route exists. It never enters spider-web crying, and clicks during any water phase are consumed without restarting timers or changing tools. Cosmetic puddles fade after five seconds, have no gameplay effect and are bounded to 14 marks.

Police dispatch has priority at a shared tick. An existing police car (including approach), custody, prison, web fleeing, crying, an ongoing water reaction or the 10-second post-release/escape grace prevents new sprinkler activation. New police dispatch is suppressed during the committed water sequence. Existing police cases are never cancelled. Once Pete is wandering and grace has expired, normal detection resumes. A completed water reaction cannot retrigger until a later fixed-step boundary, even when Pete is enclosed beside a ready sprinkler. Global sabotage cooldown continues ticking in all phases; imprisonment/release/escape timings are unchanged.

Deleting the source during spraying stops its jet immediately and moves Pete into the already committed one-second slipping phase. Replacement sprinklers do not inherit the old source or cooldown. Later phases retain the source location for escape navigation. Save & Load resumes the phase, remaining time, complaint, route and cooldown without replaying activation; see [offline saves](#offline-save-and-load) for compatibility and failure behavior. Authoritative fields and reference validation belong to [Architecture](ARCHITECTURE.md#sprinkler-and-water-reaction-ownership).
