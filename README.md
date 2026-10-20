# Mini-Factorio

A browser factory game built with React 19, TypeScript, Phaser 3, Zustand, Tailwind CSS 4 and Vite. Mine iron and copper, smelt plates, and assemble gears, cables and circuits through powered production chains. Graphics are procedural; gameplay requires no external API or AI service.

## Start locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. In Windows PowerShell, use `npm.cmd` if script execution blocks `npm`. See [Development](docs/DEVELOPMENT.md) for toolchain, validation and review instructions.

## First factory

Place a generator and a nearby power pole, then build **miner → belt → furnace → belt → storage**. Machines and generators must be covered by poles. Furnaces detect incoming ore automatically. For circuits, feed iron plates and copper cables to separate inputs of an assembler; its Auto mode prioritizes complete circuit batches. Progress is session-only: refresh starts a new world.

| Control | Action |
| --- | --- |
| WASD / mouse wheel | Move camera / zoom |
| 1–7 | Miner, belt, chest, furnace, generator, pole, assembler |
| R / X | Rotate placement direction / remove, discarding contents |
| P | Electricity overlay |
| Escape, then click | Cancel placement and inspect a building |

All buildings are free. For exact recipes, buffers, power rules, previews and Auto waiting behavior, read [Game design](docs/GAME_DESIGN.md).

## Project context

- [Architecture](docs/ARCHITECTURE.md): implemented systems and source map.
- [Game design](docs/GAME_DESIGN.md): current gameplay and limitations.
- [Roadmap](docs/ROADMAP.md): completed milestones and future proposals.
- [Development](docs/DEVELOPMENT.md): setup, checks and contribution workflow.
- [AGENTS.md](AGENTS.md): mandatory contributor instructions.
