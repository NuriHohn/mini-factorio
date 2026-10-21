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

Before delivery, run the full test suite, TypeScript checks, lint and production build. Fix introduced failures and identify any remaining failures or unavailable checks. Do not weaken tests, skip regressions or bypass electricity to make a change pass.

For a focused run, use `npm test -- src/simulation/manualAssemblers.test.ts` or `npm test -- src/game/cameraMovement.test.ts`. Simulation tests must remain independent of Phaser, React and the DOM. Use explicit power infrastructure; [`testFixtures.ts`](../src/simulation/testFixtures.ts) supplies a full-power world. Test timing changes with equivalent elapsed-time partitions, not only a single frame sequence. Test changed transfer/capacity rules with rejection, contention, backpressure and outages; use the [material-accounting invariants](ARCHITECTURE.md#invariants-and-extension-points).

For persistence changes, verify strict validation and detached failure handling, round trips, resource accounting, and continuous N-step simulation versus K steps/save/load/N−K steps. Include fractional remainder, active jobs/reservations, transport buffers, NPC phases and timers, and supported old-version upgrades where affected. Compare authoritative state with a fixed metadata timestamp; JSON key order and derived caches are not gameplay state. Failed load/import must leave the live world and browser slots intact. Schema policy belongs in [Extending persistence](ARCHITECTURE.md#extending-persistence).

Documentation-only changes need no new gameplay tests or browser run. In addition to the standard checks above, check Markdown links/anchors, verify source claims and command/file names, review `git diff --check`, and confirm only intended documentation files changed.

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

For input/rendering changes, verify affected flows in an available browser and identify whether checks were manual or automated. Unit tests alone do not establish browser behavior. Use the gameplay sections linked below for expected values and mechanics rather than copying their rules into test instructions.

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
