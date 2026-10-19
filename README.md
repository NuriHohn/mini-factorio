# Mini Factorio

A playable factory prototype using React 19, TypeScript, Phaser 3, Zustand, Tailwind CSS 4 and Vite. Graphics are procedural.

## Start the game locally

Install Node.js 24 with npm, then run these commands from the repository root:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite in your browser. Keep the terminal running while
playing; press Ctrl+C to stop the server. On Windows PowerShell with scripts
disabled, use `npm.cmd` instead of `npm`.

## Controls

- WASD: move camera; mouse wheel over the world: zoom.
- `1`: miner, `2`: conveyor belt, `3`: storage chest, `4`: furnace. All buildings are free.
- `R`: rotate the miner/belt/furnace placement direction clockwise. Arrows show output direction.
- Left-click: place one building. Miners require iron; belts, furnaces and storage can be placed on any unoccupied tile.
- `X`: removal tool. Click any building to remove it; contained resources and active processing jobs are discarded. Lifetime ore mined and plates smelted are preserved. Remove and replace to change its direction.
- Escape: cancel placement, then click a furnace or chest to inspect it directly. Clicking the selected tool button also cancels it.
- Green preview means valid; red means invalid.

## Mining and transport

Build a miner on a blue-gray iron deposit, place a belt directly in front of its arrow, then connect belts to a storage chest. Choose each belt’s output direction; straight lanes and smooth 90-degree curves connect automatically to adjacent belts, miners and furnace outputs, even when empty. Additional inputs form visible joining lanes. The rear connection is visually primary, followed by side connections in source tile order; this does not change transport priority. Belts accept items from their rear or sides, never their output edge. Chests accept belts from every side and have unlimited capacity; they do not output items yet.

Each miner produces one ore per second into a one-item buffer. It pauses while that buffer is blocked and does not accumulate production during the pause. Each belt holds one visible item, taking 500 ms to move from input to output. Items wait at disconnected or occupied destinations. Transfers happen on fixed 50 ms steps; a newly arrived item moves on the following step, and a tile vacated during a step becomes available on the next step. Completely full conveyor loops jam. Merges use tile-coordinate priority rather than fairness.

The sidebar distinguishes stored ore and plates, lifetime ore mined and plates smelted, building counts and maximum production rates; actual production depends on input and congestion. Deposits are unlimited. Progress is in memory; refresh starts a new session. The random 40×40 world includes a guaranteed deposit at `(20, 20)`.

## Iron smelting

Build **miner → belt → furnace → belt → storage**. A furnace accepts ore from belts pointing into its rear or either side. Its arrow side is reserved for output: it sends plates only to an adjacent belt, not directly to another machine or chest. No fuel or electricity is needed.

- Recipe: **1 iron ore → 1 iron plate in 2 seconds** (maximum 0.5 plates/sec).
- Input buffer: two ore. Output buffer: two plates.
- Starting a job commits one ore outside the input buffer and reserves one output slot. Thus up to two queued ore and one active ore can be present. Output inventory plus reserved output never exceeds two.
- A new job starts at a simulation-step boundary with zero elapsed time, completes after 2,000 ms, and can output its plate on the following step.
- Missing input leaves the furnace idle. Full output prevents a new job. An occupied or missing output belt eventually fills the output buffer and blocks processing.
- Wrong items, such as plates fed into an ore input, remain on the belt and block that route.
- Multiple belts reserve input slots before transferring; existing tile-coordinate priority resolves competition. Machine outputs follow belt transfers, also in tile order. Fair merging is not guaranteed.
- One miner supplies two furnaces at full theoretical capacity; a single furnace naturally causes ore to queue.

The furnace glows while processing, shows progress and has a gray idle / amber active / red full-output indicator. Ore appears as blue-gray lumps; plates are silver rectangles on the same straight and curved belt paths. With no tool selected, click a furnace to see input/output counts, reserved output, processing progress and status. Chests store both item types in separate counts with unlimited capacity.

## Validation

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

## Architecture

`src/simulation/world.ts` owns terrain and tile-indexed building state, placement, rotation helpers and removal rules. `items.ts` defines typed inventories, and `recipes.ts` defines quantity-based recipes. `smelting.ts` owns processing jobs and output reservations. `transport.ts` handles capacity-aware receiving, simultaneous belt transfers and shared machine outputs. `step.ts` advances belts → machine outputs → existing smelting jobs/new job starts → mining on fixed steps, retaining partial elapsed time. `inspection.ts` derives copied inspection snapshots and global statistics. `beltConnections.ts` derives incoming connections from topology without changing transport. These modules have no framework or DOM dependencies. `src/game/beltPath.ts` supplies pure, tile-local line/arc geometry shared by Phaser lane strokes and ore animation; adjacent tile paths meet at their edges.

Phaser's `src/game/FactoryScene.ts` owns the world, translates input into simulation operations, and renders buildings and individual typed items. Camera helpers remain independent of the renderer. React owns the canvas lifecycle, tool buttons and production sidebar. Zustand exposes control state and changed UI summaries, not per-frame item positions. Tailwind CSS 4 uses its Vite plugin.

Splitters, additional recipes, assemblers, fuel, electricity and persistence are future features. Rotation of placed buildings still uses remove-and-replace, which discards their contents.
