# Mini-Factorio contributor instructions

Build small, playable increments within the requested scope. These standing instructions apply to future sprint prompts without being repeated in each feature specification.

## Mandatory agent workflow

1. **Read before implementing any feature.** Read [README.md](README.md), the relevant project documentation below, and the affected source/tests before proposing or implementing changes. Architecture, current gameplay and development guidance must be consulted for feature work; check the roadmap to distinguish implemented prerequisites from proposals. Source code is the authority for current behavior: report or correct discrepancies within scope.
2. **Prepare an isolated branch.** Inspect Git status and preserve user changes. Start new work from freshly fetched `origin/main` on a dedicated feature or documentation branch, using the requested name when supplied. Follow an explicit request to continue an existing branch. Never implement directly on `main`. Verify prerequisite features on the fetched base; report missing prerequisites instead of assuming they exist.
3. **Preserve existing features.** Unless explicitly changed by the specification, preserve the implemented behavior and invariants in [Game design](docs/GAME_DESIGN.md) and [Architecture](docs/ARCHITECTURE.md), including production, transport, power, tools/inspection, NPCs and Save & Load compatibility. Reuse existing systems and registries. Do not scaffold roadmap features, add dependencies without a task need, or introduce unrelated refactoring, upgrades or formatting sweeps.
4. **Verify the change.** Add meaningful regressions for changed behavior and complete the applicable [Development checks](docs/DEVELOPMENT.md#commands-and-checks), including browser verification when available for input/rendering changes. Fix introduced failures. Report checks actually run, unrun checks, warnings and limitations accurately; documentation-only validation is defined there.
5. **Update the owning documentation.** Keep the documents below synchronized with the implementation. Maintain one authoritative explanation per rule and link to it elsewhere. Preserve existing information, distinguish proposals from completed work, and do not mark unimplemented features as available.
6. **Deliver for review.** Review the diff, stage only intended changes, commit with a descriptive message and push the completed branch. Follow the [delivery commands](docs/DEVELOPMENT.md#branch-commit-and-pull-request), verify the remote hash and provide the GitHub compare URL plus a concise summary and validation results. **Never automatically merge into `main`.** On fetch/push failure, report the exact error; do not force push, reset commits or change credentials as a workaround. Git push access does not establish pull-request API permission.

## Documentation ownership

| Document | Authoritative content |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Module ownership, deterministic simulation, authoritative state, React/Zustand/Phaser boundaries, transport/resource invariants and persistence compatibility |
| [Game design](docs/GAME_DESIGN.md) | Implemented mechanics, values, controls, recipes, machine/NPC policies and player-visible invariants |
| [Development](docs/DEVELOPMENT.md) | Setup, code validation commands, test strategy/coverage, browser checks and operational delivery steps |
| [Roadmap](docs/ROADMAP.md) | Completed milestones and separately proposed future work |
| [Feature specification template](docs/FEATURE_SPEC_TEMPLATE.md) | Feature-specific requirements and acceptance criteria; use for shorter future sprint prompts |

AGENTS owns mandatory agent policy; the linked documents own its technical details. README remains the project entry point.

## Implementation style

Use the versions/scripts in `package.json` and npm's lockfile. Follow existing TypeScript/TSX style: two spaces, single quotes, no statement-ending semicolons, ES modules and type-only imports where appropriate. Use PascalCase components/classes, camelCase functions/variables and uppercase shared constants. Avoid `any` and unnecessary assertions; respect unused-symbol, fallthrough and React Hooks checks.

Prefer small direct functions and existing structures. Do not introduce an ECS, event bus, generic framework or extra state layer without a concrete need. Continue procedural graphics and preserve React Strict Mode cleanup, observers and scene lifecycle handling as described in Architecture.
