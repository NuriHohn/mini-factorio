# Implemented game design

The game is a session-only, browser factory sandbox. The following rules are implemented; [Roadmap](ROADMAP.md) contains proposals, not available mechanics. Source ownership is documented in [Architecture](ARCHITECTURE.md).

## World, items and controls

The world is 40×40 tiles with one building per tile, unlimited deposits and free buildings. Random clusters have injectable generation; distinct starter patches are guaranteed around iron `(20, 20)` and copper `(26, 20)`. Miners require ore; other buildings can occupy any empty in-bounds tile.

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

Use WASD to move and the mouse wheel to zoom. Keys 1–8 toggle the buildings below; selecting another tool replaces the previous one. Pressing the active hotkey or clicking the active toolbar button cancels it. Deletion is mutually exclusive with placement; R rotates directional placement clockwise, X removes, P toggles the electricity overlay, and Escape cancels tools so clicking a building opens inspection. Escape in normal selection mode leaves that mode and any open inspection unchanged. Toolbar tool buttons suppress focus outlines for mouse and keyboard interaction; the existing green active-tool border identifies the selected tool. Buttons remain keyboard operable. Escape cancels even while a form control has focus; other tool hotkeys ignore text and recipe editing. The electricity-overlay toggle remains blue. Redirect an existing building by removing/replacing it. Removal discards contained items and active jobs but preserves lifetime mining/production. Normal placement previews are green/red for valid/invalid; pole colors are described below.

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

**Assemblers:** Auto is the default, initially undetected. It initially buffers all compatible ingredients and considers only fully supplied recipes. Complete multi-ingredient circuit batches take priority. Equal initial candidates use recipe registry order. Selection prefers products that fit; if none fit, it retains a blocked candidate. Before the initial decision, the candidate may change as ingredients arrive. Once the decision locks, the machine never automatically changes it, even when completely empty. See [`assemblerRecipes.ts`](../src/simulation/assemblerRecipes.ts).

Single-ingredient candidates wait **2,000 ms of unscaled simulation time before locking**; normal recipe processing time is additional. The clock starts at zero on the first ready boundary. Arrivals, candidate changes, outages and output backpressure do not restart it. A complete circuit batch can win immediately during that window. Detection locks when the deadline expires or a complete multi-ingredient candidate is selected, even without power or output space; jobs still require power and output capacity. Only this initial detection waits: later batches of the locked recipe have no detection delay. Active jobs and all buffers are preserved.

For both buildings, an explicit manual recipe change requires completely empty input/output buffers and no active job or reserved materials. Stop supply and let work drain before switching; simulation revalidates every request. After any automatic or manual lock, Auto cannot be rearmed, including through a direct command; only an explicit safe manual recipe change can replace the recipe. Replacing the building creates a fresh undecided machine. The inspector distinguishes candidate versus locked recipe, pending/choosing/automatic-lock/manual-lock status, countdown, buffers, reservations and electrical state. It disables unsafe manual changes and disables Auto after locking.

Mixed speculative assembler stock from before locking is never purged or converted. Unused ingredients can remain buffered and prevent safe manual switching; select a manual recipe before supplying a mixed stock, or route ingredients to dedicated machines. Removal still deliberately discards contents. There is no input-buffer retrieval feature in this hotfix.

## Electricity and feedback

Machines start unpowered. Generators and consumers must be within pole coverage. Distances are Euclidean between tile centers and include the boundary. Only pole links join networks; overlapping coverage assigns a building to the lowest-index covering pole's network (row then column), never to multiple networks. Network IDs can change when poles split/merge.

Only working demand is allocated, including ready or moving inserters: miners with empty buffers and machines ready to start or actively processing. Missing ingredients, insufficient new-job output space and initial Auto detection waiting request zero. Each network gives all requesting consumers `min(1, capacity / demand)` of their demand; processing/mining speed scales proportionally, without priority or boosts. For example, 100 kW over 110 kW demand gives 90.9% speed. Surplus elsewhere cannot power a disconnected/overloaded network.

Zero power prevents starting jobs and preserves committed inputs, fractional progress and reserved products. Restoration resumes without catching up outage time. Assembler Auto waiting is a simulation clock, so it can expire during an outage. Furnace glow and assembler mechanisms follow processing progress and pause without power.

Pole placement/inspection shows a coverage circle and highlights covered machines; amber coverage highlights indicate assignment to another network. Placement also previews dashed links to every connectable pole: green valid/connected, orange valid/isolated, gray invalid. Isolated placement is allowed and hover never changes networks. P adds full-network coverage and machine outlines. Power badges show green full, amber reduced, red disconnected/no generation, blue idle. Inspections explain network assignment, requested/supplied power and shortages. Global statistics distinguish installed/connected capacity, surplus/deficit, chest inventory and lifetime production; nominal rates are not actual throughput.

## Pumpkin Pete

Exactly one immortal green goblin spawns near the starter factory at (17, 23). Pete walks between empty tile centers at about one tile/second; deterministic seeded choices never use wall-clock time or update-time `Math.random()`. Buildings are obstacles, ore deposits are walkable, and map edges are impassable. His current and next tile cannot be built on. An enclosed Pete waits safely and can move when a route opens.

After an initial 30-second grace period, a wandering Pete can throw at a miner, furnace or assembler within Euclidean distance 2. Stable building tile order breaks target ties. Launch starts a 30-second cooldown; a pumpkin flies for 400 ms of simulation time, then disables the same building for exactly 10 seconds. Deleting/replacing its target cancels the projectile. Already-disabled buildings cannot be targeted. Belts, chests, poles, generators and inserters are never targeted.

Sabotage requests zero production power, freezes mining/crafting progress and preserves recipe locks, inputs, outputs and reserved jobs. Existing belt/inserter transfers and buffered exports continue. Production automatically resumes after expiry, subject to normal power and buffer constraints. Orange pumpkin mush and green bubbling/dripping slime cover and dim the machine for the entire disable interval. Its inspector says **Sabotaged by Pumpkin Pete** with a simulation-time countdown. Removal immediately removes its splatter; replacement machines inherit no sabotage.

Click Pete directly to throw playful spider webs and scare him. This click takes priority over every placement/removal tool and inspection without changing the selected tool. Pete immediately enters `FLEEING`, moving at a nominal 4.5 tiles/second (3× the original fleeing speed, with wandering unchanged) toward a deterministic reachable map corner. Breadth-first navigation routes around buildings; topology changes trigger replanning. If all corners are unreachable, he selects a reachable tile nearest a corner (ties by tile index). With no exits, his current tile is a safe fallback. At the destination he enters `CRYING`, with animated tears, for exactly 10 seconds, then returns to `WANDERING`.

Every click replays the spider-web projectile animation. Repeated clicks while fleeing/crying are visual only and consumed without changing the escape destination or resetting movement, crying or sabotage timers. Pete cannot launch pumpkins while fleeing/crying, and scaring never resets his cooldown. A pumpkin already in flight remains committed and can land while he flees. All timing uses the deterministic 50 ms simulation, including cooldown and crying during power outages. Pete has no combat, health, destructive actions or additional toolbar controls.

## Production chains and limitations

Build miner → belt → furnace → belt → storage for either metal. For circuits, route iron plates to one assembler input and copper plates through a cable assembler to another input; send finished circuits by belt to storage. Separate ingredient belts avoid a blocked incompatible/excess item hiding needed ingredients behind it. One miner nominally supplies two full-power furnaces; actual throughput depends on power, delays and congestion.

Progress is in memory; reloading creates a new session. There is no save/load, automatic chest output, splitter, research, blueprint or Factory Architect yet. Chests require an inserter for extraction. Mixed-input head-of-line blocking and incomplete ingredient sets still require suitable deliveries/routing; Auto cannot invent missing materials. Rotation after placement requires destructive remove-and-replace. No fuel, depletion, electricity storage or player economy is implemented. Future proposals are listed separately in [Roadmap](ROADMAP.md).
