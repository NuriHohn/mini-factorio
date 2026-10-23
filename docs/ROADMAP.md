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

Next proposed work: larger-project priorities and yard recovery, followed by chicken bedtime/feeding and mature-tree harvesting. These are not implemented by Sprints 16.15–16.17.1.

## Sprint 16.18 — Project priorities and yard planning (completed)

Bounded cost/XP priorities favour substantial projects while retaining small-project chances. Radius-six property layouts fit a bounded expanded yard; the inspector explains starter rails, prerequisites and progress. Paid work remains preserved.

## Sprint 16.19 — Chicken bedtime (completed)

Chickens and chicks return to the coop when Pete enters/sleeps, stay inside during his rest and resume afterward, with visible/inspectable bedtime and exact saved continuation.

## Sprint 16.19.1 — Chicken feeding (completed)

Garden care grows bounded Eco-only feed. Pete physically carries a portion from garden to coop, earns completion-only XP and waits three minutes before feeding again. Source, carrying, work and progress persist.
