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

Use WASD to move and the mouse wheel to zoom. Keys 1–8 select the buildings below; R rotates directional placement clockwise, X removes, P toggles the electricity overlay, and Escape cancels tools so clicking a building opens inspection. Clicking a selected tool button also cancels it. Redirect an existing building by removing/replacing it. Removal discards contained items and active jobs but preserves lifetime mining/production. Normal placement previews are green/red for valid/invalid; pole colors are described below.

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

Furnace input capacity is two queued items total. Assembler Manual input capacity is two batches per ingredient: gear 4 iron plates; cable 2 copper plates; circuit 2 iron plates and 6 cables. Auto independently accepts up to **4 iron plates, 2 copper plates and 6 cables**, regardless of the detected recipe. A full buffer for one ingredient cannot prevent accepting another on a different input.

Committed job ingredients are outside queued input capacity. Output inventory plus reserved job products must fit the building's output capacity. A cable batch reserves two slots and increments lifetime cable production by two. Incompatible or excess items stay on their belts. Missing ingredients idle the machine; full output blocks new jobs. New jobs start at zero elapsed time and products can export on a subsequent simulation step.

## Automatic and manual recipes

**Furnaces:** Auto is the default, initially undetected. The first accepted compatible ore selects iron/copper smelting; simultaneous arrivals use source tile order. The recipe stays locked while any input, output or job remains. Once completely empty and idle, another incoming ore may select a different recipe. Selecting a specific recipe fixes Manual behavior, rejecting the other ore. Returning to Auto clears detection. See [`smelting.ts`](../src/simulation/smelting.ts).

**Assemblers:** Auto is the default, initially undetected. It buffers all compatible ingredients and considers only fully supplied recipes. Candidates prioritize more distinct ingredient types, so complete circuit batches take priority. Among equal-priority candidates, rotation after the last started recipe avoids repeatedly favoring gears over cables. Selection prefers candidates whose products fit; if none fit, it keeps a candidate for blocked-output feedback. Auto changes never discard buffers and never interrupt a job. See [`assemblerRecipes.ts`](../src/simulation/assemblerRecipes.ts).

Single-ingredient Auto batches wait **2,000 ms of unscaled simulation time before starting**; normal recipe processing time is additional. The clock starts at zero on the first boundary with a complete single-ingredient batch. Arrivals, candidate changes, outages and output backpressure do not restart it. Starting any job, or losing all single-ingredient readiness while idle, resets it. Complete multi-ingredient batches bypass the wait. Active jobs freeze selection; after completion, remaining ingredients are reconsidered. Waiting requests no processing power; an expired, otherwise-ready candidate requests power normally.

For both buildings, a player-requested mode/manual recipe change requires completely empty input/output buffers and no active job or reserved materials. Stop incoming supply and let work drain before switching; simulation revalidates every request. In assemblers, choosing a specific recipe locks Manual mode and removes the Auto waiting policy. The inspector shows mode/detected recipe, ingredients, capacities, buffers, reservations, progress, wait remaining and electrical status. It disables unsafe selection with a reason.

## Electricity and feedback

Machines start unpowered. Generators and consumers must be within pole coverage. Distances are Euclidean between tile centers and include the boundary. Only pole links join networks; overlapping coverage assigns a building to the lowest-index covering pole's network (row then column), never to multiple networks. Network IDs can change when poles split/merge.

Only working demand is allocated, including ready or moving inserters: miners with empty buffers and machines ready to start or actively processing. Missing ingredients, insufficient new-job output space and Auto waiting request zero. Each network gives all requesting consumers `min(1, capacity / demand)` of their demand; processing/mining speed scales proportionally, without priority or boosts. For example, 100 kW over 110 kW demand gives 90.9% speed. Surplus elsewhere cannot power a disconnected/overloaded network.

Zero power prevents starting jobs and preserves committed inputs, fractional progress and reserved products. Restoration resumes without catching up outage time. Assembler Auto waiting is a simulation clock, so it can expire during an outage. Furnace glow and assembler mechanisms follow processing progress and pause without power.

Pole placement/inspection shows a coverage circle and highlights covered machines; amber coverage highlights indicate assignment to another network. Placement also previews dashed links to every connectable pole: green valid/connected, orange valid/isolated, gray invalid. Isolated placement is allowed and hover never changes networks. P adds full-network coverage and machine outlines. Power badges show green full, amber reduced, red disconnected/no generation, blue idle. Inspections explain network assignment, requested/supplied power and shortages. Global statistics distinguish installed/connected capacity, surplus/deficit, chest inventory and lifetime production; nominal rates are not actual throughput.

## Production chains and limitations

Build miner → belt → furnace → belt → storage for either metal. For circuits, route iron plates to one assembler input and copper plates through a cable assembler to another input; send finished circuits by belt to storage. Separate ingredient belts avoid a blocked incompatible/excess item hiding needed ingredients behind it. One miner nominally supplies two full-power furnaces; actual throughput depends on power, delays and congestion.

Progress is in memory; reloading creates a new session. There is no save/load, automatic chest output, splitter, research, blueprint or Factory Architect yet. Chests require an inserter for extraction. Mixed-input head-of-line blocking and incomplete ingredient sets still require suitable deliveries/routing; Auto cannot invent missing materials. Rotation after placement requires destructive remove-and-replace. No fuel, depletion, electricity storage or player economy is implemented. Future proposals are listed separately in [Roadmap](ROADMAP.md).
