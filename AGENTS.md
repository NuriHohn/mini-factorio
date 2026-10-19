# Mini-Factorio

## Goal and development approach

Build a browser-based 2D factory automation game inspired by Factorio. Work in small, playable increments. Favor maintainable code and a stable milestone over broad, unfinished systems. Cover simulation rules with tests.

## Tech stack

- React 19 and TypeScript
- Phaser 3 for game rendering and input
- Vite for development and production builds
- Zustand for UI-relevant state
- Tailwind CSS 4, configured with `@tailwindcss/vite`
- Vitest for tests; ESLint for linting

Use the versions and scripts in `package.json` as the source of truth. Do not add dependencies unless the task needs them.

## Existing structure and architecture

- `src/simulation/world.ts`: framework-independent terrain generation and tile-indexed building state, placement/removal validation, direction helpers. Terrain is a flat boolean array (`true` means iron); buildings form a parallel array of miner, belt, storage, or null. Functions mutate the supplied world.
- `src/simulation/beltConnections.ts`: pure topology-derived input connections, independent of item activity. Rear input is visually primary, then side inputs in source tile order. This does not alter transport arbitration.
- `src/game/beltPath.ts`: pure tile-local line/quarter-circle centerlines used for both Phaser lane strokes and continuous item positions at tile edges.
- `src/simulation/transport.ts`: belt progress, directional acceptance, snapshot-based transfer arbitration and commit, and buffered miner output. Coordinate order resolves competing inputs; destinations occupied at the beginning of a step cannot receive in that step.
- `src/simulation/step.ts`: `advanceWorld` retains elapsed time and runs fixed 50 ms steps in transport → buffered miner output → mining order. Keep all three simulation modules independent of React, Phaser, Zustand and the DOM.
- `src/simulation/world.test.ts`: placement, removal, direction, production, transport, congestion, conservation (before any discard) and time-partition tests. Colocated connection and path tests cover topology changes, multiple inputs and geometric continuity.
- `src/game/FactoryScene.ts`: owns the simulation world, draws procedural terrain/buildings/ore, handles input, advances the world and publishes changed summaries to Zustand.
- `src/game/cameraMovement.ts`: renderer-independent camera movement and viewport-aware bounds helpers, using structural TypeScript interfaces. `cameraMovement.test.ts` tests directions, diagonal speed, opposite keys, timing, zoom, and bounds.
- `src/game/GameCanvas.tsx`: React host for Phaser. Creates the game in an effect, observes container resizing, and disconnects the observer and destroys the game on cleanup. Preserve compatibility with React Strict Mode.
- `src/state/gameStore.ts`: Zustand state for cumulative mined/stored totals, miner count, tool/direction selection, inspected chest inventory and status messages. The scene's world remains the simulation source of truth; the store exposes UI data.
- `src/App.tsx`: React application shell, building selection, production sidebar, and control hints.
- `src/main.tsx`: React entry point with Strict Mode.
- `src/index.css`: active global styling, Tailwind import, and dark interface styles. `src/App.css` and starter assets remain in the tree but are not used by the current app.
- `vite.config.ts`: React and Tailwind Vite plugins. Tests use Vitest's default discovery with colocated `*.test.ts` files.

Keep gameplay rules in simulation code, game rendering and input in Phaser, and interface components in React. Use procedural graphics; the current game does not depend on external art assets.

## Current playable milestone

- A 40×40 world with random iron clusters and a guaranteed deposit at `(20, 20)`. Deposits are unlimited; buildings are free.
- One building per tile. Miners require iron; belts and storage accept any free terrain tile.
- Directional miners produce one ore per 1,000 ms into a one-item buffer, output only to the belt in front, and pause while blocked without accumulating blocked time.
- Single-lane belts hold one ore item each, with 500 ms travel time. They accept rear/side inputs, reject head-on inputs, turn corners, and stop at blocked outputs. Procedural lanes follow automatic straight/curved connections, with additional paths for multiple inputs. Item motion follows each actual entry path. Connection appearance depends on adjacent building directions, not item state. New arrivals move on the next simulation step. Full loops jam; merge priority is deterministic, not fair.
- Storage accepts incoming belts from all sides and holds an unlimited integer inventory. It has no output yet.
- Keys: `1` miner, `2` belt, `3` storage, `R` clockwise placement rotation, `X` removal, Escape cancel/inspect. Click storage while placement is cancelled to inspect it. Buildings can be removed even when occupied, discarding contents but preserving lifetime production; redirect buildings by removing/replacing them.
- Sidebar shows cumulative mined ore, total stored ore, maximum production and selected chest inventory. Simulation world remains authoritative; no item positions are stored in Zustand.
- WASD camera movement, normalized diagonal speed, wheel zoom and viewport-aware bounds remain supported. Preserve resizing and React Strict Mode cleanup.
- Progress is in memory; reloading creates a new session.

## Planned features

Splitters, furnaces, production chains, electricity, research, and further automation are future milestones. Do not implement or scaffold these systems unless the current task requests them.

## Coding conventions

- Follow existing TypeScript/TSX style: two-space indentation, single-quoted strings in TypeScript, no statement-ending semicolons, and ES module imports/exports.
- Use PascalCase for React components and Phaser scene classes, camelCase for functions and variables, and uppercase names for shared constants.
- Prefer explicit, small interfaces and focused modules. Use type-only imports when importing only types. Avoid `any` and unnecessary type assertions.
- Respect compiler checks for unused locals and parameters, type-only syntax, and switch fallthrough. Keep ESLint and React Hooks checks passing.
- Keep time-based logic independent of rendering rate. Make randomness injectable where deterministic tests need it; `createWorld` already accepts a random function.
- Validate placement in the simulation layer rather than relying only on the visual preview.
- Publish UI-relevant changes through Zustand; avoid React state updates for every animation frame.
- Clean up observers, game instances, and any manually registered external listeners when their owner is disposed.

## Commands and validation

Run commands from the project root. Dependencies are managed with npm. On PowerShell installations that block `npm.ps1`, use `npm.cmd` instead of `npm`.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite; open the URL it prints |
| `npm run typecheck` | Run `tsc -b` |
| `npm test` | Run all Vitest tests once |
| `npm test -- src/simulation/world.test.ts` | Run mining simulation tests |
| `npm test -- src/game/cameraMovement.test.ts` | Run camera regression tests |
| `npm run build` | Run TypeScript checks and create the Vite production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Serve the production build locally |

For application changes, run relevant tests, TypeScript checks, lint, and the production build. Add focused tests for new simulation rules and meaningful regressions, including invalid inputs, timing, and placement boundaries where applicable. Keep simulation tests independent of a browser or Phaser renderer. For input or rendering changes, also check behavior in a browser when available, including movement, diagonals, zoom, and resizing; clearly distinguish automated checks from manual verification.

## Avoid unnecessary complexity

- Make the smallest coherent change that delivers the requested playable behavior.
- Preserve the current architecture; do not introduce an entity-component system, event bus, generic engine framework, or extra state layer without a concrete need.
- Prefer direct functions and data structures over speculative abstractions or premature optimization.
- Do not add persistence, networking, new resource types, or future production systems as incidental work.
- Avoid unrelated refactors, dependency upgrades, asset changes, or formatting sweeps.
- Keep documentation accurate about implemented behavior and distinguish future plans from working features.
