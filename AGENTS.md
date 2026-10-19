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

- `src/simulation/world.ts`: framework-independent TypeScript world generation, placement validation, miner placement, and mining updates. The world is a flat boolean tile array indexed by `y * SIZE + x`; `true` means iron. Functions update the supplied world in place. Keep this layer independent of React, Phaser, Zustand, and the DOM.
- `src/simulation/world.test.ts`: world generation, placement, and mining tests.
- `src/game/FactoryScene.ts`: owns the simulation world, draws procedural terrain and machines, handles Phaser input, advances mining with frame delta, and publishes UI statistics and messages to Zustand.
- `src/game/cameraMovement.ts`: renderer-independent camera movement and viewport-aware bounds helpers, using structural TypeScript interfaces. `cameraMovement.test.ts` tests directions, diagonal speed, opposite keys, timing, zoom, and bounds.
- `src/game/GameCanvas.tsx`: React host for Phaser. Creates the game in an effect, observes container resizing, and disconnects the observer and destroys the game on cleanup. Preserve compatibility with React Strict Mode.
- `src/state/gameStore.ts`: Zustand state for ore totals, miner count, building selection, and status messages. The scene's world remains the simulation source of truth; the store exposes UI data.
- `src/App.tsx`: React application shell, building selection, production sidebar, and control hints.
- `src/main.tsx`: React entry point with Strict Mode.
- `src/index.css`: active global styling, Tailwind import, and dark interface styles. `src/App.css` and starter assets remain in the tree but are not used by the current app.
- `vite.config.ts`: React and Tailwind Vite plugins. Tests use Vitest's default discovery with colocated `*.test.ts` files.

Keep gameplay rules in simulation code, game rendering and input in Phaser, and interface components in React. Use procedural graphics; the current game does not depend on external art assets.

## Current playable milestone

- A 40×40 green tile world with random iron clusters and a guaranteed deposit at tile `(20, 20)`.
- Free, one-tile mining machines placed only on unoccupied iron deposits. Invalid and out-of-bounds placements are rejected, with placement previews and status feedback.
- Each miner produces one ore per 1,000 milliseconds. Partial cycle progress is retained, and a time step can complete multiple cycles. Deposits are unlimited.
- WASD camera movement, normalized diagonal speed, and mouse-wheel zoom. Viewport-aware camera bounds keep its center inside the world and avoid horizontal movement locking on wide viewports or at low zoom. Preserve these behaviors when changing camera code.
- Sidebar building selection and production statistics: total ore, active miners, and ore per second. `1` selects the miner; Escape cancels placement.
- Dark interface with a Phaser canvas embedded in React. Progress is in memory; reloading creates a new session.

## Planned features

Conveyor belts, furnaces, production chains, electricity, research, and automation are future milestones. Do not implement or scaffold these systems unless the current task requests them.

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
