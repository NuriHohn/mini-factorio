# Mini-Factorio

A browser factory game built with React 19, TypeScript, Phaser 3, Zustand, Tailwind CSS 4 and Vite. Mine iron and copper, smelt plates, and assemble gears, cables and circuits through powered production chains. Graphics are procedural; gameplay requires no external API or AI service.

## Start locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. In Windows PowerShell, use `npm.cmd` if script execution blocks `npm`. See [Development](docs/DEVELOPMENT.md) for toolchain, validation and review instructions.

## First factory

Place a generator and a nearby power pole, then build **miner → belt → furnace → belt → storage**. Machines and generators must be covered by poles. Furnaces detect incoming ore once, then lock their recipe. For circuits, choose Electronic circuit in an assembler’s inspector, then feed iron plates and copper cables to separate inputs. Assemblers require a manual recipe. Inserters (8) move items between belts, chests and machine buffers without removing direct belt connections. Use **Save Game** to keep a local browser save, **Load Game** to restore it after refresh, or **Export file** for a portable offline backup. A separate autosave runs every two minutes of active gameplay. Research **Analytics I**, then open **Analytics** in the header for actual item rates, production history, utilization and clickable bottlenecks; see [Production analytics](docs/GAME_DESIGN.md#production-analytics).

| Control | Action |
| --- | --- |
| WASD / mouse wheel | Move camera / zoom |
| 1–8 | Toggle miner, belt, chest, furnace, generator, pole, assembler, inserter |
| R / X | Rotate placement direction / remove, discarding contents |
| P | Electricity overlay |
| B | Toggle Spider Web in the Special group |
| Escape / right-click | Cancel a pending drag first; then close panels / put away tools |

Land factory placement is free once its technology is unlocked, except Waterwheel Generators cost 10 Wood and Fishing Docks cost 8 Wood; water bridge segments cost 3 Wood each; Pete’s Treehouse costs 20 Wood. New games begin with Basic Industry; productive miners, furnaces and assemblers earn RP. Use **Research** to unlock inserters, assemblers, splitters and the analytics dashboard. See [Research and technology](docs/GAME_DESIGN.md#research-and-technology). For exact recipes, buffers, power rules, previews and recipe selection, read [Game design](docs/GAME_DESIGN.md).

## Project context

- [Architecture](docs/ARCHITECTURE.md): implemented systems and source map.
- [Game design](docs/GAME_DESIGN.md): current gameplay and limitations.
- [Roadmap](docs/ROADMAP.md): completed milestones and future proposals.
- [Development](docs/DEVELOPMENT.md): setup, checks and contribution workflow.
- [AGENTS.md](AGENTS.md): mandatory contributor instructions.

Pete walks at 1.3 tiles/second and can sabotage nearby machinery every 2 seconds, disabling it for 10 seconds with pumpkin mush and goblin slime. Select **Spider Web (B)** in the Special group first: click him to scare him into a corner, or a map tile to leave a ten-second trap. Ordinary clicks no longer throw webs. See [gameplay rules](docs/GAME_DESIGN.md#pete).

Use **9** to place a powered radar trap (5 kW, 3-tile range). Police take Pete to an automatically created edge prison, where its inspector can release him; he escapes automatically after 60 simulation seconds. See [police and prison rules](docs/GAME_DESIGN.md#police-radar-traps-and-prison).

Use **0** to place a compact **1×1 splitter**, with one rear input and front/left outputs. R rotates its placement direction. It shares items by round robin, keeps using an available output when the other blocks, and needs no electricity. See [splitter rules](docs/GAME_DESIGN.md#compact-splitter).

## Save, load and building categories

The bottom build toolbar starts on **Factory**, alongside **Logistics**, **Power**, **Nature** and **Special**. Special contains Pete tools and removal; police cars and prisons still spawn automatically. Switching groups cancels tools. Existing hotkeys select their tool and group; Escape returns to inspection mode.

Open **Menu (☰)** for Save & Load and a confirmed New game. **Help (?)** separates How to Play from Controls. **Overview** contains detailed stock and power values; the header shows construction Wood. Manual saves and autosaves occupy separate localStorage slots. Load Game, Load Autosave and Import file validate the entire snapshot before asking to replace the current factory. Export/import do not overwrite either browser slot. Refresh starts a new world until you explicitly load a save; there is no offline production catch-up. Browser saves belong to the current browser/profile/site, so export a JSON file before clearing site data or switching devices. See [Game design](docs/GAME_DESIGN.md#offline-save-and-load) for details.

Use **G** to place an **Anti-Goblin Sprinkler** from Pete. With full 5 kW power it detects Pete within 3 tiles, sprays for 1 second, then he slips for 1 second, complains for 2 seconds and flees for 8 seconds. Sprinklers cool down for 10 seconds after spraying; no pipes or water supply are needed. Police and post-release grace take priority. Existing Sprint 9 saves remain loadable; current version-33 saves preserve reactions, webs, cooldowns, analytics and research, while version-1–32 saves remain loadable. See [sprinkler rules](docs/GAME_DESIGN.md#anti-goblin-sprinkler).

## Pete’s Revenge

Three completed arrests trigger a five-second warning and Pete’s **Revenge-O-Matic 3000** walker. Select **Fly Swatter** in Special and click the walker; ground clicks miss and all combat tools share a cooldown. Research **Revenge Defense I/II** for Drill and Lightning Beam. Powered police and sprinklers offer modest support. EMPs and the one-time half-health stomp disable machinery without destroying items. Defeat ejects Pete for a five-second recovery; the next event needs five additional arrests, then seven, and so on. See [Pete’s Revenge](docs/GAME_DESIGN.md#petes-revenge) for combat, research and save rules.


## Nature and forestry

Choose **Nature** for free Oak/Pine/Birch saplings, the **Axe**, and Flowers/Grass/Erase brushes in 1×1, 3×3 or 5×5 sizes. Drag to paint continuously. Trees block construction; decoration does not, and ore stays intact beneath both. Trees grow over five simulation minutes; the Axe yields 0/1/3 global Wood for saplings/young/mature trees. New worlds include forests and meadows with a clear starting area; existing saves load without newly generated nature. See [Nature rules](docs/GAME_DESIGN.md#nature-and-forestry).

Build **Pete’s Treehouse** in Nature for **20 Wood** to make Pete peaceful, gently shut down an active walker, and enjoy his walks, naps and occasional gifts. Only one home may exist; demolition returns him to mischief without a refund or loss of Revenge progress. See [Treehouse and peace](docs/GAME_DESIGN.md#petes-treehouse-and-peace).

Drag **Belts** to preview an orthogonal route with obstacle detours, same-direction reuse and deliberate same-axis reversal (perpendicular crossings stay blocked), or **Power poles** for a connected route around blocked sites that reuses existing poles (blue rings); release to build the whole valid proposal. Land belts and poles remain free; each new water bridge tile costs 3 Wood. Escape or right-click cancels the unfinished path without building. Cursor feedback explains costs and blocked cells. Short hints hide after three successful uses and stay in Help. Inspect a building for a simple status, then expand **Details and settings** for its existing controls. See [Building gestures](docs/GAME_DESIGN.md#building-gestures-and-previews).

New worlds include ponds, winding streams and rivers. Drag the normal belt tool from bank to bank for automatic straight bridges across up to **5 water tiles** per crossing. Water blocks other buildings and NPC paths. Old saves stay dry; version 9 preserves new water and bridges. See [Water and bridges](docs/GAME_DESIGN.md#water-landscapes-and-conveyor-bridges).

Use **Menu → Options → Graphics** to switch between Standard (60 FPS maximum) and Energy Saving (30 FPS maximum). Both preserve the same 50 ms simulation. Optional performance diagnostics are available there; see [Graphics options](docs/GAME_DESIGN.md#graphics-options).

In **Nature**, use **Create Water** and **Restore Land** with the shared 1×1, 3×3 and 5×5 brushes. Drag to shape connected channels and rounded ponds; red protected cells, existing bridges and their dry banks stay unchanged. Terrain edits persist in version-9 saves. See [Water landscapes](docs/GAME_DESIGN.md#water-landscapes-and-conveyor-bridges).

Build a **Waterwheel Generator** from **Power** for **10 Wood** on land facing adjacent water. It supplies **50 kW** through ordinary poles, pauses if that water is removed, and resumes when restored. R or mouse-drag rotation selects the water-facing side. Version 10 preserves wheel phase and still loads versions 1–9. See [Waterwheel rules](docs/GAME_DESIGN.md#waterwheel-generator).

Build a **Fishing Dock** from **Nature** for **8 Wood** on land facing water. Keep its rear land approach clear: peaceful Pete may visit for a quiet fishing pause, then return home. On suitable connected water he may also take a short rowboat outing and return. Neither activity produces items. Version 12 preserves visits and boat trips and still loads versions 1–11. See [Fishing Dock rules](docs/GAME_DESIGN.md#petes-fishing-dock).

Use **Logistics → Wooden Footbridge** to drag across 1–5 water tiles between empty shores, costing 3 Wood per new deck. Pete and police can cross; remove only when the crossing is clear. See [footbridge rules](docs/GAME_DESIGN.md#wooden-footbridges).

Empty shorelines also show decorative clustered reeds and cattails that adapt to landscaping and sway gently. See [shoreline vegetation](docs/GAME_DESIGN.md#shoreline-vegetation).

Build **Pete’s Supply Crate** in **Nature** for **6 Wood**. Belts and inserters deliver up to **200 items total**; inspect the box for quantities. Peaceful Pete may visit; supplied Wood can fund his first secret project. See [supply crate rules](docs/GAME_DESIGN.md#petes-supply-crate).

Put away the active tool (Escape), then click the **Wood icon above a Supply Crate** to unload 6 existing forestry Wood with a short falling-plank animation. Peaceful Pete can autonomously collect it and gradually build one small fence near home. See [secret project rules](docs/GAME_DESIGN.md#petes-first-secret-project).

After completing his fence, peaceful Pete can collect **10 supplied Wood** and build one decorative **Chicken Coop** near home. Three chickens move in, peaceful Pete collects their eggs, and two yellow chicks arrive after 2½ simulation minutes. Eggs stay outside factory inventory. See [chicken coop rules](docs/GAME_DESIGN.md#petes-chicken-coop).

After the coop, Pete can build a **Campfire** with **5 supplied Wood**, then sit beside it to fry and eat collected eggs. See [campfire rules](docs/GAME_DESIGN.md#petes-campfire-and-fried-eggs).

After the campfire, Pete can extend his fence into a compact **enclosed yard**, reusing existing rails and collecting two supplied Wood per missing section. An open entrance keeps his routes clear; a completed intact yard contains chickens and chicks. See [yard rules](docs/GAME_DESIGN.md#petes-enclosed-yard).

Pete then builds his **Garden Gate** at the reserved entrance for **3 supplied Wood**. It swings open when he approaches from either side and closes after passage; chickens and chicks stay inside. See [garden gate rules](docs/GAME_DESIGN.md#petes-garden-gate).

At **Craftsman level 2**, Pete can autonomously add a permanent veranda to his treehouse using **20 supplied iron plates**, then occasionally relax there. See [Treehouse veranda](docs/GAME_DESIGN.md#craftsman-level-2-treehouse-veranda).

At **Inventor level 1**, Pete can autonomously build an **Experiment Table** using **8 copper plates and 4 copper cables** from one Supply Crate. Finished experiments earn Inventor XP without producing items or requiring power. See [Experiment table](docs/GAME_DESIGN.md#inventor-level-1-petes-experiment-table).

At **Industrial level 1**, Pete can build a **Recycling Press** for **10 supplied iron gears**. Feed iron gears by belt/inserter; Pete recycles 1 gear into 1 plate, and inserters collect its output. See [Gear press](docs/GAME_DESIGN.md#industrial-level-1-petes-gear-press).

Put away tools with Escape and click Pete to inspect his current activity, current project, possible next wish, and concrete resource/access/site requirements. The panel updates while open and does not issue commands.

At Eco level 2, a completed garden enables repeatable mulching: Pete collects **2 supplied Wood**, works for **4 seconds**, earns **4 Eco XP** on completion and waits **60 seconds** before the next care project. His inspector shows the requirement and cooldown.

Pete favours larger, rewarding projects while keeping small-project chances. His inspector explains that the first three rails precede the enclosed yard, then shows yard prerequisites and construction progress.

Chickens and chicks return to their coop when Pete goes inside to sleep, stay there during his rest and come out again afterward. Inspect the coop to see how many are inside.

Garden care grows one Eco-only chicken-feed portion (up to four stored at the garden). Pete carries one to the coop, feeds for four seconds and earns 2 Eco XP, with three minutes between meals.
