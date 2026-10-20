# Development workflow

Read [AGENTS.md](../AGENTS.md) first. Use [Architecture](ARCHITECTURE.md) to find owners, [Game design](GAME_DESIGN.md) for implemented rules, and [Roadmap](ROADMAP.md) to distinguish proposals.

## Local setup and startup

From the repository root, use Node.js and npm. Node **24.19.0** with npm **11.9.0** was verified for this documentation sprint; these are tested versions, not repository version pins. Dependencies/scripts in [`package.json`](../package.json) and [`package-lock.json`](../package-lock.json) are authoritative.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Stop the server with Ctrl+C. Installation requires access to the package registry; gameplay runs locally with bundled dependencies and procedural graphics, without cloud APIs or external AI services. `npm ci` uses the committed lockfile; do not upgrade dependencies or rewrite it during unrelated work.

In this restricted cloud workspace, the default npm cache was not writable (`ENOENT` at `/home/agent/.npm/_cacache`). Installation was verified with `npm ci --cache /tmp/mini-factorio-npm-cache`; use a writable cache override for that environment without changing the lockfile or disabling integrity checks.

On Windows PowerShell, if `npm.ps1` is blocked, use `npm.cmd ci`, `npm.cmd run dev` and `npm.cmd` for subsequent validation commands. This avoids changing execution policy. Linux/cloud validation does not establish that a Windows environment was tested.

## Commands and checks

These are the existing npm scripts; run them from the root.

| Command | Script / purpose |
| --- | --- |
| `npm run dev` | `vite`: local development server |
| `npm test` | `vitest run`: all colocated tests, once |
| `npm run typecheck` | `tsc -b`: TypeScript project checks |
| `npm run lint` | `eslint .`: lint and Hooks rules |
| `npm run build` | `tsc -b && vite build`: production output in ignored `dist/` |
| `npm run preview` | `vite preview`: serve an already-built production bundle locally |

For a focused run, use `npm test -- src/simulation/autoAssemblers.test.ts` or `npm test -- src/game/cameraMovement.test.ts`. Before review, run all tests, typecheck, lint and build. Report failures, warnings and unrun checks accurately; fix regressions caused by the task. A documentation-only sprint needs no new application tests; verify links, source claims and documentation-only scope as well.

On CPU-limited cloud hosts, `npm test -- --maxWorkers=2` runs the same full suite with less contention. Sprint 7.6 validation passed all 381 tests with this setting; the default parallel run intermittently exceeded the existing 5-second timeout in the long circuit-conservation regression. No tests were skipped and no timeout thresholds changed.

Run browser checks separately from the full test suite. On busy cloud hosts, `npm test -- --maxWorkers=1` further reduces contention without changing test coverage or timeout thresholds; this was used for final Sprint 8 validation.

## Branch, commit and pull request

Check for user changes before switching branches. For a new sprint, use:

```sh
git status --short --branch
git fetch origin main
git switch -c <feature-branch> origin/main
```

Replace `<feature-branch>` with the requested sprint name. Verify required previous features on the fetched base; if unavailable, report the blocker instead of implementing against stale assumptions. Follow explicit instructions to continue an existing branch rather than recreating it.

Implement only approved scope, add relevant regressions, update documentation and inspect `git diff` / `git diff --check`. Stage the intended files, commit with a descriptive message, then publish:

```sh
git push -u origin HEAD
git rev-parse HEAD
git ls-remote origin refs/heads/<feature-branch>
```

Verify that the remote hash matches the commit. Create/review a pull request targeting `main` through an available supported integration or GitHub's compare page: `https://github.com/NuriHohn/mini-factorio/compare/main...<feature-branch>?expand=1`. On GitHub, use **Create pull request** if authorized. Publishing a branch is not creating a PR, and Git read/push access does not prove pull-request API capability. Report integration/permission limitations precisely. Never automatically merge into main or force push/reset/change credentials to work around access failures.

## Regression coverage

| Tests under `src/` | Important coverage |
| --- | --- |
| `simulation/world.test.ts` | Placement, removal, mining, transport, congestion and timing |
| `simulation/smelting.test.ts`, `simulation/copper.test.ts` | Exact batches/reservations, both metals, switching, typed inventory and production |
| `simulation/autoRecipes.test.ts` | One-time furnace detection/locks, simultaneous mixed ore, outages and conservation |
| `simulation/assemblers.test.ts` | Quantities, multi-input/per-item capacity, power, removal and complete circuit chain |
| `simulation/autoAssemblers.test.ts` | Initial waiting boundaries, candidate priority, permanent locking, mixed input order, backpressure, Manual locks and determinism |
| `state/gameStore.test.ts`, `simulation/recipeLock.test.ts` | Shared toolbar/keyboard toggles, ESC (including form focus and repeated keydown), inspection gating, permanent recipe locks and safe manual overrides |
| `simulation/inserters.test.ts`, `game/inserterArm.test.ts` | Source/destination contention, snapshot budgets, ports, cycles, power, held-item conservation, full production and arm continuity |
| `simulation/power.test.ts`, `simulation/polePlacementPreview.test.ts` | Network splitting/merging, coverage, proportional allocation, deterministic assignment and preview boundaries |
| `simulation/beltConnections.test.ts`, `game/beltPath.test.ts` | Stable visual topology and straight/curve continuity |
| `simulation/splitters.test.ts`, `game/splitterPath.test.ts`, `state/gameStore.test.ts` | One-tile rotations/ports, rear-only input, round robin, congestion/recovery, three-slot capacity, atomic conflicts, chains/cycles, conservation, curves, inserters and tool 0/ESC |
| `simulation/police.test.ts` | Power/range boundaries, deterministic competing radar dispatch, edge reachability, obstacle-aware pursuit, arrest/transport, release/escape/grace clocks, cooldowns, removal and stale commands |
| `simulation/pete.test.ts`, `game/peteVisuals.test.ts`, `state/gameStore.test.ts` | Seeded navigation, reachable escape fallback, cooldown/impact/disable/cry timing, zero-demand pause/resume, conservation, click priority and splatter cleanup |
| `game/cameraMovement.test.ts` | Directions, diagonals, timing, zoom and bounds |

Use explicit power infrastructure in production fixtures; [`testFixtures.ts`](../src/simulation/testFixtures.ts) supplies a full-power world. Never bypass electricity in application code for legacy tests. For changed simulation behavior, test rejected transfers, simultaneous reservations, exact timing, blockage/outages and equivalent time partitions where relevant. Conservation must include held inserter items and committed job inputs and exclude reserved products; use component material weights from [Architecture](ARCHITECTURE.md#invariants-and-extension-points). Removal intentionally discards contents.

## Manual gameplay acceptance

For input/rendering changes, check in an available browser and report whether checks were manual or automated. Do not claim browser checks from unit-test results alone.

1. Toggle each tool by its hotkey and toolbar button; switch directly between placement/deletion, verify only one active highlight, and cancel with ESC. Repeat ESC in normal mode and inspect without placing. Place and rotate each directional building; inspect with no tool selected; remove occupied machines/chests and verify lifetime totals remain.
2. Run iron/copper miner → Auto furnace → storage chains around straight and curved belts; check typed moving items and blocked-input retention.
3. Route iron plates and cables through separate circuit-assembler inputs. Check one-time Auto waiting/countdown, initial circuit priority, permanent locks after draining, safe Manual switching, two-output cable batches and stored versus lifetime counts.
4. Place poles near range boundaries and overlapping coverage. Check dashed preview links/colors, disconnected placement, coverage highlights and assigned networks without hover mutating topology.
5. Create a shortage, interrupt generation, then restore it. Check proportional speed, frozen processing animations/progress, reservations and continued belt/export behavior.
6. Place/rotate inserters with 8/R; check pickup/drop previews, chest selection, belt and machine ports, held items under blocked output/outages, and nominal outward/return timing. Preserve existing direct belt chains.
7. Observe Pete walking/throwing; inspect a slimed machine, verify zero demand and countdown, then automatic recovery. Click Pete with placement/deletion selected, verify only webs/fright occur, and observe fast fleeing and corner crying/recovery. Click repeatedly while fleeing/crying: webs replay but destination, crying duration and cooldown do not reset. Delete a flying pumpkin target and a slimed building; check cleanup.
8. Place radar with 9, verify range preview, full 5 kW requirement, flash and one police car. Follow pursuit/arrest/transport to the edge prison. Inspect angry Pete and release him; repeat and wait for the 60-second jailbreak. Verify grace, cooldown continuity, duplicate commands, unpowered radar, competing traps and prison removal during custody.
9. Place/rotate a compact splitter with 0/R, inspect rear/front/left port previews, toggle/cancel it, then feed one rear belt. Observe alternating front/left exits, hold one output full and verify the other continues, then block/reopen both. Check counts, throughput, curves, splitter chains and inserter extraction.
10. Check WASD, normalized diagonal movement, wheel zoom, camera bounds, viewport resizing and canvas cleanup/remount without errors or duplicate games.

## Documentation maintenance and technical limits

After each sprint, update the smallest relevant document: gameplay rules/tables in `GAME_DESIGN.md`, ownership/order/invariants in `ARCHITECTURE.md`, completed versus proposed work in `ROADMAP.md`, and setup/check/review changes here. Keep README as the entry point and AGENTS as actionable rules with links. Verify claims against actual source/functions and package scripts. Do not duplicate full rule tables across documents or mark proposed features implemented.

The production bundle currently triggers Vite's large-chunk warning because Phaser and the app ship in a large bundle; a successful build with that warning is not a failure or a performance guarantee. There is no repository CI workflow or committed browser-automation dependency; browser checks depend on the available environment. Startup files `App.css` and unused starter assets remain; avoid cleanup during unrelated work. Gameplay limitations, including explicit loading and missing advanced logistics systems, are listed in [Game design](GAME_DESIGN.md#production-chains-and-limitations).

## Sprint 9 save/load verification

Persistence tests live in `src/persistence/saveGame.test.ts` and `storage.test.ts`; menu/store regressions in `src/state/toolMetadata.test.ts`. Verify exact authoritative continuation across a mid-step save (including fractional remainder), shared crafting reservations through outages, carried/splitter items, recipe locks/waits, every police phase and exact prison escape timing. Compare parsed documents with a fixed metadata timestamp; JSON key order and reconstructed caches are not gameplay state. Corrupt/import tests must prove the original running factory and storage are untouched.

Browser checklist: Save Game → change factory → cancel then confirm Load Game; export a JSON download; import a valid modified backup; reject malformed JSON before confirmation; reload page and explicitly load the browser save. Verify separate autosave timestamps/slot, storage-denied feedback, transactional restoration failure, repeated loads with one tool hotkey action per keydown, responsive sidebar, camera/zoom, and no console errors. Switch tabs while placing/deleting, use cross-category 9/0/X hotkeys, Escape, mouse/keyboard activation, and confirm no dashed tool focus border. Test browser behavior separately from CPU-intensive unit tests.

Storage is per origin/browser/profile. Development and preview ports have different slots. Use JSON export when moving between them. No backend, account, token, network save service, IndexedDB, named-slot manager or offline progress is required. Future schema changes must follow [Architecture](ARCHITECTURE.md#extending-persistence).

## Sprint 9.5 sprinkler verification

`simulation/sprinklers.test.ts` covers one-tile placement/removal, inclusive range, full/partial/missing power, demand sharing, stable competing sources, exact 1/1/2/8-second transitions, cooldown, outage recovery, interruptible pumpkins, clicks, obstacles/replanning/enclosure, equivalent time partitions, web fleeing/crying, police priority, prison/release/escape and grace. `persistence/sprinklerSave.test.ts` saves/restores each phase and cooldown, paused sprays, deleted sources, exact future continuation and explicit Sprint 9 version-1 upgrading; rejects malformed phase/source/timer/version data without touching the live world. `game/sprinklerVisuals.test.ts` checks power-gated jets, splashes/bubbles, bounded puddle cleanup and read-only rendering. Tool registry/store suites cover G with the existing hotkey, Escape, category and inspector rules.

Browser checklist: select G from Factory and verify automatic Pumpkin Pete tab, toggle via mouse/keyboard, switch tabs and cancel with Escape; place/inspect a sprinkler with radius preview; observe aimed jet, wet Pete, backside slip, angry complaint bubble, running and fading puddles at normal zoom. Interrupt power during spraying and restore it. Save/load mid-spray and import/export mid-flee; verify no reaction restart or duplicate input handlers. Import a valid version-1 backup and verify no water state, then save/export version 2. Keep invalid/versioned file failures transactional and preserve manual/autosave slots. Check deletion-click consumption, existing production and camera/zoom/resizing. Tests and browser checks run separately to avoid resource contention.
