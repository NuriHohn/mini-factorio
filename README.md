# Mini Factorio

A playable factory prototype using React 19, TypeScript, Phaser 3, Zustand, Tailwind CSS 4 and Vite. Graphics are procedural.

## Launch

Run `npm ci`, then `npm run dev`. On Windows PowerShell with scripts disabled, use `npm.cmd`.

## Controls

- WASD: move camera; mouse wheel over the world: zoom.
- `1`: miner, `2`: conveyor belt, `3`: storage chest. All buildings are free.
- `R`: rotate the miner/belt placement direction clockwise. Arrows show output direction.
- Left-click: place one building. Miners require iron; belts and storage can be placed on any unoccupied tile.
- `X`: removal tool. Click any building to remove it; contained ore is discarded. Lifetime ore mined is preserved. Remove and replace to change its direction.
- Escape: cancel placement, then click a chest to inspect its inventory. Clicking the selected tool button also cancels it.
- Green preview means valid; red means invalid.

## Mining and transport

Build a miner on a blue-gray iron deposit, place a belt directly in front of its arrow, then connect belts to a storage chest. Choose each belt’s output direction; straight lanes and smooth 90-degree curves connect automatically to adjacent belts and miners, even when empty. Additional inputs form visible joining lanes. The rear connection is visually primary, followed by side connections in source tile order; this does not change transport priority. Belts accept ore from their rear or sides, never their output edge. Chests accept belts from every side and have unlimited capacity; they do not output items yet.

Each miner produces one ore per second into a one-item buffer. It pauses while that buffer is blocked and does not accumulate production during the pause. Each belt holds one visible item, taking 500 ms to move from input to output. Items wait at disconnected or occupied destinations. Transfers happen on fixed 50 ms steps; a newly arrived item moves on the following step, and a tile vacated during a step becomes available on the next step. Completely full conveyor loops jam. Merges use tile-coordinate priority rather than fairness.

The sidebar shows stored ore, cumulative ore mined, and the maximum production rate; actual production depends on congestion. Deposits are unlimited. Progress is in memory; refresh starts a new session. The random 40×40 world includes a guaranteed deposit at `(20, 20)`.

## Validation

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

## Architecture

`src/simulation/world.ts` owns terrain and tile-indexed building state, placement, rotation helpers and removal rules. `transport.ts` handles receiving and simultaneous belt transfers. `step.ts` advances transport, miner output, and mining on fixed steps, retaining partial elapsed time. `beltConnections.ts` derives incoming connections from topology without changing transport. These modules have no framework or DOM dependencies. `src/game/beltPath.ts` supplies pure, tile-local line/arc geometry shared by Phaser lane strokes and ore animation; adjacent tile paths meet at their edges.

Phaser's `src/game/FactoryScene.ts` owns the world, translates input into simulation operations, and renders buildings and individual ore items. Camera helpers remain independent of the renderer. React owns the canvas lifecycle, tool buttons and production sidebar. Zustand exposes control state and changed UI summaries, not per-frame item positions. Tailwind CSS 4 uses its Vite plugin.

Future splitters, furnaces, fuel, electricity and production chains are not implemented.
