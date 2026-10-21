# Implemented game design

The game is an offline browser factory sandbox with local saves. The following rules are implemented; [Roadmap](ROADMAP.md) contains proposals, not available mechanics. This document owns player-visible rules and values; implementation and resource-accounting contracts are in [Architecture](ARCHITECTURE.md).

## World, items and controls

The world is 40×40 tiles with one physical occupant (building or tree) per tile, unlimited deposits and free placement of researched factory buildings (Pete’s Treehouse costs 20 Wood). Random clusters have injectable generation; distinct starter patches are guaranteed around iron `(20, 20)` and copper `(26, 20)`. Miners require ore; other buildings can occupy any empty in-bounds tile.

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

Use WASD to move and the mouse wheel to zoom. Keys 1–9, 0 and G toggle the buildings below; B toggles Spider Web in the Special group; selecting another tool replaces the previous one. Pressing the active hotkey or clicking the active toolbar button cancels it. Deletion is mutually exclusive with placement; R rotates directional placement clockwise, X removes, P toggles the electricity overlay, and Escape cancels tools so clicking a building opens inspection. Escape closes an open inspection or Analytics view before putting away a selected tool; with no active interaction it does nothing. Tool buttons show a green selected border and a separate visible keyboard-focus outline. Buttons remain keyboard operable. Escape cancels even while a form control has focus; other tool hotkeys ignore text and recipe editing. The electricity-overlay toggle remains blue. Redirect an existing building by removing/replacing it. Removal discards contained items and active jobs but preserves lifetime mining/production. Normal placement previews are green/red for valid/invalid; pole colors are described below.

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
| `revengeDefense1` | Revenge Defense I | 60 RP | Basic Industry | Drill combat tool |
| `revengeDefense2` | Revenge Defense II | 120 RP | Revenge Defense I | Lightning Beam combat tool |

Purchases are manual, permanent and atomic: validate the prerequisite and full balance, deduct once, then unlock. Repeated purchases do not charge again. Placement is checked by the simulation; toolbar disabling cannot bypass research. Locked tools remain visible with the required technology, and locked hotkeys leave the current tool unchanged with explanatory feedback. After unlocking, all existing tool toggles, rotation and category behavior remain. Existing buildings keep running and remain inspectable/configurable. Pete tools, their hotkeys and automatic police/prison behavior remain available as before; Sprint 11 adds no technology for them.

The icon-led **Research** button shows available RP (two decimal places, truncated so an unaffordable technology never appears funded) and the current effective RP/min, excluding idle or blocked machines. It opens a separate, closable Technology dialog with prerequisite relationships, costs, unlock descriptions, icon-led researched/locked/collect-points/ready-to-unlock cards and selected-technology details. Cards are grouped into the starting technology, factory progression and Pete’s Revenge. Progress bars show the shared available balance toward each cost; they do not reserve points or introduce timed research. A pending manual purchase briefly reads “Unlocking…”. A numbered badge reports currently affordable unlocks; completed purchases retain their brief confirmation. Purchases show a brief confirmation. Close or Escape restores focus to Research. Game tool/camera shortcuts are suspended inside the dialog; research and simulation continue. Opening Research collapses Analytics, keeping the two interfaces separate. The Analytics header button remains visible but disabled with a “Requires Analytics I” tooltip until unlocked; its underlying simulation and history collection always continue.

Research balance and technology IDs are persisted with nanosecond-resolution integer accounting; saving/loading preserves fractional RP exactly. Legacy version-1–4 saves initialize RP to 0 and unlock **all five** Sprint 11 technologies; retained buildings, production, inventories, analytics (where present), NPCs and saves keep their existing behavior. Malformed research state is rejected rather than silently reset.

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

Pole placement/inspection shows a coverage circle and highlights covered machines; amber coverage highlights indicate assignment to another network. Placement also previews dashed links to every connectable pole. The new placement outline uses green/check for valid and red/cross for invalid; the existing link marker can still indicate an isolated network separately. Isolated placement is allowed and hover never changes networks. P adds full-network coverage and machine outlines. Power badges show green full, amber reduced, red disconnected/no generation, blue idle. Inspections explain network assignment, requested/supplied power and shortages. Global statistics distinguish installed/connected capacity, surplus/deficit, chest inventory and lifetime production; nominal rates are not actual throughput.

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

The car drives at **6 tiles/second** through empty cardinal tiles, rerouting for Pete's position and building changes. When within arrest distance, it immediately places Pete in custody for a **3.4-second arrest scene** (`ARRESTED`), then visibly carries him back (`TRANSPORTED`). Police dispatch/transport needs no extra electricity. A dispatched case continues if its radar is removed or loses power. Arrest cancels an unlanded pumpkin; existing sabotage on machines still expires normally. Pete cannot move independently, sabotage or flee from clicks while in custody. Clicks during arrest/transport are consumed so tools cannot act through him.

Arrest presentation escalates within the current Revenge cycle: the first arrest has no restraints; the second shows oversized steel handcuffs and **CLICK!**; the third and every later arrest adds tan rope loops, **CLICK! ZURR!** and a gentle one-pixel car wobble. The stage comes from the existing completed-arrest counter (plus the current pickup before it completes), so boss defeat resets it even when the next threshold is 5, 7, 9 or higher.

New arrests settle for **0.5 seconds**, give Pete **0.7 seconds** to shrug in surprise, then spend **1.6 seconds** on the escort/restraints (rope follows cuffs after 0.8 seconds). The final **0.6 seconds** eases Pete into the car before ordinary transport starts. Cuffs and rope fade in and out rather than flash. The green passenger face appears as boarding finishes and remains visible in transport. Custody and the single-car guard apply from the first boundary; the completed-arrest counter advances exactly once at 3.4 seconds. Factory production, input and sabotage cooldowns continue throughout. Pause freezes the sequence. Historical saves with an already-running 750 ms pickup finish that original pickup without extending or replaying it; subsequent arrests use the new scene.

In `IMPRISONED`, Pete stays inside the prison, grimaces angrily and rattles the bars. Normal selection clicks on the prison open its inspector instead of throwing webs. The inspector shows elapsed time, time to escape and **Release Pete**. Manual release immediately returns him to `WANDERING` on the reserved empty exit tile. If unreleased, he escapes at **exactly 60 seconds of imprisonment**, with briefly shaking bars and a dust cloud. Crying is not used for imprisonment. Timers use 50 ms simulation steps; wall-clock delays and power outages cannot extend/reset them.

All custody time counts down Pete's existing sabotage cooldown normally; arrest, release and escape never reset it. Release/escape makes Pete immediately eligible for another arrest, including inside the original powered radar radius. Radar checks current position each simulation step; no exit/re-entry is needed. The separate 10-second sprinkler grace does not block police dispatch. Repeated/stale release commands cannot affect a new imprisonment.

Construction reserves the car's current/next tile and every prison exit. X can remove an empty or occupied prison. Removal during arrest/transport safely frees Pete at the car's free tile; removal while imprisoned frees him at the exit. Removing a prison during police arrival cancels that dispatch. If new walls disconnect a return route, the car safely releases its passenger where it is, eligible for arrest immediately; it never drives through buildings or teleports a captive through them. A later valid dispatch can reuse an existing prison or create a replacement. Outside Revenge encounters police retain this arrest-only behavior; there is no road network, prison power demand or prison management system.

## Pete’s Revenge

Completed police arrests count when the arrest scene finishes and Pete enters the car, once per arrest. **3 arrests** trigger the first Revenge-O-Matic 3000 event. The HUD warns for **5 simulation seconds** before spawning; no second event or additional progress can accumulate during warning, combat, breakdown or recovery. Defeat resets progress to zero and raises the next threshold by two (**3, 5, 7, 9, …**). Outside the encounter, the factory shows `Pete’s Revenge: current / threshold arrests`.

The oversized mechanical walker has **100 HP**, with Pete visible in its cockpit. Its logical movement occupies one tile plus its reserved next tile; its larger body/hitbox is visual and never overwrites buildings or items. It spawns at the first free map-edge tile in tile order, excluding police reservations, prison exits and Pete’s current/next tile. If none is free, the warning remains pending until an edge opens. At **one tile per 1.5 seconds**, it hunts currently productive powered machines: **assembler → furnace → miner**, then avoids the previous target where equal priority permits, chooses the nearest squared distance and breaks ties by tile index. Cardinal paths use existing empty-tile navigation to approach within range. It waits safely when targets or routes are unavailable, and replans after obstruction/removal. EMP fire stops movement at a tile boundary.

| State | Behavior |
| --- | --- |
| Phase 1: Revenge (100–51 HP) | EMP every 8 s when a productive target is within 6 tiles; blast centered on target, inclusive radius 3, 6 s sabotage |
| STOMP transition (first surviving hit crossing to ≤50 HP) | Hold position and raise a foot for 1.5 s, then one radial radius-5 stomp with 8 s sabotage, dust/shockwave and camera shake |
| Phase 2: Furious Pete (50–1 HP) | Same hunting behavior, EMP interval 6 s; stomp never repeats |
| Defeat (0 HP) | Cancel movement/attacks/damage, 2 s sparking breakdown and visible cockpit ejection, then remove walker and stun Pete on a free nearby tile for exactly 5 s |

EMP and stomp use the existing sabotage eligibility (miners, furnaces, assemblers, inserters and generators) and absolute `sabotageUntilMs`, extending rather than shortening an existing disable. Belts, chests, power poles, splitters, radar, sprinklers and prisons are unaffected. Buildings and every item/job remain intact. A direct lethal hit from above 50 HP skips stomp; defeating a telegraphing walker cancels its pending stomp. Stomp resets the next EMP to six seconds after impact. If no ejection tile is free, breakdown waits safely instead of overwriting anything.

Select these mouse-only tools in **Pete**; all old keyboard bindings and tool toggles remain unchanged:

| Tool | Damage | Shared cooldown after hit **or miss** | Research |
| --- | --- | --- | --- |
| Fly Swatter | 5 HP | 1 s | Available by default |
| Drill | 15 HP | 1.5 s | Revenge Defense I (see technology table) |
| Lightning Beam | 30 HP | 2 s | Revenge Defense II (see technology table) |

Click the walker’s rectangular hitbox (±1.25 tiles horizontally, ±1.1 vertically from its center). Canvas clicks elsewhere, including empty ground, miss, do zero damage and still consume cooldown. During cooldown all clicks are ignored without new impact effects. Switching tools, categories, research panels or loading cannot bypass the persisted shared timer. The toolbar shows selection, research explanations and shared cooldown text/progress. Combat clicks consume their mouse action; they never place, inspect or delete a building. Camera unprojection accounts for zoom and viewport position. Swatter hits show SMACK, stars, wobble and `-5`; misses show PLOP and dust. Drilling produces restrained warm sparks or ground debris; lightning produces a softer blue beam/arcs or a ground ring, with `-30` on hits. Hit reactions stay local without camera shake. These bounded effects do not cause damage themselves.

Normal powered radars dispatch the existing police car toward a visible active walker. Within 2 tiles, the car deals **2 HP per 2 s**, using one shared police timer. Powered ready sprinklers within their existing 3-tile range deal **2 HP**, then take their normal 10 s cooldown; all sprinklers additionally share a **2 s** boss-attack timer. Overlap cannot multiply instantaneous support damage. A dispatched car still works without continuing radar power. Unpowered sprinklers do not attack. Every damage source uses the same phase/defeat path.

While piloting, Pete’s ordinary movement, webs, sabotage, custody and water reactions pause; spawn cancels his current custody/reaction and leaves the prison/buildings intact. His normal rendering is replaced by the cockpit. Breakdown/ejection happens once, then stars show the five-second stun. Police and sprinklers leave him alone during recovery; afterward normal wandering, sabotage and arrest rules resume. The event is entirely driven by the existing 50 ms simulation clock, with no wall-clock catch-up.

Version-6/7 cars may store `arrestStartedAtMs` and `arrestDurationMs` to resume an ongoing arrest scene. Missing duration keeps an existing 750 ms pickup on its original deadline; new pickups use the longer scene. Older files without a timestamp use their pickup elapsed time. Loading in-transit cars never restarts restraint effects.

Version-6 saves retain progress/threshold, warning, walker movement/target/HP/phase/EMP/stomp, breakdown/stun, blast presentation and shared attack/support timers. Loading resumes instead of replaying damage, stomp, defeat, escalation or ejection. Transient player impact particles/text reset on load. Versions 1–5 initialize Revenge to 0 / 3 with no active event; version-5 RP and researched IDs remain exact, and Revenge Defense I/II start locked. Earlier versions retain their established Sprint 11 migration and unlock only those five technologies.

## Production chains and limitations

Build miner → belt → furnace → belt → storage for either metal. For circuits, route iron plates to one assembler input and copper plates through a cable assembler to another input; send finished circuits by belt to storage. Separate ingredient belts avoid a blocked incompatible/excess item hiding needed ingredients behind it. One miner nominally supplies two full-power furnaces; actual throughput depends on power, delays and congestion.

Reloading creates a new session until a save is explicitly loaded. There is no automatic chest output, blueprint or Factory Architect yet. Chests require an inserter for extraction. Mixed-input head-of-line blocking and incomplete ingredient sets still require suitable deliveries/routing; Auto cannot invent missing materials. Rotation after placement requires destructive remove-and-replace. No fuel, depletion, electricity storage or player economy is implemented. Future proposals are listed separately in [Roadmap](ROADMAP.md).

## Offline save and load

**Save Game** replaces the manual browser slot. **Load Game** restores it after confirmation. **Load Autosave** restores the independent automatic slot. Autosave runs every 120,000 ms of visible, active simulation time, with no wall-clock/offline catch-up. A successful load starts a fresh autosave interval; it does not immediately overwrite either slot. Timestamps show the last successful save in each slot.

**Export file** downloads the current factory with a timestamped filename. **Import file** reads a local file, fully validates it, then asks before replacing the factory. Import/export leave browser slots unchanged. Saves include terrain, every building and item, crafting reservations/progress, splitter preferences, inserter-held items, electricity topology, Pete/police/prison state, simulation clock/remainder, camera, output direction and electricity overlay. Loads cancel tools and inspection and return the menu to Factory. Simulation advances only from the saved clock; no production is awarded for time away.

Malformed/incompatible saves, unsupported versions, invalid references, oversized files (over 2 MiB), unavailable storage and quota failures show errors without replacing the running factory. A failed write preserves the previous browser save. Clearing site data removes browser saves: export JSON for a portable backup. Startup checks slot metadata but never automatically loads a factory. New saves use version 8; valid version-1/2/3/4/5/6/7 saves load through explicit validated upgrades. All pre-Sprint-11 saves receive every Sprint 11 technology and 0 RP, preserving existing factories and dashboard access. Version-5 and newer loading restores the exact research balance and unlocks; new Revenge technologies remain locked in older files. Unsupported versions remain rejected. The schema and migration contract are in [Architecture](ARCHITECTURE.md#versioned-offline-persistence).

## Build categories

The compact toolbar sits **below the world** and shows one group at a time: **Factory** (miner, furnace, assembler), **Logistics** (belt, chest, inserter, splitter), **Power** (generator, pole), **Nature** (treehouse, planting, Axe and landscape brushes), and **Special** (radar, Spider Web, sprinkler, combat and removal). Factory is the default. Police cars and prisons remain automatic. Every existing tool ID and hotkey is retained; a hotkey selects its group. Clicking the active tool again toggles it off. Switching groups cancels the active tool; Escape cancels without switching groups. Right-click in the world cancels a pending construction drag first, or puts away the selected tool; it never demolishes. Arrow/Home/End keys navigate the group tabs. Icons have short labels, name/hint/hotkey tooltips, selected state and a lock/unavailable mark with a reason. Rotation appears only for directional tools; brush sizes appear only for landscape brushes. Belts and power poles support the atomic drag previews described in [Building gestures](#building-gestures-and-previews).

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


## Nature and forestry

The **Nature** toolbar tab offers **Plant Oak**, **Plant Pine**, **Plant Birch**, **Axe**, **Flowers**, **Grass** and **Erase decoration**, plus **1×1 / 3×3 / 5×5** brush sizes. Plant one free sapling per click. Paint or erase decoration by clicking and dragging; fast strokes fill the intervening grid cells. Tool selection toggles as usual, changing tabs cancels it, and Escape returns to inspection. Existing hotkeys are unchanged; Nature tools use toolbar buttons. WASD and wheel zoom remain available. A changed tool/brush size, leaving the canvas or releasing the pointer ends the current stroke.

The existing ore/terrain array is unchanged. Trees share physical tile occupancy with buildings and belts and require the **Axe**, never ordinary X demolition, to clear. Flowers and grass are a separate non-blocking layer: they may be painted on ore, under trees or under any building. Occupancy hides decoration without deleting it; chopping/demolition reveals it again. Neither painting nor chopping changes the original ore or mining quantities. Trees respect current/next NPC tiles and prison exits and otherwise block navigation exactly like other physical occupancy. Trees draw no electricity, produce no RP/items/analytics and cannot be sabotaged.

| Tree stage | Simulation age | Axe yield |
| --- | --- | --- |
| Sapling | 0 to less than 2 minutes | 0 Wood |
| Young | 2 to less than 5 minutes | 1 Wood |
| Mature | 5 minutes onward | 3 Wood |

Oak has a rounded crown, Pine a layered evergreen silhouette, and Birch a pale marked trunk and light foliage. Trees mature without water, fertilizer, power or upkeep, including beside a factory. The inspector shows species, age, stage and Axe yield. The global **Wood** stock appears with resource statistics and in Nature; it is separate from chests/items and has no conveyor, recipe or automated harvesting in this sprint. Chopping removes occupancy and credits Wood once, immediately making the tile available. A small disappearing crown, three restrained chips and a non-blocking stump last up to **2 simulation seconds**; new occupancy hides the stump. Reloading discards these cosmetic effects and never re-awards Wood.

Mature trees, including manually planted ones, first attempt reproduction **5 minutes after reaching maturity**, then every **5 simulation minutes**. Each attempt has **20%** probability of one sapling. On success, the target is chosen uniformly among currently eligible cells at **Chebyshev distance 1–2** (maximum absolute x/y displacement). Targets must be empty, unreserved, in bounds and more than **3 Chebyshev tiles from every occupied factory cell**, including belts, poles, generators, radars and prisons. Checking occupied cells also covers every cell of a future larger footprint; all current buildings are 1×1. Trees may spread onto ore without consuming it. A blocked/capped/failed attempt still consumes that attempt and keeps its original cadence. New trees inherit species and count as natural. Natural trees, including initial forests, are capped at **20% of the 1,600 buildable cells (320 trees)**. Manual trees do not count against that cap and can be planted close to factories. Existing trees remain when a factory is built nearby.

New games generate several irregular mixed-species groves, flower meadows and grassy patches, retaining a **21×21 tree-free starting area (x/y 10–30 inclusive)** around both guaranteed starter ore patches and Pete. Initial trees include saplings, young and mature trees. Ore generation is completed first and remains unchanged. Identical injected world RNGs/configurations produce identical landscapes. Nature has its own persisted RNG and never consumes Pete's RNG. Growth and reproduction advance only with the fixed-step simulation; pause and time spent away from a save grant no catch-up.

Version-7 saves require exact nature data, including tree birth/origin/species/next reproduction deadline, decoration and global Wood. Versions **1–6** load with **no trees, no decoration and 0 Wood**; they never generate new forests over an existing factory. All existing inventories/jobs, NPCs, research, analytics and Revenge state follow their existing migrations. New-format loading restores nature exactly and validates its clocks, species, cap, counters and occupancy. Implementation and scheduling belong to [Nature ownership](ARCHITECTURE.md#nature-layers-and-scheduled-forestry). Water, paths, treehouses, animals and automated forestry remain out of scope.

## Visual & Animation Design Guidelines

Use warm, cohesive colors, friendly comic reactions and small, readable movements. Keep essential state indicators, captions and hit/miss feedback visible at normal zoom and legible when zoomed out. Prefer eased motion and low-opacity rings, dust and sparks over white flashes, rapid beacon switching or camera shake. Large cuffs and rope communicate the joke without tiny sprite detail. Do not obscure working factories with dense particles.

Stateful canvas effects use simulation time and freeze with pause. Derive motion from existing authoritative clocks; persist a sequence discriminator only when needed to restore an ongoing scene accurately. Renderers never change targets, damage, power, production or RNG. Keep effects bounded and reuse graphics/text. Short UI color/opening transitions may use CSS and respect reduced-motion preferences; they never time gameplay. See [rendering ownership](ARCHITECTURE.md#escalating-arrest-presentation).

Sprint 12.2 audit, in priority order:

| Area | Finding and decision |
| --- | --- |
| Arrest / police pickup | Highest impact: 750 ms pickup/900 ms restraint overlay was too fleeting. Replaced new pickups with the phased 3.4-second scene, readable fading cuffs/rope, surprised shrug and visible passenger. |
| Police / prison / release | Rapid red/blue switching, white dispatch burst and bar shaking competed with the scene. Use softly breathing beacons, a dim warm dispatch cue and slower, smaller rattles. Preserve smooth cardinal car routes, reserved exits and release dust; release remains immediately eligible for radar. |
| Walker movement / damage | Fast wobble and coils felt jittery. Slow local reactions, use a smooth heavy stride and a two-pixel body settle. No camera shake. |
| EMP / stomp | Add a 1.6-second EMP target/coil charging cue when the existing target is in attack range. Ease the raised foot across the existing stomp telegraph; use thinner, dimmer impact rings. Attack times/radii/damage are unchanged. |
| Breakdown / ejection | Retain humorous two-second ejection and recovery stars; slow smoke drift, warm sparks and reduce body wobble. No extra particles or combat delay. |
| Combat tools / floating text | Retain distinct SMACK/stars, drill/sparks and electrical beam, including ground misses. Add a swatter mesh/handle and modest drill motion; soften lightning and keep eased damage captions visible for 1.2 seconds with a final fade. |
| Pete walking / sabotage / water / webs | Existing short walking bob, pumpkin arc, slime drips, web struggle and water slapstick already tell the story clearly. Keep their timing and behavior. Arrest adds a surprised face and shrug. |
| Factory machines / transport / power | Belts, inserters, assembler mechanisms, mining progress and power/status indicators track real productive state and remain unchanged. Reduce furnace glow amplitude/frequency and flame movement only. |
| UI / research / notifications / boss HUD | Existing readable status text and research confirmation remain. Add quiet 180 ms control color transitions and a small opening transition to Technology and boss HUD, with reduced-motion support. Do not fade critical warnings or health updates. |

## Pete’s Treehouse and peace

**Nature → Pete’s Treehouse** costs exactly **20 global Wood** and occupies one tile. Only one home may exist. No existing tree, industrial material, research or electricity is required. Normal bounds, occupancy, actor and prison-exit reservations apply; ore and decoration remain underneath. Construction takes effect immediately, with a gentle three-second settling animation. The home is neither productive machinery nor a power consumer.

Construction immediately makes the single existing Pete peaceful, including during a pumpkin flight, web/water reaction, pursuit, pickup, transport or imprisonment. Future sabotage, police detection/arrests, sprinkler reactions, web scares/traps and combat stop; existing machine disable deadlines expire normally. Police custody/references and Pete’s hostile movement/projectile state are cleared safely. Factory production, logistics, nature, research and analytics continue normally.

An active walker immediately loses its attacks/hitbox and powers down through a six-second harmless smoke/heart scene while Pete heads home. This does **not** call combat defeat, reset arrests or raise the escalation threshold. A pending warning/unfinished encounter remains suspended at its existing arrest count and threshold. A combat defeat already committed before construction keeps its already-earned escalation.

Pete approaches a reachable cardinal entrance, climbs/enters over three seconds, rests for twelve seconds (a face in the window and “Zzz”), takes short walks within three tiles of home, then waves or admires flowers for five seconds before returning. An obstructed route is replanned; an enclosed home produces a four-second waiting wave followed by another attempt. He retains a real, free entrance tile while visually inside; he never occupies a factory building. All decisions, motion and effects use active simulation time and freeze with pause.

Every **5–10 active simulation minutes**, a separate seeded schedule attempts a gift on a reachable free tile within three tiles of home. At most **three** gifts wait. Gifts contain **1–2 Wood** or a bouquet; a bouquet paints flowers on its tile without adding an inventory. Press **Escape**, then click a gift to collect it exactly once, with status feedback. Gifts never reserve occupancy or affect transport/navigation. Building over one hides it until the tile is free again. No free reachable tile or a full gift cap simply skips that attempt and schedules the next interval.

Demolition gives **no Wood refund**, removes pending gifts without rewards, and immediately returns Pete to ordinary mischief with a small confused reaction. Arrest count and escalation are preserved. A suspended warning/encounter receives a fresh **five-second warning** before a new walker can arrive; demolition never immediately spawns one. Rebuilding costs another 20 Wood and restores peace.

The compact HUD reports peace/activity/gift count and preserved Revenge progress. Version **8** saves preserve the home, activity/path, independent RNG, gift deadline/IDs/pending rewards and any unfinished shutdown/reaction clock exactly. Versions **1–7** load in conflict with no home or gifts; existing Wood and all prior gameplay state retain their established migrations. Loading awards no gifts or Wood and never replays an attack or shutdown reward.


## Compact HUD and navigation

The header contains **Wood**, **Research**, **Overview**, **Analytics**, **Power**, **Help (?)** and **Menu (☰)**. Wood is the only current construction material; the HUD reads the existing global nature stock. Industrial items are not presented as construction currency. The treehouse tooltip explains its 20-Wood cost/shortage/one-home limit; other unlocked buildings remain free. An unfunded treehouse tool remains selectable for a marked preview only; research locks and the one-home limit remain disabled.

General management is closed by default. **Menu** contains the unchanged manual save/load, autosave load, import/export controls, the existing power-overlay option and **New game**. New game asks before replacing the running factory and preserves both browser save slots; cancellation keeps the world intact. It uses the same transactional world replacement as loading. Nothing loads or restarts automatically.

**Help** has separate **How to Play** and **Controls** tabs, including every current tool shortcut from the toolbar registry, camera/zoom, rotation, removal, cancellation, inspection, landscape dragging and gift clicks. Instructions are not permanently displayed during play. **Overview** contains the existing storage/production totals and electricity overview; **Analytics** still requires Analytics I and keeps its existing data, charts and bottleneck actions. The existing building inspector appears only after inspection, as a closable side overlay; its gameplay commands are unchanged.

Only one utility panel/research/analytics view opens at a time. Utility panels close through their header button, their Close button or Escape. Their heading stays reachable while content scrolls. Closing utility panels or Technology returns keyboard focus to the opener; opening Help/Controls supports normal tab and arrow navigation. While Menu, Help, Overview or Technology is open, world clicks, painting, previews and game/camera shortcuts are gated; the simulation continues. Escape first cancels an unfinished construction drag, then dismisses the current UI, then puts away the tool. Closing UI leaves the selected tool intact. The inspection closes before Analytics when both are open. Analytics keeps its existing world-focus behavior. UI navigation is view-only and is not saved; the save format remains version 8.

Routine Pete name/speech labels are removed. Cuffs/rope retain **CLICK! / CLICK! ZURR!**; sleep uses **Zzz**, friendship uses **♥**, confusion uses **?** and water/web surprise uses **!**. Boss health/warnings remain in the HUD; only small EMP/stomp/ejection symbols remain over the walker. Tool impacts retain their distinct graphics and concise damage/miss symbols. No animation durations or gameplay states change.

One fixed notification slot below the world replaces stacking messages. Permanent tool instructions and duplicate combat sentences are suppressed; placement errors, resource shortages, rewards and other meaningful results remain. Repeating the same text does not stack or restart it; a different message replaces it. Routine messages fade after 6.5 seconds with reduced-motion support; errors and shortages remain until replaced. Save errors remain available in Menu and appear in the status slot when Menu is closed. Research confirmation stays in Technology. Boss warnings and health are persistent, separate from transient messages.


## Building gestures and previews

Select **Conveyor belt** or **Power pole**, press the primary button on a valid world tile, drag, and **release over the world to build**. A click without movement still places exactly one tile. Nothing is built or charged during the preview. On release, the complete proposal is checked again against current occupancy, actor reservations, bounds and unlocks. Any required invalid cell cancels the whole operation with a short explanation; existing structures are never overwritten. These two tools are **free** under current construction rules, including at zero Wood; no industrial construction inventory is introduced.

Belt drags prefer the existing deterministic L route from start to end whenever every tile is buildable. An east/west selected direction chooses the horizontal segment first; north/south chooses the vertical segment first. Flow follows the drag, and each corner’s outgoing arrow points toward the next cell. The final belt continues the final segment’s direction. A single click retains the exact selected direction. R changes direction as before; changing direction during a pending drag cancels it so an old proposal cannot commit unexpectedly. Existing belt connections and item transfer handle the resulting turns.

If that direct route is blocked, a bounded cardinal A* search suggests an automatic detour around trees, buildings, existing belts and actor reservations. Obstacles are never removed or overwritten. Routes minimize tile count, then turns; equal alternatives use deterministic selected-direction/clockwise/counterclockwise/reverse ordering. Endpoints must still be buildable. The preview uses gentle turquoise arrows and **Auto detour** to distinguish the alternative, with its actual tile count and unchanged **Free** total cost. No extra confirmation is required. If no local path is found, the preview explains “No free path to the destination”; a search-budget failure suggests a shorter drag. Failure builds nothing. The search covers the endpoint rectangle plus eight tiles on each side, clipped to the map, with at most 4,096 expanded directional states; routes requiring a wider detour or more search can be rejected even if a global route exists. Break a long route into smaller gestures in that case. Preview and release use the same route selection and placement rules, rechecking live state at release. Conveyor throughput and save format are unchanged.

Power drags choose a **digital straight corridor** between endpoints. Within that corridor, spacing minimizes the number of new poles, then the number of links, using the existing inclusive six-tile Euclidean pole range. Existing corridor poles can be reused without replacement or duplicate placement. Occupied intermediate tiles can be skipped when valid spacing still connects the endpoints. No global routing or automatic obstacle detour is attempted. If that direct corridor cannot connect, the preview explains the failure and constructs nothing. Single isolated poles remain allowed; a new chain is internally connected but does not create electricity by itself.

World previews show transparent cells, belt arrows or pole links, and a compact cursor tooltip with name, total cost and any error. Green/check marks indicate valid placement; red crosses indicate blocked cells; amber diamonds indicate insufficient Wood. The treehouse shows its actual 20-Wood cost and available global stock. No physical building is drawn over an invalid occupied tile. All current buildings occupy one tile; validation continues to use the authoritative physical occupancy array. Preview text keeps its screen size at different zooms. Resource counts, power allocation, production and topology never change merely by hovering.

**Escape** acts on one layer per press: pending construction drag → open menu/Technology → selected inspection → Analytics → selected tool. Cancelling a drag keeps the tool selected. **Right-click** in the world similarly cancels a pending drag first; with no drag it puts away the selected construction, removal, landscape or combat tool. It never removes a building or undoes already-painted landscape. The browser context menu is suppressed for handled game right-clicks. Tool changes, rotation, menu opening, world replacement, leaving/releasing outside the canvas, browser blur or hidden-page transition discard pending construction. A toolbar-origin drag cannot start construction in the world. Normal camera and precise single-click controls remain available.

One short tool hint appears beside the existing toolbar selection. It hides after **three successful uses of that interaction** (one completed gesture counts once, regardless of tile count). Cancelled/failed actions do not count. Hints remain available under **Help → How to Play → Building tips**. Counts last for the current app session only, carry across world loads/new games in that session, and are neither gameplay state nor a save-file preference. Save format **8** and all legacy migrations remain unchanged; only completed construction is saved.

Inspection now starts with a name/icon, purpose, short operating explanation, relevant recipe/transport information and power connection status. Examples include “Needs electricity”, “Waiting for iron plate”, “Output is full” and “Temporarily disabled”. Belt inspection shows the real packet/progress and output direction. **Details and settings** retains the existing buffers, power networks, recipe controls and prison release action. These summaries read the copied authoritative inspection data and do not run a second production model. Close × or Escape dismisses the panel.
