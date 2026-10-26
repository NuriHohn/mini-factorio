# Development workflow

Mandatory agent policy and document ownership live in [AGENTS.md](../AGENTS.md). This document supplies executable checks and delivery steps; feature requirements can use [the specification template](FEATURE_SPEC_TEMPLATE.md).

## Local setup and startup

From the repository root, use Node.js and npm. Node **24.19.0** with npm **11.9.0** was previously verified; these are tested versions, not repository version pins. Dependencies/scripts in [`package.json`](../package.json) and [`package-lock.json`](../package-lock.json) are authoritative.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Stop the server with Ctrl+C. Installation requires access to the package registry; gameplay runs locally with bundled dependencies and procedural graphics, without cloud APIs or external AI services. `npm ci` uses the committed lockfile.

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

**During implementation:** Run only focused tests relevant to changed behavior and dependencies; add meaningful regressions. Reserve the complete suite for final validation.

**Before delivery of code changes:** Run the complete test suite once, plus lint and a production build:

```sh
npm test
npm run lint
npm run build
```

The build already executes `tsc -b`. Do not additionally run `npm run typecheck` when a successful build covers the same source; the standalone command remains useful for targeted TypeScript feedback during development. Fix introduced failures and identify any remaining failures or unavailable checks. Do not weaken tests, skip regressions or bypass electricity to make a change pass.

Reuse passing results within the task while covered behavior, dependencies and inputs remain unchanged. Repeat only affected checks if subsequent changes invalidate them; re-run the complete suite when changes invalidate its regression coverage. Final validation must cover the delivered code.

For a focused run, use `npm test -- src/simulation/manualAssemblers.test.ts` or `npm test -- src/game/cameraMovement.test.ts`. Simulation tests must remain independent of Phaser, React and the DOM. Use explicit power infrastructure; [`testFixtures.ts`](../src/simulation/testFixtures.ts) supplies a full-power world. Test timing changes with equivalent elapsed-time partitions, not only a single frame sequence. Test changed transfer/capacity rules with rejection, contention, backpressure and outages; use the [material-accounting invariants](ARCHITECTURE.md#invariants-and-extension-points).

For persistence changes, verify strict validation and detached failure handling, round trips, resource accounting, and continuous N-step simulation versus K steps/save/load/N−K steps. Include fractional remainder, active jobs/reservations, transport buffers, NPC phases and timers, and supported old-version upgrades where affected. Compare authoritative state with a fixed metadata timestamp; JSON key order and derived caches are not gameplay state. Failed load/import must leave the live world and browser slots intact. Schema policy belongs in [Extending persistence](ARCHITECTURE.md#extending-persistence).

**Documentation-only PRs:** Verify Markdown formatting and links/anchors, source claims and command/file names, run `git diff --check`, and confirm only intended documentation files changed. Do not run the gameplay suite, lint, TypeScript checks, production build or browser verification for prose-only changes. If the changes affect executable configuration, commands or tooling, run the applicable code-validation checks above for those effects.

On CPU-limited hosts, use `npm test -- --maxWorkers=1` (or `--maxWorkers=2`) for the same full coverage with less contention. The default parallel run has intermittently exceeded the existing 5-second timeout in the long circuit-conservation regression. Historical validation used two workers for Sprint 7.6 (381 tests) and one for Sprint 8; no tests or timeout thresholds were changed in those historical runs. During Sprint 11 validation the circuit-conservation test exceeded 5 seconds even with one worker; the full 629-test suite passed with `npm test -- --maxWorkers=1 --testTimeout=15000`, a runner-only allowance without changing assertions or committed timeouts. Run browser checks separately from CPU-intensive unit tests.

## Branch, commit and pull request

The branch/isolation/preservation and never-auto-merge policy is in [AGENTS.md](../AGENTS.md#mandatory-agent-workflow). The command sequence for new work is:

```sh
git status --short --branch
git fetch origin main
git switch -c <feature-branch> origin/main
```

Use the requested branch name; for an explicitly continued branch, inspect and switch to that branch instead of creating one. Review and commit intended files:

```sh
git diff
git diff --check
git add <intended-files>
git diff --cached
git commit -m "<descriptive message>"
git push -u origin HEAD
git rev-parse HEAD
git ls-remote origin refs/heads/<feature-branch>
git status --short --branch
```

Verify matching local/remote hashes and report any remaining working-tree changes. Provide `https://github.com/NuriHohn/mini-factorio/compare/main...<feature-branch>?expand=1` for review against `main`. Create a PR through a supported integration only when authorized, or use **Create pull request** on GitHub's compare page. Publishing a branch is not creating a PR. If an operation is blocked, report the operation, exact error and missing capability; do not infer PR permissions from repository access.

The delivery summary should state what changed, validation actually performed, material limitations, commit/branch and compare URL. Report push failure explicitly instead of claiming publication.

## Regression coverage

| Tests under `src/` | Important coverage |
| --- | --- |
| `simulation/world.test.ts` | Placement, removal, mining, transport, congestion and timing |
| `simulation/smelting.test.ts`, `simulation/copper.test.ts` | Exact batches/reservations, both metals, switching, typed inventory and production |
| `simulation/autoRecipes.test.ts` | One-time furnace detection/locks, simultaneous mixed ore, outages and conservation |
| `simulation/assemblers.test.ts` | Quantities, multi-input/per-item capacity, power, removal and complete circuit chain |
| `simulation/manualAssemblers.test.ts` | Explicit selection, unconfigured rejection, independent inputs, safe switching, backpressure and outages |
| `state/gameStore.test.ts`, `simulation/recipeLock.test.ts` | Shared toolbar/keyboard toggles, ESC (including form focus and repeated keydown), inspection gating, permanent recipe locks and safe manual overrides |
| `simulation/inserters.test.ts`, `game/inserterArm.test.ts` | Source/destination contention, snapshot budgets, ports, cycles, power, held-item conservation, full production and arm continuity |
| `simulation/power.test.ts`, `simulation/polePlacementPreview.test.ts` | Network splitting/merging, coverage, proportional allocation, deterministic assignment and preview boundaries |
| `simulation/beltConnections.test.ts`, `game/beltPath.test.ts` | Stable visual topology and straight/curve continuity |
| `simulation/splitters.test.ts`, `game/splitterPath.test.ts`, `state/gameStore.test.ts` | One-tile rotations/ports, rear-only input, round robin, congestion/recovery, three-slot capacity, atomic conflicts, chains/cycles, conservation, curves, inserters and tool 0/ESC |
| `simulation/police.test.ts` | Power/range boundaries, deterministic competing radar dispatch, edge reachability, obstacle-aware pursuit, arrest/transport, immediate release/escape radar eligibility, sprinkler grace clocks, cooldowns, removal and stale commands |
| `simulation/pete.test.ts`, `game/peteVisuals.test.ts`, `state/gameStore.test.ts` | Seeded navigation, reachable escape fallback, cooldown/impact/disable/cry timing, zero-demand pause/resume, conservation, click priority and splatter cleanup |
| `simulation/webs.test.ts`, `game/webVisuals.test.ts` | Ground flight/lifetime, trapping/release/overlap immunity, protected states, bounded effects and rendering cleanup |
| `simulation/peteSabotage.test.ts`, `persistence/pete2Save.test.ts` | Expanded targets, generator allocation, carried-item/job conservation, web/trap continuation, version-1/2 migration and corrupt-reference rejection |
| `game/cameraMovement.test.ts` | Directions, diagonals, timing, zoom and bounds |
| `persistence/saveGame.test.ts`, `persistence/storage.test.ts` | Authoritative snapshots, jobs/transport/NPC continuation, clock remainder, corruption/version rejection, independent slots, autosave cadence and storage failures |
| `state/toolMetadata.test.ts` | Central category/hotkey membership, tab cancellation, selection and save-command guarding |
| `simulation/sprinklers.test.ts` | Range/power/competition, reaction boundaries/cooldown, outages, sabotage interruption, navigation/enclosure, time partitions, production conservation, webs/police/prison/grace and removal |
| `persistence/sprinklerSave.test.ts` | Each reaction phase/cooldown, powered-off sprays, deleted sources, deterministic restoration, explicit version-1 upgrade and invalid state rejection |
| `game/sprinklerVisuals.test.ts` | Power-gated jets, splash/bubble rendering, bounded puddle expiry/world replacement and read-only rendering |

| `simulation/analytics.test.ts`, `persistence/analyticsSave.test.ts` | Creation/consumption versus relocation, rate/history boundaries, utilization, diagnostic priority/reset/sorting, removal, persistence/migration/rejection and deterministic continuation |
| `game/arrestVisuals.test.ts` | Cycle stages 1/2/3/4+, boss-reset and higher-threshold behavior, read-only restraints/passenger rendering, unchanged pickup/transport/prison, optional version-6 clock validation and exact mid-effect continuation |
| `simulation/revenge.test.ts`, `persistence/revengeSave.test.ts`, `state/revengeTools.test.ts`, `game/RevengeVisuals.test.ts` | Completed-arrest thresholds, movement/targeting, EMP/stomp, hit/miss/camera transforms, shared cooldown/research/support, exact recovery, strict migration/continuation and read-only rendering cleanup |
| `simulation/research.test.ts`, `state/researchAccess.test.tsx`, `persistence/researchSave.test.ts` | Productive-time integer RP, fractional power/blocking/sabotage, purchase atomicity/prerequisites, placement/tool/dashboard gates, defaults, strict migration and exact continuation |
| `simulation/uniqueRecipes.test.ts` | Unique ore recipe probes and rejection of future ambiguous candidates |

## Browser verification

Browser verification is required for relevant visual/input changes when a browser is available; it is unnecessary for documentation-only changes or unrelated nonvisual changes. Verify affected flows and identify whether checks were manual or automated. Unit tests alone do not establish browser behavior. Use the gameplay sections linked below for expected values and mechanics rather than copying their rules into test instructions.

| Area / expected behavior | Verification scenarios |
| --- | --- |
| [Controls](GAME_DESIGN.md#world-items-and-controls), [categories](GAME_DESIGN.md#build-categories) | Toolbar/hotkey toggles, direct tool/deletion switching, repeated/form-focused Escape, selection/inspection, one highlight, no dashed tool outline, explicit Spider Web gating, cross-category 9/0/X/G/B hotkeys and tab-switch cancellation; placement, rotation and occupied-building removal |
| [Production](GAME_DESIGN.md#recipes-and-buffers), [recipe selection](GAME_DESIGN.md#automatic-and-manual-recipes) | Both ore chains around straight/curved belts; typed moving items; gear/cable/circuit batches; unique furnace Auto detection, explicit assembler selection, permanent locks after draining, safe manual switching, incompatible inputs and stored versus lifetime counts |
| [Power](GAME_DESIGN.md#electricity-and-feedback) | Range boundaries, overlapping coverage/assigned networks, cached dashed pole previews/colors, isolated placement, shortages, interruption/recovery, frozen progress/reservations and continuing transport |
| [Inserters](GAME_DESIGN.md#basic-inserters) | Ports/arm/held-item previews and animation, chest extraction, belt/machine transfers, blocked drops, outages, cycle timing and direct belt chains |
| [Splitters](GAME_DESIGN.md#compact-splitter) | All rotations/port previews, balanced exits, one/both outputs blocked then recovery, throughput/counts, curves, chains and inserter extraction |
| [Pete](GAME_DESIGN.md#pete) | Walking/throwing, sabotage inspector/countdown/recovery, mush/slime cleanup, selected-tool direct/ground targeting, repeated web hits without timer resets, trapping/overlap immunity/fleeing/crying and target/building deletion |
| [Police/prison](GAME_DESIGN.md#police-radar-traps-and-prison) | Range/power/flash, competing traps, pursuit/arrest/transport, angry prison inspector, manual release, timed jailbreak, grace/cooldown continuity, duplicate release commands, unreachable routes and removal during custody |
| [Sprinklers](GAME_DESIGN.md#anti-goblin-sprinkler) | Category/shortcut, radius preview/inspector, jet/wet Pete/slip/complaint/flee/puddles at normal zoom, power pause/recovery, consumed deletion clicks, police priority and source deletion |
| [Save & Load](GAME_DESIGN.md#offline-save-and-load) | Save, mutate, cancel/confirm load, export, valid/invalid import, refresh then explicit load, manual/autosave independence/timestamps, storage denial/quota, transactional rendering failure, version-1/2/3/4/5 import/version-6 export, mid-job/NPC/spray/flee restoration and no duplicate input handlers/loops after repeated loads |
| [Analytics](GAME_DESIGN.md#production-analytics) | Collapse/expand, rates and signed net values, up-to-three item selection/defaults, chart empty/partial windows, bottleneck camera focus/inspection, manual assembler selector, refresh/load continuation and narrow viewport/save-control coexistence |
| [Research](GAME_DESIGN.md#research-and-technology) | Zero-RP defaults and locked tool/hotkey explanations, effective RP/min, prerequisite/affordability cards, single-charge purchases, immediate unlocks, modal close/Escape/focus, analytics gating/coexistence, narrow viewport, version-5 save/reload and legacy unlock migration |
| [Pete’s Revenge](GAME_DESIGN.md#petes-revenge) | Warning/progress, oversized cockpit walker, actual canvas hit/miss at multiple zooms, shared cooldown/tool switching, EMP, one-time raised-foot stomp/shockwave, breakdown/ejection/stun and re-arrest, research gating and active-encounter Save & Load |
| Camera/lifecycle | WASD/normalized diagonals, wheel zoom, bounds, viewport resizing, responsive sidebar/save controls, canvas cleanup/remount and errors |

## Documentation maintenance and technical limits

Document ownership and update obligations are in [AGENTS.md](../AGENTS.md#documentation-ownership). Keep feature-specific proposals in the [template](FEATURE_SPEC_TEMPLATE.md) and mark completion only after implementation; retain the [roadmap](ROADMAP.md) distinction between delivered and proposed work.

The production bundle currently triggers Vite's large-chunk warning because Phaser and the app ship in a large bundle; a successful build with that warning is not a failure or a performance guarantee. There is no repository CI workflow or committed browser-automation dependency; browser checks depend on the available environment. Startup files `App.css` and unused starter assets remain; avoid cleanup during unrelated work. Gameplay limitations, including explicit loading and missing advanced logistics systems, are listed in [Game design](GAME_DESIGN.md#production-chains-and-limitations).

Storage is per origin/browser/profile. Development and preview ports have different slots; use JSON export when moving between them. The offline persistence scope and exclusions are in [Game design](GAME_DESIGN.md#offline-save-and-load) and [Architecture](ARCHITECTURE.md#versioned-offline-persistence).

Sprint 12.2 presentation coverage lives in `game/arrestVisuals.test.ts` and `game/RevengeVisuals.test.ts`: 3.4-second phased custody, all restraint stages, boss-defeat resets, legacy 750 ms continuation, malformed duration/clock rejection, frame partitions, paused presentation, factory independence, bounded tool captions and no camera shake. `simulation/police.test.ts` retains the immediate-release regression and exercises repeated long pickups with one car/count per case. The repeated-cycle fixture keeps sabotage on cooldown so a legitimate generator outage cannot masquerade as release immunity.

For visual review, exercise the full arrest at normal and zoomed-out scales, pause during restraints, and save/load mid-scene. Check EMP charging/impact, raised foot/stomp, breakdown/ejection and each tool’s hit and ground miss. Test Technology opening with normal and reduced-motion preferences. Headless Chromium’s software WebGL path produced stale screenshots during Sprint 12.2 verification; Canvas fallback (`--disable-webgl`, using the existing `Phaser.AUTO`) provided current frame captures without changing application configuration. Simulation assertions remain independent of screenshots.

Sprint 13 coverage: `simulation/nature.test.ts` exercises independent scheduled growth/reproduction, the 20% boundary, factory footprint exclusion, cap/manual exemption, occupancy/ore/wood invariants, clipped brush paths and deterministic generation. `persistence/natureSave.test.ts` covers version-1–6 empty migrations, exact version-7 continuation, malformed records and once-only stock. `game/landscapeStroke.test.ts`, `game/natureVisuals.test.ts` and `state/natureTools.test.ts` cover zoom/drag/cancellation, cached hidden decoration, stump lifetime, species/stages and toolbar/stock boundaries. Existing factory fixtures explicitly start without natural obstacles, while new-world generation has its own coverage.

For Sprint 13 browser review, inspect groves/meadows at normal/zoomed-out scales, plant/chop on starter ore, immediately construct on the chopped tile, demolish to reveal retained decoration, drag every brush size, erase without touching occupancy, cross growth/reproduction deadlines and save/load both new and legacy worlds. Use actual canvas clicks/tool controls and verify Wood and authoritative cells, not screenshots alone.

Sprint 14 regressions live in `peace.test.ts`, `peaceSave.test.ts` and `peaceAccess.test.tsx`: atomic Wood/occupancy/one-home rules; hostile/custody/active-boss transitions without defeat accounting; deterministic daily routines, obstruction recovery, gift cadence/cap/rewards; demolition/rebuild/escalation; exact version-8 continuation and version-7 migration; malformed peace records; copied toolbar/HUD access; and productive factory accounting during peace. Historical synthetic saves omit the newly introduced peace field to retain their genuine strict schemas. Browser verification should cover house construction/preview, climbing/window/gestures, gift clicks, gentle boss shutdown and demolition at normal and reduced zoom, plus pause and mid-scene import/load.


Sprint 14.5 UI regressions are in `uiNavigation.test.tsx` and `peteCaption.test.ts`, with updated tool grouping/access and observational Revenge renderer tests. They cover closed-by-default panels, mutual exclusion/Escape/tool preservation, unchanged shortcut metadata, exact Wood, manual research funding/prerequisites/queued/completed states, static message filtering and retained arrest sounds/timing. Browser verification must additionally exercise actual DOM focus/scrolling, menu/import/save/load/New game confirmations and preserved slots, modal input guards, all bottom groups and brush controls, quiet NPC captions, and compact desktop viewports. UI changes keep save version 8; no schema migration is expected.


Sprint 14.6 regressions live in `construction.test.ts` and `buildingControls.test.tsx`. Cover orthogonal belt directions and live item transfer, minimum/reused pole placement and inclusive connectivity, late invalidation/atomic failure, zero-cost construction at zero Wood, nonmutating funding previews, single-release/cancel/world replacement, Escape layers, three-use hints and copied beginner diagnostics. Browser checks additionally cover real pointer-up commit, right-click/context-menu suppression, toolbar-origin drags, menus/focus/outside release, actual inspection disclosures, funding preview and normal/reduced zoom at desktop sizes. Do not invent a material requirement for currently free buildings to test shortages; test the existing 20-Wood treehouse instead. Version 8 saves contain only committed buildings and no gesture or tutorial counters.


Sprint 14.7 regressions in `simulation/beltRouting.test.ts` cover preferred direct routes, deterministic shortest/few-turn detours, tree/building/belt obstacles, map edges, local-search limits/budget feedback, atomic live revalidation, cache invalidation/reuse, free construction, four selected directions and item transport through corners across version-8 Save & Load. Existing construction/control tests retain single-click, Escape, session hints and zero-Wood/treehouse-shortage checks. Browser verification must use actual drag/release for unobstructed routes, groves, factory obstacles, unreachable destinations, Escape/right-click/UI/outside cancellation and normal/reduced zoom; inspect preview directions, detour marker, actual placed cells, item delivery and unchanged resource stock. No new conveyor material cost or save migration is introduced.


Sprint 14.8 regressions in `simulation/powerRouting.test.ts` cover minimum-new electrical chains, forest/factory detours, wires across blocked ground without line of sight, off-corridor infrastructure reuse, exact/snap/single-click endpoints, network merging and actual machine supply/coverage, stable choices, bounded/budget/isolated failures, nonmutating free cost accounting, late invalidation, once-only release/cancel and version-8 continuation. `construction.test.ts` now uses a truly electrically isolated endpoint rather than rejecting a detourable straight corridor. Shared heap extraction retains the belt routing regressions. Browser checks additionally cover long routes, forests, two-network joins/actual power, blue reuse rings and explicit adjacent snap feedback, zero-Wood free construction (paid treehouse shortage remains separate), actual Escape/right-click/menu/blur/UI/outside cancellation, normal/reduced zoom, Save & Load and a belt detour regression.


Sprint 14.9 coverage in `simulation/beltOverwrite.test.ts` verifies all four single-tile reuse/reversal directions and both conflict axes, exact object/packet preservation, mirrored straight and retained side-entry progress, next-step delivery, multi-item conservation and version-8 continuation, deliberate line reversal versus incidental preservation, protected crossings/detours, mixed atomic actions, no-charge reuse/reversal and conservative endpoint choices (unique rear receiver, parallel/ambiguous/manual/single-click cases). Existing budget callback coverage counts direction-aware queries while retaining the expansion cap. Browser verification uses actual click/drag/R controls for new/reused/amber reversed/red invalid previews, both line-crossing axes, parallel lines, endpoint item delivery, occupied reversal, cancellation, the actual paid-tool shortage, Save & Load and unchanged power routing at normal/reduced zoom. Current belts cost zero; do not invent an insufficient-material state for free belt reuse/reversal.


Sprint 15.0 coverage is in `waterTerrain.test.ts`, `bridges.test.ts`, `waterSave.test.ts` and `landscapeWater.test.ts`: seeded layouts/coverage/protected connected land and ore, shoreline masks/nature restrictions, NPC water obstacles, 1/3/5-cell horizontal/vertical bridges, invalid width/endpoints/turn detours, multiple crossings, cost/reuse/reversal/atomicity/cancellation, rear-only transport, whole-crossing demolition, strict version-9 round trips and dry version-8 migration, and bounded pause-safe cosmetic schedules. Historical schema fixtures remove root water explicitly; old factory fixtures request dry maps without weakening assertions. Browser review must inspect generated features/banks and living water, real machine rejection, bridge previews/directions/cost/shortages, 3/5/6-cell and corner routing, live packets, removal/rebuild, same-axis protection, cancellation, old/new import/save/load and camera zoom. Current saves are version 9; prior-version regression names identify the originally introduced feature schema rather than the current writer.

## Performance profiling and validation

Sprint 15.1 investigated the actual Phaser loop, simulation scheduling, Graphics command buffers, publication/React work and existing caches before changing them. The base (`ce8a0b0`) used uncapped rAF callbacks with smoothed deltas, replayed full-map terrain Graphics, redrew all buildings/trees each frame, and constructed copied/serialized HUD summaries every frame. Canvas CPU samples placed `GraphicsCanvasRenderer`, Canvas stroke/fill operations and development React JSX creation among the dominant named consumers. Power topology already invalidates by revision; forestry already checks the next deadline before scanning. Neither needed a speculative simulation rewrite. The large static terrain replay, offscreen dynamic geometry and excessive summary construction justified the changes described in [rendering architecture](ARCHITECTURE.md#frame-pacing-and-rendering-efficiency).

A reproducible optional harness is [`scripts/profile-browser.py`](../scripts/profile-browser.py). It requires an available Python Playwright installation and `/usr/bin/chromium`, not a game/runtime dependency. Start each revision's Vite dev server on a different port, then run sequentially, without tests/builds/source edits in parallel:

```sh
python scripts/profile-browser.py before http://127.0.0.1:5174
python scripts/profile-browser.py standard http://127.0.0.1:5175
python scripts/profile-browser.py saving http://127.0.0.1:5175 energy-saving
```

The harness constructs the same seeded `.42` world, sets trees to five-minute age, fills dry starting-area cells `(11..29, 11..29)` with east-facing belts/storage (skipping `(20,20)`), and restores it through the scene's transactional restore path. This is a 410-building/decorated-map conveyor rendering stress scene, not a production or pathfinding benchmark. Viewport is 1440×1000 at zoom 2.5, Canvas fallback (`--disable-webgl`), two-second warmup and an eight-second requested CDP CPU-sampling window. Timings include profiler/browser scheduling overhead; measured windows were about 9.1–9.4 seconds. JSON metrics and sampled CPU profiles are written to `/tmp/perf151-LABEL*.json`. Profiling intentionally uses development-module access; use DevTools for production-bundle measurements.

One sequential local comparison on this shared cloud host:

| Measured metric | Base `ce8a0b0` | Standard after | Energy Saving after |
| --- | ---: | ---: | ---: |
| Observed scene callbacks / second during profiling | 15.7 | 44.6 | 25.9 |
| Mean scene update (ms) | 4.67 | 1.81 | 1.78 |
| Scene update p95 (ms) | 9.90 | 3.50 | 4.10 |
| Machine Graphics command-buffer entries | 83,425 | 52,680 | 52,680 |
| Buildings drawn / total | 410 / 410 | 265 / 410 | 265 / 410 |
| Summary publications in measured window | 143 | 84 | 81 |
| CDP task duration / measured elapsed (seconds) | 8.98 / 9.11 | 8.88 / 9.41 | 5.89 / 9.14 |

These single-run results establish lower per-frame work and less busy main-thread time in the capped mode in this fallback scene; host contention, development React and sampling overhead limit generalization. Earlier exploratory runs varied substantially. They do not establish WebGL GPU savings, laptop power draw, fan noise or temperature reductions. Repeat runs on the target machine before drawing thermal conclusions.

Automated timing tests cover 60/120/144/240 Hz callbacks, irregular intervals, mode switching, exact save-state equivalence with powered production, simulation-clock water effects, hidden-time rejection and retained fixed-step remainders. Viewport/cache tests cover camera bounds before preRender, margins/crossing lines, off-map views, decoration/topology/world changes; settings tests cover defaults, malformed/denied storage and diagnostics. Full existing save/routing/NPC regressions remain required.

Manual target-machine validation:

1. Use `npm run build` and `npm run preview`, load the same representative exported factory, keep camera/zoom/display resolution fixed, and warm up before each comparison. Repeat Standard and Energy Saving recordings several times, alternating their order. Use browser Performance/Rendering tools to inspect the main-thread flame chart, frames, allocation/GC and GPU/compositor work; record browser, renderer and monitor refresh rate. Compare with DevTools closed as well, since instrumentation adds work.
2. Toggle diagnostics and compare FPS/intervals. Watch transported items, furnace/assembler jobs, water, trees, Pete, police cuffs/rope and boss effects for the same animation speed. Pan/zoom across viewport edges, test long wires/coverage and large attacks near the boundary; build/remove/paint/chop and repeatedly load saves. Look for missing geometry, stale scenery, item loss and growing texture counts.
3. Hide the real tab for a minute and return. Verify frozen production/NPC timers, no catch-up spike, smooth resumption and cancelled drags. Also test blur without hiding, window resizing and repeated mount/unmount. Automated simulated visibility transitions exercise application guards but cannot establish every browser's OS/tab lifecycle behavior.
4. For the reported heat/fan issue, compare several minutes in each mode on the user's actual hardware using OS CPU/GPU/power/temperature instruments where available, with the same scene and background load. Record fan/thermal behavior separately from CPU percentage. The cloud browser cannot measure those physical effects.

Follow-ups require measurements: WebGL/GPU profiling on real devices, very dense fully zoomed-out scenes, and profiling the remaining 10 Hz React/analytics snapshot work. Terrain textures add bounded memory; further simulation indexes or power-allocation caches remain deferred until justified. Sprint 15.2’s mutable terrain now uses locally invalidated chunks as documented below.

Sprint 15.1 verification: all **1,007 tests in 63 files**, TypeScript, lint and production build passed. Automated Chromium Canvas checks covered preference refresh, diagnostics, actual frame ceilings/elapsed simulation progress, current camera bounds at 2.5/1.3/0.65 zoom, repeated terrain texture replacement without leaks, and synthetic hidden/visible callbacks with no hidden work/catch-up. The full Sprint 15.0 browser scenario also passed at 1.3/0.65 zoom (bridge previews/payment/reuse/reversal/removal/transport, invalid/shortage/cancel cases, mid-packet saves and dry version-8 import). A production-build smoke test also passed with Chromium software WebGL (SwiftShader): bridge rendering, diagnostics, persistent graphics selection and manual save/load, with no browser errors. This validates the WebGL code path, not physical GPU performance. Screenshots were visually inspected. The existing Vite warning for the large Phaser bundle remains; no dependency or save-schema changes were made.

## Water landscaping verification

Sprint 15.2 uses `simulation/waterLandscaping.test.ts`, `game/terrainVisuals.test.ts` and `persistence/waterLandscapingSave.test.ts`, with added stroke, living-water and toolbar coverage. They verify single/3×3/5×5 strokes, clipped boundaries, cardinally connected one-cell diagonal channels, no-op revisions, all existing structure kinds, actor/path/gift/prison reservations, both bridge directions and empty banks, neighboring edits with ongoing item transport, strict version-9 round trips, dry version-8 migration, eight-neighbor corner classification, observational geometry, tiny-pond effect limits, removed-water cleanup and local texture/cache failure handling. Existing version-1–9, production, NPC, routing and frame-pacing regressions remain part of the full suite.

Automated Chromium Canvas browser acceptance covered every requested scenario at 1.3 and 0.65 zoom: irregular ponds with all brush sizes; fast straight/diagonal channel dragging; removing part of a pond; map-edge brushes; red previews and skipped machines/belts/poles/trees; bridge-water/empty-bank protection and neighboring edits while items reach a chest; edited save/load with exactly 25 live terrain textures; and dry version-8 import followed by explicit painting. Additional large-area drags painted over 700 eligible water cells in both Standard and Energy Saving modes, then panned/zoomed without rebuilding static textures. No browser page errors occurred. Rounded bank/channel screenshots were visually inspected.

A sequential, same-fixture Canvas comparison using the [existing profiling harness](#performance-profiling-and-validation) against merged Sprint 15.1 (`41a96da`) observed 40.56 → 40.77 scene callbacks/second, mean scene update 2.18 → 1.84 ms and p95 4.4 → 4.3 ms. Both runs drew 265 of 410 buildings with 52,680 machine Graphics command-buffer entries. This single shared-host sample did not show a major idle rendering regression; it does not establish a statistically significant speedup or hardware power/thermal savings. Painting work is additionally checked through rebuild counts: one interior-cell edit redraws one 8×8 chunk, an edit at a four-chunk corner redraws four, and unchanged edits redraw none. A long stroke legitimately updates every chunk its footprint/neighbor halo touches. Versioned dirty checks coalesce multiple pointer events before a rendered frame.

For manual acceptance on the target browser, use Nature's Create Water/Restore Land in each brush size, including fast diagonal moves, the map border and coordinates around multiples of eight (cache boundaries). Look for continuous convex/concave banks and channel bends, immediate local shoreline updates, disappearing effects on removed water, and restored original ore. Paint near occupied buildings, moving NPCs, prisons and both ends of a bridge; red cells must remain unchanged while neighboring eligible cells apply. Save during an occupied bridge transfer, edit surroundings, reload and verify progress/stock/terrain. Repeat in both graphics modes while panning/zooming through large ponds and loading repeatedly. Cancellation ends further painting without undoing completed edits; no ordinary construction should be triggered by a water stroke.

Known limits: terrain stays a square logical grid even where visual corner arcs overlap a small part of an adjacent land tile; landscaping is free and immediate, has no undo, auto-detour or automatic bridge conversion, and conservatively refuses actor paths/bridge banks rather than moving entities. Underlying ore is preserved, while flooded decoration is cleared. Water/deep-site caches perform a bounded 1,600-cell refresh after a changed frame, not an incremental shoreline-map simulation. Power topology conservatively invalidates through the shared revision. Physical-device WebGL/GPU/temperature behavior still requires target-machine validation; the existing large-bundle Vite warning is unrelated and remains.

Final Sprint 15.2 validation: **1,044 tests in 66 files**, TypeScript, lint and production build passed. A production-build Chromium software-WebGL (SwiftShader) smoke test additionally exercised live painting/erasing across texture chunks, constructing a paid conveyor bridge across manually painted water with the ordinary belt shortcut/drag, protected erasure, save/load and persisted graphics selection. No browser errors occurred, and production screenshots were visually inspected. This exercises the WebGL rendering path without claiming physical GPU/thermal measurements. The existing Vite bundle-size warning remains.


Sprint 16.13 coverage in `simulation/experiment.test.ts` checks copper-based selection, all-three-material atomic pickups, inaccessible/split/insufficient stock, paid construction and home/site interruptions, completion-only XP, repeat activities/cooldown, protected yard approaches, version-26 migration and strict version-27 continuation/validation. `game/experimentVisuals.test.ts` checks staged geometry, simulation-time pulse, culling and observational rendering. Browser acceptance covers construction/experiments at normal/reduced zoom, inspection and save/load without factory output.


Sprint 16.14 coverage in `simulation/gearPress.test.ts` verifies weighted/atomic construction, paid interruption and no rebuilding, exact completion-only 2:1 production/analytics/XP, cooldowns and full buffers, home interruption, pause/partition/save-load continuation, concurrent belt input reservations, contested powered inserter output and in-flight gear preservation, approach protection, inspection, version-27 migration and strict malformed-save rejection. `game/gearPressVisuals.test.ts` covers staged geometry, culling, pause and observational animation. Browser checks cover construction, stocking, pressing, output collection, inspection and save/load at normal/reduced zoom.


Sprints 16.20.1–16.23 regressions extend `simulation/yard.test.ts` for late-obstacle section reordering, paid progress across Save & Load, distinct run ownership/containment, physical cover/removal visits and saved night/work phases. `state/simulationSpeed.test.tsx` checks the pace controls, pause and equivalent elapsed-time partitions including save/remainder continuation; `game/secretProjectVisuals.test.ts` verifies upright posts rather than rotating the entire fence. Existing gate, workshop and experiment regressions retain access and committed-work checks; explicitly chosen test projects begin a fresh selection decision.

Browser acceptance: inspect both fence axes/corners/openings at normal/reduced zoom, complete a paid run and inspect its coop, watch daytime birds return at rest, cover/rest/removal, and save/load while working. Use the actual Pause/×1/×2/×4 controls and compare displayed simulation-clock progress; verify camera and ordinary tool/inspection controls still work while paused. Check Standard and Energy Saving graphics and page errors. Purely temporary review fixtures must be removed before delivery.


Final Sprints 16.20.1–16.23 validation: **1,481 tests in 119 files**, lint and production build passed. Browser review exercised the actual speed buttons, frozen pause with normal keyboard construction/inspection, completed run/coop inspection, night cover with all five birds inside, morning removal, exact mid-removal save/load, normal/reduced zoom and both graphics modes. The final page had no browser errors; the temporary harness was removed. The existing Vite large-bundle warning remains. [Reviewed cover/run view](images/coop-cover-and-run.png).


## Portable browser build and hosting

The hosted runner uses two test workers and a 60-second per-test runner allowance: the unchanged workshop/yard integration test exceeded 15 seconds on GitHub while the local suite passed. Assertions and committed test deadlines are unchanged.

The relative Vite base lets `dist/` run at a host root or project subpath. Serve it over HTTP(S), not by opening the HTML through `file://`. `.github/workflows/pages.yml` validates main pushes (lint/full tests/build) and uploads `playable-game`. Deploy that artifact to an approved static host; it has no backend, account system or cloud save service. Export/import transfers saves between browser origins/devices; local slots remain separate.

The public game is served at [nurihohn.github.io/mini-factorio](https://nurihohn.github.io/mini-factorio/). The user approved making `NuriHohn/mini-factorio` public, Pages uses **GitHub Actions** as its source, and the repository Actions variable `ENABLE_PAGES=true` enables the existing deployment steps. Successful main builds publish automatically; `workflow_dispatch` can publish the current main revision without changing game code. The workflow uses the existing scoped `GITHUB_TOKEN`/OIDC permissions, with no personal access token or subscription.

Before changing visibility on 2026-10-23, a local scan of 1,856 reachable historical file versions (about 28 MB across fetched refs) found no matches for common provider-token/private-key/credential patterns or sensitive credential filenames. A filename review found game code, project documentation and gameplay screenshots; no repository rulesets existed. This is a bounded pattern/content review, not proof that every possible secret format is absent. Public repository history, PRs and Actions logs are visible on GitHub.

The private-repository plan originally blocked Pages; making the repository public resolved that hosting prerequisite. For future maintenance, disabling `ENABLE_PAGES` skips new deployments but does not remove an already published site. Changing hosting requires exporting saves because browser storage is origin-specific. iPhone/iPad installation and reliable offline caching remain future work; mobile acceptance must include real Safari devices.

Sprints 16.24–16.28 regressions cover paid copper/cable/circuit pickup and completion, physical treasure carry/deposit, interruptions, early practice crashes and recovery, scenic-flight unlock/cancellation, mid-work save continuation, legacy version-36 loading and malformed paid payloads/flight clocks, harmless spray power/range/cooldown/expiry and touch tap/pan/pinch/cancel. Browser checks cover collection inspection, flight/crash rendering, exact scene save round trips, touch preview/rotation/confirmation and narrow-screen layout. Synthetic touch events and a 390-pixel iframe exercise the DOM input/layout paths; they do not replace testing Safari/Android on physical hardware.

Final local validation: **1,491 tests in 122 files**, lint and production build passed. Browser acceptance also confirmed the actual playful-spray toolbar action, mouse/keyboard storage placement, belt drag and Escape/inspection, plus a 390-pixel touch layout. No browser errors were reported. Temporary review fixtures were removed. The existing Vite large-bundle warning remains; real-device iPhone/iPad testing remains outstanding. Hosted publication is covered by the public-site setup above.

## Higher development regression checks (Sprints 16.28.1–16.37)

`simulation/peteDevelopments.test.ts` covers all six paid builds and once-only rewards, suspended paid work, physical fruit/seedling carrying, fixed-step save continuation, fractional bicycle travel, workshop input/output reservations and powered extraction, home/structure interruption, corrupt stock/XP rejection and actual module-free version-37 migration. Existing workshop/experiment/recycling regressions cover their adjusted completion rewards; inventories and material-family tests cover the new Industrial module.

Browser checks on Windows Chromium used temporary deterministic scenarios through the actual scene and simulation, with iframe viewports 390×640, 844×390, 1024×640 and 1240×640. Checked full canvas resizing after collapsing tools/orientation changes, floating/collapsed tools, portrait inspection scrolling, first-tap preview/rotate/cancel/repeat-target construction, three-tap belt routing, touch pan/pinch, PC hotkeys/mouse construction/belt drag/inspection, new structures and active orchard/mechanics/cycling/nursery/annex save round trips. These checks do not establish physical iPhone/iPad Safari compatibility; that remains an explicit acceptance follow-up. Test fixture pages are temporary and are excluded from delivery.

Sprints 16.39–16.42 add `developmentStatus.test.ts` for explanations, blocked/full resources, read-only status, oldest-ready/overdue selection, nursery supply and pantry recovery; `developmentVisuals.test.ts` verifies distinct stages, bicycle ownership, annex attachment and read-only work progress. An active pantry-recovery save continuation is covered in `peteDevelopments.test.ts`. Physical iPhone/iPad Safari checks remain outstanding; browser viewport checks must be reported separately.

Learning aid regression coverage: `supplyAssistant.test.ts` checks exact shortages/families, range/source selection, partial/shared capacity, incoming-belt backpressure, stale requests, no production/XP, paused inspection and save continuation. `learning.test.ts` checks goal persistence, exact machine causes/ports, active process stages and stale/airborne route suppression. `learningAids.test.tsx` and `guidanceVisuals.test.ts` cover optional pins, empty-supply rejection, active-stage accessibility and read-only route rendering. Browser acceptance must exercise actual crate handoff, selection changes while paused, Help goals/pinning, connection highlights and Pete route/process cards in phone/tablet/desktop viewports. Physical iPhone/iPad testing remains a separate outstanding acceptance item.

Browser acceptance for 16.43–16.47 used temporary actual-scene fixtures at 390×640 portrait, 844×390 landscape, 1024×640 tablet and 1240×640 desktop. Verified paused project selection and 12-plate handoff (source 12→0, crate 0→12, production unchanged), exact furnace input/full-output explanations and amber ports, real plate production updating a goal to 2/5, pin/dismiss, actual Pete route show/hide, active process stage/stock, inspection scrolling and retained PC hotkey placement/belt drag. Fixtures were removed. The browser controller emitted a MutationObserver warning when opening a native select popup; fixture app/parent error listeners stayed clear and the handoff succeeded. No MutationObserver usage was found in app sources or the loaded Phaser/React/Vite clients. Real iPhone/iPad Safari acceptance remains outstanding.


## Sprints 16.48–16.52 validation

`ecoFactory.test.ts` covers mature/range-only forestry, power loss, backpressure, reserved replant Wood, occupied/wet plots, existing nursery seedlings, recipe ports/capacity, atomic resource placement, full autonomous construction/production, conservation, legacy version-38 inventory migration, mode-separated saves and exact continuation across travel/build/production/regrowth checkpoints. `petesWorld.test.tsx` checks the restricted resource toolbar, contextual help and retained Factory tools. Existing schema/registry assertions now recognize version 39 and the added items.

Browser acceptance used the actual app and temporary same-scene fixtures at 390×640 portrait, 844×390 landscape, 1024×640 tablet and 1280×720 desktop. Verified menu start/confirmation, real grove placement, all eleven Pete construction steps, nine real wooden crates in storage, manual save, switching to Factory and loading Petes Welt again, machine inspection, contextual help, original PC storage hotkey/click, Escape and a five-tile belt drag. Synthetic touch events exercised the existing gesture handler: first tap preserved zero trees, cancel preserved zero trees, repeated same-target tap created exactly nine trees and cleared the pending preview. A fixture-only pointer-capture shim enabled synthetic events; this does not establish physical Safari touch behaviour. Fixtures were removed.

The first device-fixture version used an unavailable Phaser game-list helper; it was corrected before acceptance. The controller also reported the previously observed MutationObserver warning around iframe state changes; the fixture’s app-error listener remained empty in the successful runs. Physical iPhone/iPad Safari acceptance remains open. The existing Vite large-bundle warning is unchanged in category.

Final local validation: **1,573 tests in 132 files**, lint and production build passed. No dependencies or hosting configuration were changed. The production bundle retains the known large-chunk warning.


## Sprints 16.53-16.57 validation

`homestead.test.ts` covers two real starter harvests, paid general storage, original fence/coop/campfire/garden progression, feeding and sleep, the level-three shared powered sawmill, physical Wood/panel transfers and the eight-panel roof. Exact save continuation covers starter travel/work and paid mill construction, input delivery, output return and roof work. Regressions also cover full-store cargo preservation, mixed 400-item capacity, malformed saves, no-tree waiting and version-39 committed prototype migration. `homesteadVisuals.test.tsx` covers real stock types/filling stages, roof/carry/work drawings, culling and observational rendering. Crate action tests retain ordinary Factory unloading and reject manual unloading in Petes Welt.

Windows Chromium acceptance used the actual app to start Petes Welt, place a grove and observe personal chopping/storage. Temporary same-scene fixtures then exercised the old projects, shared sawmill production of eight panels, roof completion, mixed Wood/ore/plate inventory, paused Pete/store inspection, and unchanged authoritative JSON after save/load. Viewports were 390x640 touch portrait, 844x390 touch landscape, 1024x640 touch tablet and 1240x640 mouse desktop; scrolling inspection remained usable. The fixture explicitly enabled the existing touch layout, so this is not a physical Safari gesture test. No app errors were recorded in the successful fixture runs. Initial fixture-only resource names were corrected to registry IDs; comparison ignores JSON property order. Temporary fixtures were removed. Physical iPhone/iPad Safari acceptance remains open.

Final local coverage: **1,588 tests in 134 files**. The full run passed 1,587 tests and exposed one new fixture assertion that omitted the ordinary crate's six-Wood placement cost. Only that fixture was corrected; its complete eight-test file then passed, reusing the unchanged passing suite results. Lint and the production build passed after the correction. The existing Vite large-chunk warning remains. No dependencies or hosting configuration changed.


## Sprints 16.58-16.62 validation

`homesteadExpansion.test.ts` covers atomic ore offerings and terrain invalidation, an iron-only paid store start, real ore delivery XP, shared furnace production/power loss, existing workshop funding, full-store cargo recovery, paid panel/crate improvements, connected Eco production, stock quotas, the 600-item mixed capacity, exact active iron/mixed forestry/improvement save continuation, strict malformed-state rejection and version-40 migration. `homesteadVisuals.test.tsx` also covers persistent improvements and carried ore without state mutation. Mode/toolbar tests expose both resources only in Petes Welt; the existing Factory and early homestead regressions remain active.

Windows Chromium checks used the actual menu/new-world/iron-tool/canvas placement flow and temporary same-scene fixtures with the actual simulation. Verified iron-only storage, paid furnace construction, 18 real iron plates and the existing workshop, paused exact save round trips, and the complete Eco line producing 72 panels/eight crates and all four product improvements. Phone portrait 390x640, landscape 844x390, tablet 1024x640 and desktop 1240x640 exercised inspection scrolling, resizing and resource-only controls. Synthetic pointer events used the existing gesture handler: first tap created zero ore and a preview; cancel created zero; repeated target created exactly nine ore and cleared the preview. A fixture-only pointer-capture shim enabled synthetic events. One initial fixture incorrectly reselected/toggled the tool between taps; it was corrected before successful acceptance. No app errors were recorded in the successful runs. Fixtures were removed. Physical iPhone/iPad Safari acceptance remains open; installation/offline 16.38 remains deferred.

Final local coverage: **1,598 tests in 135 files**. The full run passed 1,596 and found two older toolbar fixtures that still classified only the grove as Petes-Welt-only. Those two fixture mode selections were updated for iron; their complete ten-test run passed, reusing the unchanged full-suite successes. Lint and production build passed after that correction. The known Vite large-chunk warning remains. No dependencies or hosting settings changed.


CI follow-up: GitHub's slower runner completed 1,597 cases but exceeded the existing 60-second budget in the combined Eco progression case. That case is now three focused checks (panel improvements, connected machines, crate projects/save/backpressure), each using an independent deep copy of a genuinely simulated homestead. Staged preparation hooks (old projects, panel improvements, forestry, assembler and actual crates) each retain the former 60-second budget. Assertions, fixed-step simulation and production rules are retained; the global timeout/workflow is unchanged. This adds two cases (1,600 total). The complete expansion file, lint and production build are checked for the follow-up; unchanged full-suite successes are reused. No gameplay/browser artifact changed.


## Sprints 16.63–16.67 validation

`homesteadPaths.test.ts` covers bounded monotonic resource affinity, seeded mixed-family chances, affordable-only project selection, a complete iron-only route through workshop/veranda to the actual miner, paid route interruptions, power loss and finite-buffer backpressure, route corruption, genuine version-41 migration, copper-only bootstrap, original experiment/treasure completion, staged level gates, paid cable construction/cargo and exact save continuation, full-store retention and mixed wood/iron/copper progression. Preparation fixtures are independent snapshots of genuinely simulated stages with separate 60-second hook budgets. `homesteadVisuals.test.tsx` covers both ore colors and read-only carrying/work; resource toolbar/help tests retain Factory controls.

The initial full run passed 1,604 cases and found six failures in existing belt/bridge detour checks: importing the shared planner through NPC/world lifecycle modules exposed module-initialization-order-dependent NaN route costs. The planner now derives its unchanged cost constants at call time. All 67 focused route/new-path checks then passed, followed by a fresh full run: **1,612 tests in 136 files**, two workers and the documented 60-second runner allowance. Assertions and global configuration were not weakened.

Windows Chromium browser checks use the real menu/new-world/copper-tool/canvas placement flow and temporary same-scene review scenarios with the actual fixed-step simulation. Iron reaches an ore-funded store, furnace, workshop/veranda and connected miner; copper reaches its store/furnace/assembler and both original experiment/treasure projects (40 real plates/eight cables in the reviewed scenario). Paused iron and copper save/load comparisons preserve the complete authoritative JSON after canonical key ordering. Viewports cover 390×640 phone, 844×390 landscape, 1024×640 tablet and 1240×700 desktop; the phone inspector scrolls to requirements. PC storage hotkey/click/Escape/inspection and belt drag remain operational. Synthetic touch events use the existing canvas handler with a fixture-only pointer-capture shim: first tap places zero ore and shows a preview, cancel places zero, and repeated target confirmation places exactly nine copper tiles and clears the preview. These are browser/layout checks, not physical Safari acceptance.

Temporary fixtures are removed before delivery. Physical iPhone/iPad Safari acceptance remains open; installation/offline 16.38 remains deferred. The existing Vite large-bundle warning remains; no dependencies, hosting settings or PC controls change.

Final lint and production build passed after removing all review fixtures. The known Vite large-chunk warning remains. No app errors were recorded in the successful review scenarios.


## Post-16.67 daily-life/access maintenance

`homesteadDaily.test.ts` advances a real four-grove game for an additional simulation hour in six fixed-step preparation phases. It checks late repeated rest, egg collection/meals, feeding, repeated planting, a completed enclosure and exact save continuation. Other cases cover decision-only task starts, home-band planting versus unchanged Factory clearance, strict version-42 migration/deadline rejection, rejected trapping footprints and bounded recovery of an old idle machine pocket. Existing mixed/iron/copper and expansion regressions remain active. UI tests require long status only in Pete inspection and retain short HUD/messages.

Full suite: 1,617 passed and one obsolete HUD assertion failed (1,618 total, 137 files). The HUD test was updated to assert that its copied construction hint remains available but is absent from the HUD; all three tests in that file then passed. Unchanged full-suite successes are reused. Lint and TypeScript/production build passed; the existing Vite large-chunk warning remains.

Windows Chromium production-build checks exercised menu/save/new Petes Welt, pause, actual Pete click/inspection and closing it. The long status appeared only in inspection; the removed floating hint had zero DOM instances and no browser errors were recorded. A 390-pixel viewport also exercised closing inspection, but this was not touch-input or physical Safari acceptance. Physical iPhone/iPad checks remain open. Local socket restrictions required starting the preview with approved network access. The initial new-world confirmation was stopped by automatic review; saving the temporary test world first removed the data-loss concern and the world switch completed. No review fixtures or dependencies were added.
