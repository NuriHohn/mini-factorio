# Feature specification: [name]

Use this template for future feature requests; placeholders describe proposed work, not implemented features. Follow [AGENTS.md](../AGENTS.md) for the standing workflow and [Development](DEVELOPMENT.md) for checks/delivery. Do not repeat that boilerplate here.

## Goal and scope

- Player-visible outcome: [one or two sentences].
- Prerequisites: [implemented features or linked documentation].
- Branch: [requested name, or let the agent choose a dedicated branch].
- Out of scope: [explicit exclusions].

## Behavior

- [Player actions, placement/ports/rotation, rules, capacities, costs and exact simulation-time durations, as applicable].
- [State transitions, deterministic priorities/tie breaks and interactions with existing mechanics].
- [Toolbar/category/hotkeys, previews, animations and inspector feedback, if affected].

Reference existing rules in [Game design](GAME_DESIGN.md); describe only additions or deliberate changes.

## Edge cases

- [Blocked input/output, competing actions, invalid placement and map boundaries].
- [Power loss/recovery, removal/replacement, repeated commands and interrupted actions].
- [Compatibility with affected production, controls, NPCs and other existing systems].

## Persistence

- [New authoritative fields, timers, references and derived/cosmetic state to exclude; or why no schema change is needed].
- [Expected save/load behavior during active/blocked/interrupted states and compatibility with supported existing saves].
- Apply [the persistence extension policy](ARCHITECTURE.md#extending-persistence); identify any required version change or migration.

## Tests and acceptance criteria

- [ ] [Observable successful behavior with precise values/boundaries].
- [ ] [Failure/edge-case behavior and relevant existing-feature regressions].
- [ ] [Deterministic continuation, resource conservation and save/load scenarios where affected].
- [ ] [Browser-visible acceptance scenario if input/rendering changes].

List feature-specific unit/integration/browser cases here; standard verification and delivery come from the standing workflow. Record unresolved decisions or assumptions that materially affect these criteria.
