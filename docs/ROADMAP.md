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
| Sprint 7.5: Pumpkin Pete | Deterministic immortal goblin, timed pumpkin sabotage, mush/slime feedback and click-to-scare corner crying |
| Sprint 7.6: police and prison | Powered radar traps, single obstacle-aware police dispatch, visible arrest/transport, prison inspector/manual release, timed jailbreak and re-arrest grace |

“Persistent project context” means versioned repository documentation, not persistent game saves or automatic agent memory. Future tasks must read the relevant files.

## Proposed next milestones

| Proposal | Intended scope / prerequisite |
| --- | --- |
| Improved logistics | Build on basic inserters with separately approved filtering, priorities, stack/reach variants or throughput improvements |
| Splitters and routing | Controlled branching, merging and resource routing while preserving conservation and deterministic arbitration |
| Save/load | Versioned world serialization, safe restoration of jobs, waits and topology; decide migration behavior |
| Research and technology progression | Gradually unlock recipes, machines and assistance; introduce progression as a separate design change |
| Blueprints | Capture layouts, preview placement and validate collisions/resources before player confirmation |
| Production analytics and optimization | Distinguish nominal/actual rates, bottlenecks, power constraints and material flow; supply deterministic planner inputs |
| Fully offline Generative Factory Architect | Build progressively on progression, blueprint preview, analytics and machine-readable planning data |

Choose and approve each sprint's scope separately. Further recipes, fuel, solar and accumulators are also candidates; they are not implicitly authorized by this roadmap. Avoid scaffolding these systems during unrelated work.

## Long-term Factory Architect vision — planned only

A fully free, offline assistant should gradually unlock through gameplay. Players express natural-language factory goals; deterministic production planning and optimization produce explainable layouts, rates and constraints. A blueprint preview lets the player inspect and confirm placement before anything changes.

No mandatory cloud API, paid service or local LLM is part of this goal. Natural-language support must have an offline path without requiring a model; optional local AI could enhance interpretation later. The current repository has no natural-language interpreter, optimizer, blueprint placer or AI integration.

Preserve pure simulation, stable item/recipe IDs, quantity-based recipes and machine metadata for speed, power, ports and capacity. These are implemented foundations, not evidence that the Architect already exists. Each planning/optimization stage should have deterministic tests before being exposed to players.
