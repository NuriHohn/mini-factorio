# Mini Factorio

A first playable milestone using React 19, TypeScript, Phaser 3, Zustand, Tailwind CSS 4 and Vite. Graphics are procedural.

## Launch

Run `npm install`, then `npm run dev` and open the URL Vite prints. On Windows PowerShell with scripts disabled, use `npm.cmd`.

## Controls

- WASD: move camera.
- Mouse wheel over the world: zoom.
- Select Mining machine in the sidebar or press 1, then click a blue-gray iron deposit.
- Escape: cancel placement. The sidebar button also toggles placement.
- Green preview means valid; red means invalid.

Each free miner occupies one iron tile and produces one ore per second. The random 40×40 world includes a guaranteed central deposit. Deposits are unlimited. Progress is in memory; refresh starts a new session.

## Validation

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`

## Architecture

`src/simulation/world.ts` contains framework-independent world generation, placement and mining logic. Phaser renders it and handles input in `src/game`. Zustand publishes UI state in `src/state/gameStore.ts`. React owns the sidebar and canvas lifecycle. Tailwind CSS 4 uses its Vite plugin.

