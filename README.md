# Mini-Factorio

A browser factory game built with React 19, TypeScript, Phaser 3, Zustand, Tailwind CSS 4 and Vite. Mine iron and copper, smelt plates, and assemble gears, cables and circuits through powered production chains. Graphics are procedural; gameplay requires no external API or AI service.

## Start locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. In Windows PowerShell, use `npm.cmd` if script execution blocks `npm`. See [Development](docs/DEVELOPMENT.md) for toolchain, validation and review instructions.

## First factory

Place a generator and a nearby power pole, then build **miner → belt → furnace → belt → storage**. Machines and generators must be covered by poles. Furnaces detect incoming ore once, then lock their recipe. For circuits, choose Electronic circuit in an assembler’s inspector, then feed iron plates and copper cables to separate inputs. Assemblers require a manual recipe. Inserters (8) move items between belts, chests and machine buffers without removing direct belt connections. Use **Save Game** to keep a local browser save, **Load Game** to restore it after refresh, or **Export JSON** for a portable offline backup. A separate autosave runs every two minutes of active gameplay. Research **Analytics I**, then expand **Analytics** on the right for actual item rates, production history, utilization and clickable bottlenecks; see [Production analytics](docs/GAME_DESIGN.md#production-analytics).

| Control | Action |
| --- | --- |
| WASD / mouse wheel | Move camera / zoom |
| 1–8 | Toggle miner, belt, chest, furnace, generator, pole, assembler, inserter |
| R / X | Rotate placement direction / remove, discarding contents |
| P | Electricity overlay |
| B | Toggle Spider Web in the Pete tab |
| Escape, then click | Cancel placement and inspect a building |

Factory placement is free once its technology is unlocked; Pete’s Treehouse costs 20 Wood. New games begin with Basic Industry; productive miners, furnaces and assemblers earn RP. Use **Research** to unlock inserters, assemblers, splitters and the analytics dashboard. See [Research and technology](docs/GAME_DESIGN.md#research-and-technology). For exact recipes, buffers, power rules, previews and recipe selection, read [Game design](docs/GAME_DESIGN.md).

## Project context

- [Architecture](docs/ARCHITECTURE.md): implemented systems and source map.
- [Game design](docs/GAME_DESIGN.md): current gameplay and limitations.
- [Roadmap](docs/ROADMAP.md): completed milestones and future proposals.
- [Development](docs/DEVELOPMENT.md): setup, checks and contribution workflow.
- [AGENTS.md](AGENTS.md): mandatory contributor instructions.

Pete walks at 1.3 tiles/second and can sabotage nearby machinery every 2 seconds, disabling it for 10 seconds with pumpkin mush and goblin slime. Select **Spider Web (B)** in the Pete tab first: click him to scare him into a corner, or a map tile to leave a ten-second trap. Ordinary clicks no longer throw webs. See [gameplay rules](docs/GAME_DESIGN.md#pete).

Use **9** to place a powered radar trap (5 kW, 3-tile range). Police take Pete to an automatically created edge prison, where its inspector can release him; he escapes automatically after 60 simulation seconds. See [police and prison rules](docs/GAME_DESIGN.md#police-radar-traps-and-prison).

Use **0** to place a compact **1×1 splitter**, with one rear input and front/left outputs. R rotates its placement direction. It shares items by round robin, keeps using an available output when the other blocks, and needs no electricity. See [splitter rules](docs/GAME_DESIGN.md#compact-splitter).

## Save, load and building categories

The build menu starts on **Factory**. **Pete** contains radar traps and Anti-Goblin Sprinklers; police cars and prisons still spawn automatically. Switching categories cancels placement/removal. Existing hotkeys select their tool and its tab; Escape returns to inspection mode.

Save & Load controls are below the inspector in the scrollable sidebar. Manual saves and autosaves occupy separate localStorage slots. Load Game, Load Autosave and Import JSON validate the entire snapshot before asking to replace the current factory. Export/import do not overwrite either browser slot. Refresh starts a new world until you explicitly load a save; there is no offline production catch-up. Browser saves belong to the current browser/profile/site, so export JSON before clearing site data or switching devices. See [Game design](docs/GAME_DESIGN.md#offline-save-and-load) for details.

Use **G** to place an **Anti-Goblin Sprinkler** from Pete. With full 5 kW power it detects Pete within 3 tiles, sprays for 1 second, then he slips for 1 second, complains for 2 seconds and flees for 8 seconds. Sprinklers cool down for 10 seconds after spraying; no pipes or water supply are needed. Police and post-release grace take priority. Existing Sprint 9 saves remain loadable; current version-8 saves preserve reactions, webs, cooldowns, analytics and research, while version-1–7 saves remain loadable. See [sprinkler rules](docs/GAME_DESIGN.md#anti-goblin-sprinkler).

## Pete’s Revenge

Three completed arrests trigger a five-second warning and Pete’s **Revenge-O-Matic 3000** walker. Select **Fly Swatter** in Pete and click the walker; ground clicks miss and all combat tools share a cooldown. Research **Revenge Defense I/II** for Drill and Lightning Beam. Powered police and sprinklers offer modest support. EMPs and the one-time half-health stomp disable machinery without destroying items. Defeat ejects Pete for a five-second recovery; the next event needs five additional arrests, then seven, and so on. See [Pete’s Revenge](docs/GAME_DESIGN.md#petes-revenge) for combat, research and save rules.


## Nature and forestry

Choose **Nature** for free Oak/Pine/Birch saplings, the **Axe**, and Flowers/Grass/Erase brushes in 1×1, 3×3 or 5×5 sizes. Drag to paint continuously. Trees block construction; decoration does not, and ore stays intact beneath both. Trees grow over five simulation minutes; the Axe yields 0/1/3 global Wood for saplings/young/mature trees. New worlds include forests and meadows with a clear starting area; existing saves load without newly generated nature. See [Nature rules](docs/GAME_DESIGN.md#nature-and-forestry).

Build **Pete’s Treehouse** in Nature for **20 Wood** to make Pete peaceful, gently shut down an active walker, and enjoy his walks, naps and occasional gifts. Only one home may exist; demolition returns him to mischief without a refund or loss of Revenge progress. See [Treehouse and peace](docs/GAME_DESIGN.md#petes-treehouse-and-peace).
