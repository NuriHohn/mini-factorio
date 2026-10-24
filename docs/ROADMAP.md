# Roadmap

Completed means implemented in the repository. Future entries are proposals, not available features or delivery commitments. Check [Game design](GAME_DESIGN.md) for current rules and [Architecture](ARCHITECTURE.md) for implemented systems.

## Completed milestones

| Milestone | Delivered |
| --- | --- |
| Sprint 16.14: Industrial Pete Level 1 — Gear Press | Once-only 4-Wood/12-plate/4-gear construction, completion XP, manually operated 2-plate-to-1-gear production with bounded logistics buffers, one-minute cooldown and version-28 continuation |
| Sprint 16.13: Inventor Pete Level 1 — Experiment Table | Autonomous copper-weighted table at 4 Wood/8 copper plates/2 iron gears and 12 seconds, once-only 10 Inventor XP, five-second experiments for 1 XP with a 60-second cooldown, protected approaches and version-27 persistence |
| Sprint 16.12.3: Progressive Industrial-Pete outfits | Existing dominant Industrial level selects cumulative work gloves, overalls/hard hat, reinforced workwear and legendary navy/gold magnate details; all four outfit paths complete, unchanged progression/saves |
| Sprint 16.12.2: Progressive Inventor-Pete outfits | Existing dominant Inventor level selects cumulative forehead goggles, copper tools, technical backpack/gears and legendary brass/cyan details; preserved Eco/Craftsman outfits and unchanged progression/saves |
| Sprint 16.12.1: Progressive Craftsman-Pete outfits | Existing dominant Craftsman level selects cumulative belt, apron/hammer, reinforced master apron/tools and legendary brass/masterwork details through Sprint 16.12's rendering passes; original level 1, preserved Eco outfits and unchanged progression/saves |
| Sprint 16.12: Progressive Eco-Pete outfits | Existing dominant Eco level selects cumulative scarf, straw hat/vest, leafy cape/flowers and legendary leaf crown/glow; immediate-mode pose-aligned accessories, original level 1/other personalities, unchanged progression and saves |
| Sprint 15.5: Waterwheel Generator | 10-Wood, 50-kW water-facing land generator through existing poles; anchored rotation, automatic dry-bank stop/restart, gentle fixed-step wheel animation, inspection and strict version-10 saves with version-1–9 compatibility |
| Sprint 15.6: Pete’s Fishing Dock | 8-Wood water-facing Nature dock, reachable peaceful visits and 20-second recreational fishing, quiet rod/line/ripples, safe demolition/water/approach recovery, existing inspection/rotation and strict version-11 continuation with version-1–10 compatibility |
| Sprint 15.6.3: Revenge-O-Matic Combat Tuning | 750-ms movement, stable productive-machine pursuit with five-second inactivity recovery, deterministic no-target wandering, 4/3-second EMP cooldowns with splash-area recovery protection, subtle target outline and compatible saved target timing |
| Sprint 15.7: Pete’s Rowboat | Occasional peaceful dock outings, bounded deterministic water routes and return, seated Pete/oars/ripples, safe dock/route/home interruptions, preserved fishing and strict version-12 mid-trip saves with version-1–11 compatibility |
| Sprint 15.7.1: Revenge-O-Matic Power Generator Targeting | Operational conventional generators and waterwheels as lower-priority pursuit/EMP targets, production-first spawn components, existing target stability and recovery protection, unchanged combat timings and saves |
| Sprint 15.8: Wooden Footbridges | Separate straight shore-to-shore 1–5-water-tile crossings at 3 Wood per deck, atomic drag previews, Pete/police navigation, protected landings and occupied-removal guard, whole-crossing demolition and strict version-13 saves with version-1–12 compatibility |
| Sprint 15.9: Shoreline Vegetation | Deterministic irregular reed/cattail clusters, gentle selected simulation-time sway, terrain/topology cache invalidation, viewport culling and clearance around structures/bridges; decorative only, unchanged version-13 saves |
| Sprint 16.0: Pete’s Supply Crate | 6-Wood receive-only 200-item supply inventory, shared belt/splitter/inserter capacity protection, direct material inspection, seeded peaceful visits with four-second clipboard checks, safe cancellation and strict version-14 saves with version-1–13 compatibility |
| Sprint 16.1: Pete’s First Secret Project | Once-per-world three-segment fence, atomic existing-Wood supply into crates, reachable collection/carrying and four-second staged hammering, connectivity-safe placement, interruption recovery and strict version-15 project/structure persistence with version-1–14 compatibility |
| Sprint 16.2: Pete’s Chicken Coop | One automatic decorative coop after fence completion, shared reachable pickup/carry/hammer workflow, exact 10-Wood cost and 12-second staged construction, safe placement/retry and strict version-16 continuation with version-1–15 compatibility |
| Sprint 16.3: Chickens & Eggs | Three decorative coop chickens, bounded dry-ground wandering/pecking/return, capped visible eggs and peaceful collection/counter, two once-only yellow chicks after 150 seconds, independent fixed-step RNG and strict version-17 continuation with version-1–16 compatibility |
| Sprint 16.4: Pete’s Campfire & Fried Eggs | Once-per-world five-Wood campfire after the coop, shared six-second staged construction, peaceful seated frying/eating with exact completion-only egg use and happy reaction, gentle idle flame/smoke and strict version-18 continuation with version-1–17 compatibility |
| Sprint 16.5: Pete’s Enclosed Yard | Reuse-first bounded enclosure around house/coop, two-Wood/four-second missing sections through shared construction, protected open entrance and preserved NPC access, complete-only adult/chick containment with breach fallback, and strict version-19 continuation with version-1–18 compatibility |
| Sprint 16.6: Pete’s Garden Gate | Once-per-world three-Wood/four-second gate at the reserved yard entrance, shared autonomous construction, stable Pete routes with 250-ms opening/closing and 600-ms clearance hold, continuous flock containment, safe interruptions/removal and strict version-20 continuation with version-1–19 compatibility |
| Sprint 16.7: Pete’s Personality & XP Foundation | Four independent five-level paths, completion-only Eco project XP and repeatable egg XP, bounded recent-activity influence with hysteresis, read-only treehouse overview and strict version-21 persistence with once-only completed-project migration from versions 1–20 |
| Sprint 16.8: Pete’s Autonomous Project Selection | Data-driven Eco-level-one project registry, reachable material-set weights using the existing peaceful RNG, stable selected/suspended plans with safe recovery, coop/campfire choice after the fence, unchanged construction/XP and strict version-22 continuation with version-1–21 compatibility |
| Sprint 16.9: Eco Pete Level 2 — Gardening & Reforestation | Weighted Eco-2 garden at 12 Wood/12 seconds with once-only 20 XP, quiet tending, repeatable 2-Wood/5-second oak planting with 5 XP and 120-second cooldown, bounded forest-edge/density/navigation checks, existing tree growth and strict version-23 continuation with version-1–22 compatibility |
| Sprint 16.10: Craftsman Pete Level 1 — The Workshop | Autonomous iron-weighted workshop at 4 Wood/8 iron plates and 12 seconds, once-only 10 Craftsman XP, decorative anvil/tool rack and 5-second hammering visits earning 1 XP with a 60-second cooldown, protected yard access and strict version-24 continuation with version-1–23 compatibility |
| Sprint 16.11: Craftsman Pete Level 2 — Treehouse Veranda | Iron-weighted attached upgrade at 8 Wood/12 iron plates and 12 seconds, once-only 25 Craftsman XP, staged deck/rails/metal supports, occasional veranda rests without footprint changes and strict version-25 continuation with version-1–24 compatibility |
| Sprint 16.11.1: Pete Construction Placement & Activity Priorities | Coop/campfire site search in rings 2–6 with safe unpaid-plan recovery, protected work approaches, bounded five-second construction priority, direct activity chains and occasional rest, 15–25-minute gifts, quiet no-site HUD feedback and version-26 compatibility with versions 1–25 |
| Initial mining and movement | Ore deposits, directional mining, WASD camera and zoom |
| Conveyor belts and storage | Individual items, directional transport, automatic curves, typed chest counts, occupied-building removal |
| Furnaces and smelting | Crafting jobs, iron plates, buffers, output reservations and inspection |
| Electricity networks and pole preview | Generators, connected poles, coverage, proportional working-demand allocation, dashed placement connections |
| Copper and multi-resource production | Copper mining/smelting, generic inventories, item metadata and per-item statistics |
| Automatic furnace recipes | Default Auto detection, iron/copper Manual locks and safe changes |
| Assemblers and multi-stage production | Shared crafting core, gears, two-output cable batches, multi-input circuits, 60 kW assemblers |
| Automatic assembler recipes | Default Auto, circuit priority, initial waiting policy, independent ingredient capacities and permanent recipe locking |
| Sprint 6.5: persistent project context | Concise contributor rules and linked architecture, game design, roadmap and development documentation; no gameplay change |
| Sprint 7: basic inserters | Powered one-item arms, chest extraction, direct machine bridges, held-item safety, previews and inspection |
| Post-Sprint-7 hotfix | Unified tool toggles/inspection mode and one-time furnace/assembler recipe locking |
| Sprint 7.5: Pete | Deterministic immortal goblin, timed pumpkin sabotage, mush/slime feedback and click-to-scare corner crying |
| Sprint 7.6: police and prison | Powered radar traps, single obstacle-aware police dispatch, visible arrest/transport, prison inspector/manual release, timed jailbreak and re-arrest grace |
| Sprint 15.0: Water & Bridges | Seeded ponds/stream/river with protected dry starting land, shoreline/living-water graphics, water-aware building/nature/NPC rules, automatic straight 1–5-cell conveyor bridges at 3 Wood/new segment, atomic cost-aware routing/reuse/reversal/whole-crossing demolition and strict version-9 saves with dry version-1–8 migration |
| Sprint 15.1: Performance Profiling & Optimization | Measured Canvas/React bottlenecks; persisted Standard 60 / Energy Saving 30 FPS ceilings independent of fixed simulation ticks, static terrain texture, viewport/effect culling, bounded summary updates, hidden-tab guard, optional diagnostics and reproducible profiling harness |
| Sprint 15.2: Water Landscaping & Shoreline Polish | Free shared 1×1/3×3/5×5 water/land brushes with connected drag strokes and protected structures/NPC paths/bridge banks, rounded eight-neighbor shorelines, locally invalidated terrain chunks, lightweight water effects and unchanged strict version-9 saves |
| Sprint 14.9: Belt Connection Polish & Smart Overwrite | In-place same-axis reuse/reversal with packet preservation, protected perpendicular lines, direction-aware conservative detours and unique rear endpoint joins, new/reused/reversed previews and atomic free construction; existing power routing and version-8 saves preserved |
| Sprint 14.8: Smart Power Routing | Bounded deterministic minimum-new-pole electrical routing, forest/factory site detours without line of sight, existing infrastructure reuse and network joins, explicit adjacent endpoint snapping, blue reuse rings and new/existing counts, atomic free construction and preserved coverage/simulation/version-8 saves |
| Sprint 14.7: Smart Conveyor Belt Routing | Preferred direct belt drags with bounded deterministic A* obstacle detours, shortest/few-turn cardinal routes, turquoise detour previews and accurate free tile counts, atomic live revalidation, cached planning, graceful search failures and unchanged transport/version-8 saves; pole routing unchanged |
| Sprint 14.6: Building UX & Controls | Atomic belt L-route and minimum-new-pole straight-corridor drag previews/commit, reused poles, accurate free/Wood funding feedback, one-layer Escape and safe right-click/focus/menu cancellation, three-use session hints/Help, and concise authoritative building diagnostics with retained details/settings; version-8 saves unchanged |
| Sprint 14.5: UI Cleanup & Navigation | Compact five-group bottom toolbar, Wood HUD, closed-by-default management/help/overview, clearer manual technology states/funding, guarded menu input, safe confirmed restart, calmer Pete captions/notifications and responsive desktop navigation; gameplay and version-8 saves preserved |
| Sprint 14: Pete’s Treehouse & Peace | One 20-Wood home, immediate safe peace/custody cleanup, harmless boss shutdown preserving Revenge progression, deterministic walks/climbing/rest/gestures and bounded gifts, demolition/rebuild, compact UI and strict version-8 saves with version-1–7 compatibility |
| Sprint 13: Nature & Forestry | Integrated Oak/Pine/Birch occupancy, age-based growth, scheduled seeded forest spread/factory buffer/cap, Axe/global Wood/stumps, continuous landscape brushes, procedural groves/meadows and strict version-7 nature saves with empty version-1–6 migration |
| Sprint 12.2: animation polish and visual design guidelines | Phased 3.4-second arrests with legacy pickup continuation, gentle police/prison/boss/tool/furnace/UI effects, EMP charge telegraph, animation audit and design guidelines; pause/save/load and immediate-release regressions |
| Sprint 12.1: escalating arrest presentation | Cycle-based unrestrained/cuffs/rope overlays, comic captions, rendered pickup hold/car wobble, visible green passenger and optional version-6 mid-effect continuation; gameplay timings unchanged |
| Sprint 12: Pete’s Revenge | Escalating completed-arrest boss events, EMPs/one-time stomp, research-gated mouse combat/shared cooldown, police/sprinkler support, procedural breakdown/ejection/stun, and version-6 deterministic encounter persistence with legacy upgrades |
| Sprint 11: research and technology | Productive-time integer RP, permanent prerequisite purchases, authoritative placement/dashboard gates, Technology dialog, and exact version-5 saves with all-technology legacy upgrades |
| Sprint 10: production analytics | Actual rolling item rates and minute history, configured utilization, prioritized clickable bottlenecks, explicit assembler recipes, unambiguous furnace probes and version-4 analytics persistence |
| Pete 2.0 | Player-facing rename, faster walking, two-second sabotage cooldown, inserter/generator sabotage, explicit Spider Web tool, timed ground traps and version-3 saves with version-1/2 upgrades |
| Sprint 9.5: Anti-Goblin Sprinkler | Powered Pete tool G, deterministic spray/slip/complaint/water escape, police/grace priority, cosmetic puddles, version-2 snapshots and version-1 loading |
| Sprint 9: offline saves and build categories | Strict version-1 JSON, manual/autosave browser slots, confirmed load/import, portable export, deterministic continuation, Factory/Pete toolbar tabs |
| Sprint 8: compact 1×1 splitters | Rotatable rear-input/front-and-left routing, independent outgoing buffers, round robin, congestion fallback, curves and shared inserter/transport integration |

“Persistent project context” means versioned repository documentation, not persistent game saves or automatic agent memory. The standing reading/workflow policy is in [AGENTS.md](../AGENTS.md); use the [feature template](FEATURE_SPEC_TEMPLATE.md) for a future proposal.

## Proposed next milestones

| Proposal | Intended scope / prerequisite |
| --- | --- |
| Pete: higher-level evolution | Separately scoped Eco/Craftsman projects, animal keeping/orchard/horse/forestry, bicycle/glider/teleporters and minifactory/steam car; later active dominance bonuses and permanent mastery unlocks, all planned only |
| Water & Industry (future scope, unassigned sprint) | Future extension: separately scoped water-related industry; no pumps, fluids or new water-powered machines are implemented in Sprint 15.0 |
| Pete’s Cozy Home (future scope, unassigned sprint) | Future gates, treehouse decorations and further fence layouts beyond the single automatic Sprint 16.1 project; these extensions are not implemented |
| Improved logistics | Build on basic inserters with separately approved filtering, priorities, stack/reach variants or throughput improvements |
| Advanced routing | Future filtering, configurable output priorities and more complex junctions beyond the implemented compact splitter |
| Blueprints | Capture layouts, preview placement and validate collisions/resources before player confirmation |
| Production optimization | Build on the implemented observational dashboard with separately approved optimization and deterministic planner inputs |
| Fully offline Generative Factory Architect | Build progressively on progression, blueprint preview, analytics and machine-readable planning data |

Choose and approve each sprint's scope separately. Further recipes, fuel, solar and accumulators are also candidates; they are not implicitly authorized by this roadmap. Scope control follows [AGENTS.md](../AGENTS.md#mandatory-agent-workflow).

## Long-term Factory Architect vision — planned only

A fully free, offline assistant should gradually unlock through gameplay. Players express natural-language factory goals; deterministic production planning and optimization produce explainable layouts, rates and constraints. A blueprint preview lets the player inspect and confirm placement before anything changes.

No mandatory cloud API, paid service or local LLM is part of this goal. Natural-language support must have an offline path without requiring a model; optional local AI could enhance interpretation later. The current repository has no natural-language interpreter, optimizer, blueprint placer or AI integration.

Preserve pure simulation, stable item/recipe IDs, quantity-based recipes and machine metadata for speed, power, ports and capacity. These are implemented foundations, not evidence that the Architect already exists. Each planning/optimization stage should have deterministic tests before being exposed to players.

## Sprint 16.15 — Exclusive Pete material families (completed)

All current materials have one development path; new technical projects consume only their own family. Paid legacy work, completed structures and XP are preserved through version-29 saves.

## Sprint 16.15.1 — Industrial recycling (completed)

The press consumes its own family (one gear), recovers one plate, respects bounded logistics and retains legacy inventory without creating free resources.

## Sprint 16.16 — Click Pete for status (completed)

Current activity/project, a nonbinding next wish and concrete project requirements are inspectable without changing autonomous decisions.

## Sprint 16.17 — Nearby reforestation (completed)

New planting stays 4–6 tiles from home and prefers shortest reachable walks before forest edges. Paid legacy work remains intact.

## Sprint 16.17.1 — Repeatable garden care (completed)

After the garden, Eco Pete can repeatedly mulch using 2 supplied Wood for 4 Eco XP after four seconds of work, with a 60-second cooldown and exact saved continuation.

The follow-up priorities, expanded yard planning, chicken bedtime/feeding and mature-tree harvesting are completed in Sprints 16.18–16.20 below.

## Sprint 16.18 — Project priorities and yard planning (completed)

Bounded cost/XP priorities favour substantial projects while retaining small-project chances. Radius-six property layouts fit a bounded expanded yard; the inspector explains starter rails, prerequisites and progress. Paid work remains preserved.

## Sprint 16.19 — Chicken bedtime (completed)

Chickens and chicks return to the coop when Pete enters/sleeps, stay inside during his rest and resume afterward, with visible/inspectable bedtime and exact saved continuation.

## Sprint 16.19.1 — Chicken feeding (completed)

Garden care grows bounded Eco-only feed. Pete physically carries a portion from garden to coop, earns completion-only XP and waits three minutes before feeding again. Source, carrying, work and progress persist.

## Sprint 16.20 — Mature-tree forestry (completed)

Eco Pete selects nearby fully grown trees, chops them, physically returns three Wood to a supply crate and earns XP only on delivery. Interrupted work/carrying and full-crate recovery persist; returned Wood supports normal reforestation and the other Eco projects.


## Sprints 16.20.1–16.23 — Yard recovery, fences and chicken life (completed)

- **16.20.1:** expanded entrance/layout choices, safe per-section validation, reordered unfinished sections with saved partial hammer work, preserved paid/hammer progress and explicit obstruction position. The immediate section stays out of pickup routes; access to structures is protected.
- **16.20.2:** fence posts remain upright in both ground directions instead of rotating into a railway-like silhouette; corners and openings retain their joins.
- **16.21:** a separate Eco-only paid outdoor run reuses suitable rails, contains the flock when intact and retains bedtime/egg behaviour. People can step over its new low rails. Coop inspection shows progress.
- **16.22:** occasional physical coop-cover visits before rest and removal after waking, with saved decisions/travel/work and harmless decorative protection.
- **16.23:** Pause/×1/×2/×4 controls accelerate the entire fixed-step simulation while keeping camera/input and graphics frame-rate preferences independent.

## Sprints 16.24–16.28 — Collecting, flight and mobile access

- **16.24 completed:** harmless manual powered sprinkler targeting and cosmetic wet reactions.
- **16.25 completed:** Inventor level-2 treasure chest, five decorative keepsakes, nearby physical pickup/carry/deposit and inspectable collection.
- **16.26 completed:** Inventor level-4 flight workshop/backpack, practice XP and early harmless crash landings.
- **16.27 completed:** Inventor level-5 scenic flights; no cargo, search or production advantages.
- **16.28 browser controls and public hosting completed:** additive pan/pinch/tap controls, explicit touch build confirmation, narrow-screen panels/toolbar, relative-path production bundle and validated build/deploy workflow. The repository is public and [GitHub Pages serves the playable game](https://nurihohn.github.io/mini-factorio/). Portable saves use existing export/import, without automatic sync.

Mobile follow-up targets **iPhone and iPad first**, with an installable offline experience and local saves; the distribution/install method and real-device Safari acceptance remain to be specified. PC controls must remain intact.

Authoritative mechanics and costs: [Game design](GAME_DESIGN.md#treasures-and-flight). Hosting setup: [Development](DEVELOPMENT.md#portable-browser-build-and-hosting). Further mobile ergonomics and real-device acceptance remain follow-ups; PC controls must remain intact.


The original mobile planning in [PR #75](https://github.com/NuriHohn/mini-factorio/pull/75) is fulfilled by the browser controls and hosted access above. Its additive-PC-control requirement remains in force; real iPhone/iPad acceptance and installable offline play remain follow-ups.

The yard-recovery and Pete ideas originally recorded in [PR #80](https://github.com/NuriHohn/mini-factorio/pull/80) are implemented in Sprints 16.20.1–16.27 above. Flight uses the agreed Inventor level-4 practices and level-5 scenic loops; coop cover remains harmless decoration, with no marten attacks. All new project inputs continue to obey the [exclusive material families](GAME_DESIGN.md).


## Sprints 16.28.1–16.37 — Touch polish and higher developments

| Sprint | Implemented scope |
| --- | --- |
| 16.28.1 | Collapsed floating touch tools, same-target tap confirmation, compact phone header/world, contextual rotate/cancel and bottom-sheet inspection; PC controls retained |
| 16.29 | Faster completion-only workshop/experiment/recycling progression and unlocked-first wishes with actual requirements |
| 16.30 | Eco-3 paid orchard construction, visible trees and tending |
| 16.31 | Physical fruit pickup/carry/storage and campfire cooking with bounded Eco stock |
| 16.32 | Craftsman-3 bicycle, mounting, physical safe round trips and parking |
| 16.33 | Carrying priority, bounded activity scheduling, saved work/ride interruptions and touch/desktop regression review |
| 16.34 | Industrial-2 gear-paid mechanic workshop and staged construction |
| 16.35 | Gear-to-module production, bounded factory transport and paid decorative hoist |
| 16.36 | Eco-4 paid nursery seedlings, nearby planting and compatibility with mature-tree forestry |
| 16.37 | Craftsman-4 staged treehouse annex and resting visits |

Costs, durations and rewards are owned by [Game design](GAME_DESIGN.md#higher-pete-developments). **16.38 remains proposed:** installable, reliably offline iPhone/iPad play; no service worker, native packaging or automatic save synchronization is included here. Physical iPhone/iPad acceptance remains necessary beyond automated browser input/layout checks.

## Sprints 16.39–16.42 — Comfort, explanations and daily life

Sprint **16.38 is deferred at the user’s request**: installation/offline support for iPhone/iPad remains a future proposal, outside this delivery.

| Sprint | Implemented scope |
| --- | --- |
| 16.39 | Touch safe-area spacing, larger controls/category targets, visible selected tool, edge-bounded rotate/cancel and inspection controls without overlapping floating tools |
| 16.40 | Read-only carried stock, work progress and per-development supplies, cooldowns, missing material, access and demolition explanations in Pete’s inspection |
| 16.41 | Oldest-ready new activities, overdue opportunities between unpaid project choices, nearby nursery supply pickup, existing-seedling priority and full-pantry recovery |
| 16.42 | Foundation/frame/finish construction stages, elevated plank-and-rail annex walkway, parked bicycle consistency and task-specific work/progress effects |

Browser viewport/input checks cover phone portrait/landscape, tablet and PC; **physical iPhone/iPad Safari acceptance remains open**, so the real-device portion of 16.39 is not claimed complete. Existing saves, costs, XP rewards and PC construction remain compatible. Rules are owned by [Game design](GAME_DESIGN.md#daily-development-comfort).

## Sprints 16.43–16.47 — Watching and understanding

| Sprint | Implemented scope |
| --- | --- |
| 16.43 | Actual Pete route/next-stop overlay and active project material purpose, with hide control |
| 16.44 | Supply Crate requirements/shortages and explicit existing-stock handoff from Wood stock/nearby storage, with capacity and family checks |
| 16.45 | Read-only visual process cards for fruit, paid seedlings and mechanic modules, with active task and stock |
| 16.46 | Concrete machine/transport explanations and optional input/output/power connection highlights |
| 16.47 | Voluntary Help goals, real saved production/project progress and dismissible world pin; no time pressure or rewards |

Mechanics and limits are owned by [Game design](GAME_DESIGN.md#learning-and-orientation-aids). Installation/offline Sprint 16.38 remains deferred; physical iPhone/iPad acceptance is still open.

## Future proposal — Two play directions

The user’s later-version idea separates **Petes Welt** (working label “FSK0”: minimal factory systems, simple resource placement, watching Pete autonomously grow a miniature factory and learning by observation) from **Factory** (working label “FSK12”: no Pete, richer production/logistics/energy planning). Shared resource pictures and process explanations can bridge learning between the two. At Sprint 16.47 these were proposed directions only. Sprints 16.48–16.52 below implement the first separate Eco prototype; the full four-path split, Pete-free Factory edition and complexity conversion remain proposals. Scope, age-oriented content and progression still need design before implementation.


## Sprints 16.48–16.52 — Shared Eco chain and first Petes Welt prototype

| Sprint | Implemented scope |
| --- | --- |
| 16.48 | Powered directional Forststation, mature-only bounded harvesting and physical Wood output through existing logistics |
| 16.49 | Shared powered Sägewerk, wood panels and the existing Assembler’s wooden-crate recipe |
| 16.50 | Paid replacement saplings on harvested plots, existing nearby nursery seedling integration, ordinary growth and obstruction/backpressure handling |
| 16.51 | Separate Petes Welt game/save slots, atomic nearby grove placement, resource-only tools and touch confirmation |
| 16.52 | One bounded autonomous eleven-step Eco factory, physical Pete walks/build work, real shared production, status/inspection and exact saved continuation |

Authoritative scope and limits: [shared Eco production and Petes Welt](GAME_DESIGN.md#shared-eco-production-and-petes-welt). This is the first playable Eco prototype. More autonomous paths, expanding/rebuilding factories, wooden-product projects and long-term child interaction remain future work. The original Factory game keeps its existing Pete behaviour; a Pete-free complex edition is not part of this increment. Sprint 16.38 stays deferred; physical iPhone/iPad Safari acceptance remains open.


## Sprints 16.53–16.57 — Pete’s daily life before automation

| Sprint | Implemented scope |
| --- | --- |
| 16.53 | Restored original projects/day-life in Petes Welt; no immediate new factory at level 1; paid old prototype builds and stock preserved |
| 16.54 | Level-1 mature-tree chopping and physical Wood delivery, nearby reachable selection and no free/global stock |
| 16.55 | Pete-built general material store, existing-project withdrawals, all-item transport, visible material types/filling stages and exact inspection |
| 16.56 | Mode-specific stock reserves and deferred unpaid fence extensions, original feeding/sleep/garden/leisure between tasks and clear status |
| 16.57 | Eco-3 hand-fed shared sawmill, paid power/build work, physical panel returns and an eight-panel roof/capacity upgrade of the same store |

Rules and compatibility: [Petes Welt progression](GAME_DESIGN.md#petes-welt-daily-life-supplies-and-gradual-processing). New higher-level automatic forestry/conveyors/assemblers and the other resource-placement paths are future work. Existing Factory mechanics and old prototype factories remain available. Sprint 16.38 stays deferred; physical iPhone/iPad acceptance remains open.


## Sprints 16.58-16.62 - Products with purpose and the iron path

| Sprint | Implemented scope |
| --- | --- |
| 16.58 | Paid six-panel coop awning/garden bench, visible work and once-only rewards; early Wood projects retained |
| 16.59 | Eco-4 shared forestry station and short sawmill belt, paid starter replant Wood, ordinary growth and safe mature-tree clearing |
| 16.60 | Shared crate assembler/belt/power, four-crate 600-capacity shelves and three-crate garden planters, bounded stock/backpressure |
| 16.61 | Atomic nearby iron offering, level-1 physical ore mining/delivery and viable iron-only general-store start |
| 16.62 | Craftsman-2 shared powered furnace, physical ore/plate carrying and existing workshop/plate project integration |

Costs, rules and compatibility: [Product projects and iron](GAME_DESIGN.md#product-projects-and-the-iron-path-sprints-1658-1662). Copper offerings and automatic iron miners follow below. Industrial offerings, further expansion and the Pete-free Factory edition remain proposals. Installation/offline Sprint 16.38 stays deferred; physical iPhone/iPad Safari acceptance remains open. PC controls are retained.


## Sprints 16.63–16.67 — Resource-led Craftsman and Inventor progression

| Sprint | Implemented scope |
| --- | --- |
| 16.63 | Craftsman-3 paid shared iron miner, bounded obstacle-aware belt to the existing furnace, own power, retained paid progress and ordinary buffer backpressure |
| 16.64 | Diminishing resource-family influence from nearby offers and store stock on new tasks and affordable project choices; seeded mixed-path scheduling, committed work and daily-life opportunities retained |
| 16.65 | Atomic nearby copper offering and level-1 personal mining/delivery, Inventor XP and copper-only bootstrap into the same general store |
| 16.66 | Inventor-2 paid shared copper furnace/power, actual ore/plate carrying and bounded stock with a viable route to the next level |
| 16.67 | Inventor-3 plate-paid shared cable assembler, physical plate/cable logistics, original experiment/treasure projects and level/material/access explanations |

Authoritative rules: [Resource-led paths](GAME_DESIGN.md#resource-led-craftsman-and-inventor-paths-sprints-1663-1667). These increments do not supply circuits or build an automatic copper miner; those, Industrial resource offerings and later expansion remain proposals. Original level-4 flight preparation and level-5 scenic flights keep their existing requirements. Installation/offline 16.38 remains deferred; physical iPhone/iPad Safari acceptance remains open. PC controls are retained.
