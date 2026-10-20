# Mini-Factorio contributor instructions

Build small, playable increments. Preserve existing gameplay and keep changes within the requested sprint.

## Read before changing

Read [README.md](README.md), then the documents relevant to the task:

- [Architecture](docs/ARCHITECTURE.md): module ownership, simulation ordering, state and invariants.
- [Game design](docs/GAME_DESIGN.md): implemented rules, recipes, capacities and Auto/Manual behavior.
- [Development](docs/DEVELOPMENT.md): setup, validation, regression coverage and review workflow.
- [Roadmap](docs/ROADMAP.md): completed work and proposed future milestones.

Actual source code is the source of truth for implemented behavior. Verify documentation against it; report or correct discrepancies within the task's scope. Planned features are not implemented features.

## Mandatory engineering rules

- Preserve deterministic fixed-step simulation, stable transfer priorities, item conservation and power-scaled progress. Test equivalent time partitions when changing timing.
- Keep gameplay logic in pure TypeScript under `src/simulation`, rendering/input in Phaser, and interface presentation in React. Zustand carries commands and copied summaries; the scene's world remains authoritative. Never expose mutable inventories to React.
- Reuse item/recipe/machine registries, shared crafting, transport, power and inspection systems. Preserve existing IDs. Keep furnace and assembler Auto selection policies separate from shared processing.
- Validate placement, capacity and recipe/mode changes in the simulation. Reserve input capacity before simultaneous transfers; account for held inserter items, committed ingredients and reserved products without double counting. Preserve inserter step-start source budgets and destination occupancy so new arrivals never transfer twice in one step.
- Use supported placement/removal operations to invalidate power topology. Do not bypass electricity to make tests pass. Preserve job progress and reservations during outages.
- Add meaningful regression tests for changed behavior. Keep simulation tests independent of Phaser, React and the DOM. For input/rendering changes, also check browser behavior when available, including camera movement, diagonals, zoom and resizing.
- Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. Fix introduced failures; distinguish checks actually run from checks not run. Documentation-only changes need no new gameplay tests.
- Keep relevant documentation synchronized with gameplay, architecture and workflow changes. Prefer links over repeated rule descriptions.

## Style and scope

Use the versions/scripts in `package.json` and npm's lockfile. Do not add dependencies without a task need. Follow existing TypeScript/TSX style: two spaces, single quotes, no statement-ending semicolons, ES modules and type-only imports where appropriate. Use PascalCase components/classes, camelCase functions/variables and uppercase shared constants. Avoid `any` and unnecessary assertions; respect unused-symbol, fallthrough and React Hooks checks.

Prefer small direct functions and existing structures. Do not introduce an ECS, event bus, generic framework or extra state layer without a concrete need. Avoid unrelated refactoring, dependency upgrades and formatting sweeps. Do not scaffold future roadmap features unless requested. Continue procedural graphics; preserve React Strict Mode cleanup, observers and scene lifecycle handling.

## Git workflow

Use a dedicated feature branch for each sprint, normally created from freshly fetched `origin/main`; follow an explicit request to continue an existing branch. Preserve user changes. Commit and push completed changes, using `git push -u origin HEAD`, and provide the compare URL and validation results. Verify the remote commit. Never automatically merge into `main`. If fetching or pushing fails, report the exact error; do not force push, reset commits or alter credentials as a workaround.
