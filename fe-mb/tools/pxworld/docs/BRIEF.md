# Embermarch: visual direction variants (shared brief)

You are building **one** of five competing visual directions for *Embermarch*, a DOM-only tactical roguelite (React 19 + TypeScript, fixed 1280×720 stage). The owner will pick one direction from rendered mockups, so the mockups must look like a finished, shipped game, not a wireframe. Make it beautiful, specific and confident.

## Why this exists

The owner rejected the current look outright: "overall im not very happy with the paper ui direction its not good at all". These are all OUT, and your variant must not drift back towards any of them:

- **Paper of any kind.** Parchment, vellum, linen, ledger pages, a cream sheet as the main surface, stitched straps, wax seals, ink-drawn cartography. Paper may appear at most as a tiny prop, never as the ground of a screen.
- **Candlelit grimdark.** A near-black void, amber "hearth" glow, embers, candle flicker, heavy vignette.
- **"Forged & Lit".** Hammered iron plates lit by an amber glow as the house style.
- **Every screen as the same sheet**, so that combat goes tonally flat.

**Tone to hit.** Earthy and grounded, with Mount & Blade energy: a mercenary company in a hard world, a warm found-family core, gallows humour. It is daylight, not night.

**The owner's design rules apply in full.** See the global CLAUDE.md, "no AI trappings":

- no fingernail cards;
- no gradient text, glassmorphism, blur panels, neon glows or heavy drop shadows;
- no icons inside coloured circles or squares;
- no identical rounded cards and no cards nested in cards;
- no pill badges;
- no big-number tile for every metric;
- no emoji;
- no Title Case on every heading;
- no filler copy.

Status is shown with text colour, shape and the bar's own colour. Hierarchy comes from type, spacing and alignment.

**Game rules you must not invent around.** There is no morale, and there are no terrain bonuses. Combat is card-based: the gear is the deck, and cards cost AP. Do not add mechanics, stats or numbers that are not listed below. If you need an extra label, write it in plain player-facing English that fits the fiction.

## Deliverables (exactly three files)

Write them to `tools/pxworld/out/boards/`, using your KEY from the prompt:

1. `Dir<KEY>Map.dc.html`: the overworld map screen at **1280×720**.
2. `Dir<KEY>Combat.dc.html`: the combat screen at **1280×720**.
3. `Dir<KEY>Key.dc.html`: a spec card at **560×720**. Most of the card is visual, with a little text. It holds:
   - the direction's name;
   - a one-sentence pitch;
   - the games it borrows from;
   - the palette as swatches with names;
   - the type specimens, rendered in the real fonts;
   - the 4–5 rules that define it, each one short;
   - a short "what it costs" line: the new art it needs, such as a terrain set, UI frames or portraits.

   The card must follow the direction's own look; it is not a white document.

Keep your scratch generator code in `src/<key-lowercase>/`. Touch NO other files. Other agents are writing other `Dir*` boards at the same time.

### Board file format (exact wrapper, required by the canvas)

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Short name</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">
<style>
/* all CSS here; scope it under a class unique to your direction, e.g. .dir-pixel */
</style>
</helmet>
<div class="dir-yourkey" style="width:1280px;height:720px;position:relative;overflow:hidden">
  ...the screen...
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":720}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
```

The wrapper has these constraints:

- The first `<div>` inside `<x-dc>` is the board root.
- For the Key card, use `width:560px;height:720px` and `"$preview":{"width":560,"height":720}`.
- Static HTML, CSS and inline SVG only. No external JS.
- Fonts come from Google Fonts only.
- Images come only from the asset table below, referenced by their `/_blob/<id>` url exactly as given.
- Inline SVG and CSS can draw anything else: terrain, icons, frames, textures.
- `feTurbulence` filters are allowed for texture.
- `image-rendering:pixelated` is fine.

### QA loop (mandatory)

From tools/pxworld, run `node preview.mjs Dir<KEY>Map Dir<KEY>Combat Dir<KEY>Key`. It writes `out/preview/<name>.png` with the real images and fonts swapped in. **Read each PNG and look at it.** Iterate until it is genuinely good, which is at least three rounds.

On every round, check:

- the 1-second glance: what matters, and what to do next?
- that no text is clipped, overlapped or too small (body text ≥ 13px; numbers readable);
- that it cannot be mistaken for a web dashboard;
- that every rejected look listed above is absent;
- that the AI-trappings list is clean;
- that every number matches the data below.

## Assets (`/_blob/<id>`, use the url verbatim)

| key | url | size | what |
|---|---|---|---|
| face_roy | /_blob/dedda7bf009e94f7282e8c2ab1db5a40 | 96×96 | portrait, The Foundling |
| face_marcus | /_blob/9eca034c7b3c5e3005ff1065c74be701 | 96×96 | portrait, Bagrat "Oak" |
| face_lilina | /_blob/2e98b185311d8223cb34b85619926263 | 96×96 | portrait, Lilina |
| face_bandit | /_blob/1ed8ce7d6f32da84efbbc4131edf11ba | 96×96 | portrait, Obsidian Fighter |
| face_ember_mage | /_blob/97ff291f8b6be89ce96aeafd048777c8 | 96×96 | portrait, Ember Mage |
| face_warlord | /_blob/bd43556329fbf601b13fb566e06a45dc | 96×96 | portrait (the final boss, the Warlord) |
| board_roy | /_blob/8cdcf86c80be6a4fc8f831c21ad16663 | 104×152 | full-body board sprite, transparent |
| board_marcus | /_blob/cbd64a7800a9e2d72b96811b4747cfe3 | 104×152 | " |
| board_lilina | /_blob/89bfbda1914ab080775cbcbe0151accf | 104×152 | " |
| board_bandit | /_blob/c24a98bcc427f06376cb344348d47e2b | 104×152 | " (Obsidian Fighter) |
| board_ember_mage | /_blob/6d32aa52aa5dda90c5f8318e6b9eeb64 | 104×152 | " |
| full_roy | /_blob/219387c5045fb559ff674e76638f4658 | 832×1216 | the same art at full resolution, transparent; use for large cut-ins |
| full_marcus | /_blob/6eac703113ba614d900aae3e9de82c23 | 832×1216 | " |
| full_lilina | /_blob/525200e271cb27e34288a8d66ec60f70 | 832×1216 | " |
| full_ember_mage | /_blob/792dd4237e5c25fe45abb7a976274fb7 | 832×1216 | " |
| full_bandit | /_blob/23cfbb7bd41057c250a21bfbd24b38a2 | 832×1216 | " |
| px_grass | /_blob/6d3b393250b90ddd0c10918d9985a5e7 | 64×64 | pixel grass tile (bright green; tint with filters if needed) |
| px_dirt | /_blob/230b13aaf4d3384746fa863e167b620b | 64×64 | pixel dirt tile |
| px_dirt_edge_n/s/e/w | n /_blob/399186ac8a17d6f114a83854c0cc7c76 · s /_blob/d5ea7a9f98966eff91b8f93e06070b48 · e /_blob/be5d640d87bf8173aba46d707789d827 · w /_blob/f432c475fcc7f3df3cfdd54479cf50cd | 64×64 | dirt tiles with a grass edge on that side |
| px_dirt_outer_ne/nw/se/sw | ne /_blob/cec2cb017bd7578ac87b95634fe6f427 · nw /_blob/3dc0c0b465499dc001b28712b0b74e17 · se /_blob/984adcf56c578cbb4c00da87b8ac34b8 · sw /_blob/217d670ec9cf2e547b83199ca3879a77 | 64×64 | dirt outer corners |
| px_dirt_inner_ne/nw/se/sw | ne /_blob/7bee9e7b7bbd1cd57c01a4ff645367ff · nw /_blob/15dde5d1414fca2e254e7a0210e79943 · se /_blob/2131cd9c681d01d185a2380696e64f51 · sw /_blob/ab3070cc56bfad20230de6ea51ad7555 | 64×64 | dirt inner corners |
| tex_grass | /_blob/bb0b898c5b6339689fe40548327ceddc | 128×128 | painted grass texture (tileable) |
| tex_dirt | /_blob/390ae6accc24ea02d1ef51e89a4310e1 | 128×128 | painted dirt texture |
| tex_stone | /_blob/34b7d54f1c03f8d94b551583145d1b1c | 128×128 | stone flags |
| tex_water | /_blob/a7b1ad8667711a03af0823366cd2c6cf | 128×128 | painted water |
| backdrop_borderlands | /_blob/6158dbb94a18a88a0d4eef1a65d56df9 | 1536×512 | painted dusk grassland panorama |
| backdrop_thornwood | /_blob/6a419962fd9673624edb2dd2e801bb07 | 1536×512 | painted misty forest panorama |
| backdrop_ashfall | /_blob/f8cbdc2f20e01b10c999a7e271fb5ad8 | 1536×512 | painted ash plain panorama |
| camp_fire / camp_tent | /_blob/d7d8584962576fa0c101d6cd3fad81ee (108×132) · /_blob/070054c29621911a0f2d54f8970763ec (192×136) | | pixel campfire, pixel tent |

The character art is painted, slightly anime-styled fantasy (red-haired swordsman, white-haired knight in a red cloak, blue-robed blue-haired mage). The faces are crops of it. The unit art is the one fixed asset every direction must live with. Anything else (terrain, map art, frames, icons) is yours to draw in SVG or CSS. Your Key card states what real art the direction would need to have made.

## Screen 1 · The overworld map (state: day 1 of a new run)

The map MODEL is fixed: **one open sheet**, a single contiguous 2-D world map that pans. The Borderlands, then Thornwood to the east, then Ashfall, then the final boss at The Iron Throne. "Sheet" is the model, not paper. You show the Borderlands portion, with a hint that the land continues east.

**The company.** "The Company" (default name), three people. The roles are text, not stats.

| Name | Face | HP | Role and gear |
|---|---|---|---|
| The Foundling | roy | 73/73 | Lord · Iron Sword |
| Bagrat "Oak" | marcus | 84/84 | Knight · Iron Lance, Iron Buckler |
| Lilina | lilina | 62/62 | Mage · Fire Tome |

**Run state.**

- Day 1.
- Gold 80.
- Food 8: 2 rations of 4 charges each, and each hop eats 1 charge.
- The bag also holds 1 Healing Potion.
- Region: **The Borderlands**. An encounter happens on 4 hops in 10.

**Commands.** Company (roster and gear), Contracts (quests, none yet), Menu (key: Esc).

**Places in view.** The stage px below are a suggested layout. You may move, scale or re-lay them out, but keep this topology.

| id | Name | Kind | x, y |
|---|---|---|---|
| frontier_camp | Frontier Camp | camp, **the company is HERE** | 440, 430 |
| traders_rest | Trader's Rest | camp | 530, 352 |
| riverside_market | Riverside Market | town (market, inn) | 660, 400 |
| south_road_ambush | South Road Ambush | a battle site | 640, 500 |
| old_mill_crossing | Old Mill Crossing | waypoint | 800, 330 |
| bandit_hideout | Bandit Hideout | a battle site | 830, 430 |
| south_junction | South Junction | town | 820, 540 |
| north_ridge_path | North Ridge Path | waypoint | 990, 290 |
| watchtower_ridge | Watchtower Ridge | stronghold or camp | 1090, 330 |
| pine_crossing | Pine Crossing | town | 1076, 410 |
| smugglers_cave | Smuggler's Cave | dungeon, **locked for now** | 1060, 510 |
| broken_bridge | Broken Bridge | waypoint, a bridge over the river | 960, 580 |
| border_fortress | Border Fortress | stronghold, at the east edge | 1266, 350 |
| rodericks_camp | Roderick's Camp | camp, at the east edge | 1266, 460 |

**Roads (undirected).** Each one hop costs 1 day and 1 food:

- frontier_camp to riverside_market, south_road_ambush and traders_rest;
- riverside_market to old_mill_crossing and bandit_hideout;
- south_road_ambush to south_junction;
- old_mill_crossing to watchtower_ridge, pine_crossing and north_ridge_path;
- bandit_hideout to south_junction and pine_crossing;
- south_junction to smugglers_cave and broken_bridge;
- watchtower_ridge to border_fortress and north_ridge_path;
- pine_crossing to border_fortress and rodericks_camp;
- smugglers_cave to rodericks_camp and broken_bridge.

A river runs roughly north to south through x≈800–990, and Broken Bridge crosses it. Ridges, forest and fields are yours to place.

**The state to render.**

- The company stands at Frontier Camp.
- The **three roads out** go to Trader's Rest, Riverside Market and South Road Ambush. They are the only actionable things and must read as such before any hover.
- The player is **hovering Riverside Market**. Show its forecast where the player is looking: "Riverside Market · town", 1 day, 1 food, and "an encounter on the road: 4 in 10".
- Clicking goes there straight away. There is no confirm button.
- Everything else is visible but quieter.

## Screen 2 · Combat (state: round 1, Lilina's move, a card aimed)

**Board.** 14 columns × 10 rows of square tiles; size and position are yours. Coordinates are (col, row) from the top-left, starting at 0.

- **Dirt path tiles** (everything else is grass): (2,1) (3,1) (1,2) (2,2) (3,2) (4,2) (5,2) (2,3) (3,3) (4,3) (5,3) (6,3) (3,4) (4,4) (5,4) (6,4) (7,4) (6,5) (7,5) (8,5) (10,8) (11,8) (11,9).
- **Impassable rock or wall tiles:** (6,2) and (10,6).

**Units.** Allies are on the left, foes on the right. Use the `board_*` sprites, standing on the tiles.

| Unit | Side | Tile | HP | Note |
|---|---|---|---|---|
| Lilina | ally | (1,4) | 62/62 | **acting now** |
| The Foundling | ally | (2,4) | 73/73 | |
| Bagrat "Oak" | ally | (2,5) | 84/84 | |
| Obsidian Fighter 1 | foe | (6,3) | 103/103 | board_bandit, face_bandit |
| Obsidian Fighter 2 | foe | (6,5) | 103/103 | board_bandit, face_bandit |
| Ember Mage | foe | (6,7) | 90/90 | |

The two Obsidian Fighters must be told apart with an ordinal, 1 and 2.

**Turn order this round.** Lilina, The Foundling, Obsidian Fighter 1, Obsidian Fighter 2, Ember Mage, Bagrat "Oak".

**Lilina's turn.**

- 3 AP, all unspent.
- **Hand of 5 cards.** Each card shows its cost, name, magnitude and a short line:

| Card | Cost | Kind | Magnitude | Line |
|---|---|---|---|---|
| Flame Burst | 2 AP | attack | 11 | magic · a wide blast |
| Barrier | 1 AP | ward | 3 armor | an ally |
| Blaze | 2 AP | attack | 15 | magic · one foe |
| Arcane Burst | 2 AP | attack | 13 | magic · one foe |
| Fire | 1 AP | attack | 11 | magic · one foe |

- Discard pile: 0.
- Bag: Healing Potion ×1, which restores 10 HP and costs 1 AP to drink.
- Turn commands: Move, Capture (take a foe alive when it is low), and **End turn**.
- A "danger zone" toggle (key: Tab) shows foe reach.
- A battle log, still empty, with in-voice copy because nothing has happened yet.
- Menu (key: Esc).

**The state to render.**

- The player has **picked up Blaze** and is aiming at **Obsidian Fighter 1**.
- Show the forecast: 15 damage, 103 → 88, with the bar showing the loss.
- Show which unit is acting and which one is targeted.
- Show the AP that Blaze will spend: 2 of 3.

**Legibility comes first on the board.** Allies and foes must be distinguishable by more than colour, for colour-blind players, through shape or a base marker.

## What to return

Return a short plain-text report with:

- the direction's name and one-sentence pitch;
- the 4–5 choices that define it;
- the fonts used;
- the three file names;
- one honest line on its weakest point.
