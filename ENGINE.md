# FamilyCraft engine (core)

The game core that every room (home island, missions, mini-games) runs on. Plain ES modules, no build
step, three.js 0.160 from a CDN through the import map in `game.html`. Open `game.html` (`?room=tower`
for the second room, `?fresh` to wipe the saved island, `?debug` to expose `window.__g`).

## Layout

| folder | what lives there |
|---|---|
| `engine/main.js` | entry: picks the room from the address and starts the game |
| `engine/game.js` | `Game`: renderer, scene, lights, loop, and every system; `enter(room)` runs one room |
| `engine/core/` | `core.js` (event bus, safe storage, seeded random, maths), `i18n.js` (Thai/English, `data-t` attributes), `input.js` (joystick, buttons, keys, camera drag) |
| `engine/world/voxel.js` | block registry `BLOCKS` (tool, hardness, drop, pixel textures drawn in code) and `VoxelWorld` (cells, instanced textured cubes, collision, `raycast` for aiming, save/load) |
| `engine/world/farm.js` | farming: till with a hoe, plant seeds, water with the can, crops grow while the field is wet, harvest (`CROPS`) |
| `engine/physics/body.js` | `Body`: box vs blocks, gravity, knockback, auto step-up one block, fall height, water |
| `engine/camera/follow.js` | third-person orbit camera (pulls in when a block would hide the player) and first-person view with hand and held item |
| `engine/entity/character.js` | `CHARACTERS` list, GLB loader (reads `fc_down`/`fc_rigid` extras from the rig), `Animator` (idle, walk, air, punch, slash, eat, hurt; item in hand) |
| `engine/entity/player.js` | `Player`: movement, aiming (mouse, tap, crosshair, or the block at your feet), hold-to-dig with tools, place/eat/farm/sleep, fighting, hearts, stamina (sit to recover, bed to refill), falls, sea |
| `engine/entity/things.js` | `Drops` (walk into to pick up), `Mobs` with `KINDS` (jelly, beetle, spiky) and spawn points that respawn after a timer, `Deco` (grass, flowers) |
| `engine/items/items.js` | `ITEMS` (blocks, tools, food, farm items: what each does is data), `RECIPES` for crafting, `Inventory` (6 hotbar + 24 bag slots) |
| `engine/fx/` | `materials.js` (clay material), `fx.js` (particles, floating numbers, sounds), `music.js` (code-made waltz; `audio/bgm-<room>.mp3` replaces it if present) |
| `engine/ui/hud.js` | HUD: profile chip, hearts, goal counter, hint sign, hotbar, action icon, settings |
| `engine/telemetry/telemetry.js` | play events for the parents' page (`EVENTS` is the contract) |
| `engine/net/net.js` | play together: room codes, carriers (Supabase, home Wi-Fi via `serve.mjs`, another window), host-owned island, synced players, blocks, drops, stars and critters |
| `engine/ui/together.js` | the play-together panel in settings (make room with code, link and QR; join with a code) and the room chip |
| `engine/rooms/` | rooms: `home.js` (saved island, stars, trees, critters), `tower.js` (build challenge, no damage) |
| `css/hud.css` | HUD styles; three skins (`skin-a` clay, `skin-b` candy, `skin-c` workshop, the default) |
| `parent.html` | prototype parents' page that reads the play events stored on this device |
| `tests/engine.test.mjs` | 39 automated play checks (needs `node serve.mjs` running) |
| `tests/together.test.mjs` | 17 two-device checks through the home Wi-Fi relay |

## Making a new room

A room is one object (see `engine/rooms/tower.js`):

```js
export default {
  id: 'myroom', persist: false, size: 20, height: 12,        // world box; persist saves the world
  words: { th: {...}, en: {...} },                          // its own text
  rules: { build: true, harvest: true, damage: false },     // what the player may do
  start: { brick: 10 },                                     // starting items
  spawn: [0, 0],
  build(game, saved){ /* fill game.world, add trees/mobs/drops, set up goals, listen on game.bus */ },
  update(game, dt, t){ /* per-frame rules */ },
  save(game){ return {} }                                   // extra state to keep when persist is true
};
```

Register it in `engine/main.js` (`ROOMS`). Links from the Family Journey app may add `?player=strong|stark|dad|mom` (who plays) and `?back=https://familyjourney.io/...` (back button). Report progress with `game.track('goal_progress' | 'goal_complete' | 'skill', {...})`
so it shows on the parents' page. Events from the world arrive on `game.bus`: `block_place`, `block_break`, `mob_defeat`, `inv`.

## Adding an item, a recipe, a block or a critter

- Item: a row in `ITEMS` (`engine/items/items.js`): `place: BLOCK.x` builds, `tool: 'shovel'|'axe'|'pickaxe'|'hoe'` digs matching blocks 4x faster, `melee: { dmg, reach }` fights, `food: { heal }` is eaten, `farm: 'till'|'water'|'plant'` farms. Give it an icon in `engine/ui/hud.js` (`SVG`) and a hand mesh in `heldMesh` (`engine/entity/character.js`).
- Recipe: a row in `RECIPES` (`{ out, n, need: { id: count } }`); the craft panel lists it automatically.
- Block: a row in `BLOCKS` with `tool`, `hard` (seconds by hand), `drop`, optional `needs` (tool required to drop), and a texture in `T`.
- Critter: a row in `KINDS` (`engine/entity/things.js`) and a look in `Mobs.mesh`; a room places spawn points with `{ x, z, kind, respawn }`.

## Controls

Phones: joystick, jump, dig/hit (hold), use/place, sit; tap a block to aim at it; drag the world to turn; eye button = first person; bag and craft buttons at the end of the hotbar.
Desktop: WASD, Space, mouse points at blocks, left hold = dig/hit, right click = use/place, right-drag = turn, wheel = zoom, 1-6 hotbar, E bag, C craft, X sit, V view.

## Characters

`models/std-<id>.glb`, rigged with `tools/rig2.py --mode=skin` (13 bones). The source art should be a front, side and back
sheet in an A-pose (arms out about 45 degrees with a clear gap, round fists, legs apart), built with Hunyuan3D-2mv.

## Not built yet

Accounts and syncing events to the family account, the flood mission on this engine,
authored animation clips, mobile performance work (character files are about 4 MB each).

## Playing together

Settings, "Play together": one device taps "Make a room" and shows a 4-letter code, a link and a QR; the other types the
code or scans the QR (or opens `game.html?join=CODE`). The maker's island is the shared world and the maker's device runs the
critters; the joiner's own island is not changed or saved over. With `fc-config.js` filled in (Supabase project URL and
anon key) it works across the internet; without it, both devices must be on the same Wi-Fi as the computer running
`node serve.mjs`. Message types are listed at the top of `engine/net/net.js`.

## Game numbers and the back office (2026-11-22)
- All tunable numbers: `engine/data/tuning.js` (TUNING for player/stamina/dig, plus fields of ITEMS, BLOCKS, KINDS, RECIPES).
- `data/game-data.json` overrides the code defaults at start-up (`loadData()` in main.js). A "try it" copy in localStorage `fc-data-try` wins over the file.
- `admin.html` = the back office: tabs for weapons/tools, blocks, critters, player/stamina, recipes; each row shows the result in plain words (hits to kill, hits to fell a log). Buttons: try in game, save (POST `/fc/data`, only accepted from this computer; the previous file is kept as `game-data.prev.json`), reset.
- New item field `dig` (tool speed ×, default 4). Critter `respawn`/`roam` now live in KINDS; room spawners only give positions.
- Hand items follow design/weapons/weapons-spec.md (drafted by Codex). Held items are children of the right grip hand (`makeFists` in character.js); an empty hand shows the model's own hand.

- TUNING.quest (levels, stars, hintRungs, sinkDelay, codeStepMs, codeMaxSteps, digLayers, peekMs) and quest telemetry events (level_start, level_complete, hint_used, level_quit, role_set, brief_applied) added 2026-11-24 for the quest mini-game rooms (session 'Top 20 mini games').

## Quest rooms (demo, 2026-11-25)
Five educational mini-game rooms, each a room module in `engine/rooms/` with pure logic in `engine/rooms/quest/<id>-logic.js`:
`blueprint` (Timber the beaver: symmetry, perimeter/area, plan + volume), `dig` (Tunny the mole: spell letters, eras, timeline), `escape` (Bolt the pangolin: patterns, Roman numerals/clocks, equations), `code` (Bolt: sequences, loops, conditions), `obby` (Pip the tree-frog: dot compare/first sounds, times tables, fractions). Three bands: a = 4-6, b = 7-9, c = 10-12; four levels each (the fourth is the free level).
- Entry page: `quests.html` (picker, TH/EN via `fc-lang`, links `game.html?room=<id>&band=<a|b|c>`). Thumbnails in `img/quests/`.
- Shared files in `engine/rooms/quest/`: `common.js` (seeded RNG, QUEST_DEFAULTS, startQuest), `banks.js` (phonics, tables, fractions, eras), `label.js` (canvas text labels), `use-shell.js` (loads the shell), `vendor/shell.js` (vendored copy of `familycraft-games/shell/`; do not edit, re-copy from there), `camera-rule.js` (keeps the player and targets in view per orientation), `band-chip.js` (4-6 / 7-9 / 10-12 chip in the HUD), `code-panel.js` (command tiles and program strip for `code`).
- URL params: `?room=<id>` (blueprint, dig, escape, code, obby), `?band=a|b|c`, `?debug` (exposes `window.__g` for tests), `?fresh` (ignore saved quest progress, start at level 1).
- Tests (need `node serve.mjs` on 8787): `tests/quest.test.mjs` (shell/common logic), `tests/quest-rooms.test.mjs` (every room in a real browser), `tests/quest-shots.mjs [outDir]` (30 screenshots, 5 rooms x 3 bands x 1180x620 / 375x812, plus `sheet-desktop.jpg` and `sheet-phone.jpg`).
- Known gaps: the shell UI (level map, star summary) is not built, so levels auto-advance after a finish; host characters are text only (names are temporary until designs are approved); these game numbers are still code constants, not in `TUNING`/admin yet:
  - blueprint.js: `PLOT` (plot corner cell), `FREE_MIN` (blocks to finish the free level); blueprint-logic.js: mirror/size rules per band.
  - dig.js / dig-logic.js: `DIG` (`sizeX`, `stairs`, `findX0/1`, `sizeZ`, `maxPerEra`, `free`), `PLINTH`.
  - escape.js / escape-logic.js: `HIT` (plate press distance), `SPOT`, `BOUNDS`, `PORTRAIT_DIST`, `LAND_DIST`, `ESCAPE.free`.
  - code.js / code-logic.js: `GW`, `GD`, `PARK_Y`, `CODE.maxLoop`, per-level `maxCmds`.
  - obby.js / obby-logic.js: `OBBY` (`rows`, `options` per band, `pad`, `gap`, `dock`), `PITCH`, `SIGN_LEAN`, `SH`, `SY0`, `PERIOD`.

## Home island v2 and islander quests (2026-11-26)
- The home island is 64 x 64 cells. Layout designed by Codex in `design/island/layout-spec-v2.md` (map `map-v2.txt`, generator and self-checks `gen_map_v2.py`, picture `plan-v2.html`). The numbers live in `engine/rooms/home-island.js` (`ISLAND`): terrain shapes, pier, boardwalk, trails, trees, rocks, stars, critter spawns, islanders' plots. Change the spec and that file together.
- Start point: the pier (`ISLAND.spawn`), facing north. `room.saveVer` = 2; an older 30 x 30 save is kept aside as `fc-save2-home-old1` and a fresh island starts.
- Protected cells (`PROTECTED`, `locked(x, z)`): the pier, berth, landing, arrival boardwalk, village green and every islander's plot. The room sets `world.lock` after building, and `VoxelWorld.set` refuses locked cells, so no path (player, network, farming) can dig or build there. The player sees `home_locked`.
- Talkable islanders: `engine/entity/npc.js` (`NPCS` data, `Npcs` engine: name tag, Talk button, talk camera, dialogue card, their mini-game in a frame, `back.html` to return). Mini-games in the sibling folder are mounted at `/home/` by `serve.mjs`; deploy them at the same path in production. Tuning: `TUNING.npc`.
- Quests give Talk a script: an islander's `quest.script()` returns cards `[{ face, text, note?, ok?, later?, onOk?, onLater? }]`, or null to run the islander's own challenge. `Npcs.say(npc, cards)` shows cards at any time; `quest.result(r)` gets the mini-game result.
- Zoomy Fox's quest: `engine/rooms/quest-fox.js`, designed in `design/island/fox-quest-spec.md`. Ghost kart, three assemblies in order (frame 6 planks, wheels 1 stone, rear 4 planks), a Fit part button at the kart, a bouncing marker on the next thing to do, the banner rises when done, then Talk opens the race. Saved in the room save under `fox`. Tuning: `TUNING.fox` (also in admin.html).
- Not built yet from the spec: strict tutorial order (hints follow what is missing instead), co-op sharing of quest state and split deliveries, the blueprint collection screen (the first win only sets a flag and shows a card), re-growing a used-up guide tree or rock, Beaver and the other three islanders (their plots are reserved and protected).
- Game feel (owner picked items 1-5 and 7-9 from design notes, 2026-11-26): drops fly in faster and pop then shrink (`Drops.update`), a chime that climbs while pickups keep coming and more stars on a streak (`Game.pickup`, `TUNING.pickup`), the icon flies to its hotbar slot (`Hud.fly`), floaters pop/float/fade, size by amount, fan out, coloured by kind (`Floaters.add(pos, text, cls, size)`; classes dmg, hurt, heal), a lost heart flashes and a healed one pops (`Hud.hearts`), the energy bar keeps a pale chunk for a beat (`#stam u`). No combo label (item 6 was left out).
