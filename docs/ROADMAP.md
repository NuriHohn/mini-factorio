# Roadmap

Completed means implemented in the repository. Future entries are proposals, not available features or delivery commitments. Check [Game design](GAME_DESIGN.md) for current rules and [Architecture](ARCHITECTURE.md) for implemented systems.

## Completed milestones

| Milestone | Delivered |
| --- | --- |
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
