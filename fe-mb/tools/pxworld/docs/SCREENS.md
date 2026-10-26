# Embermarch · every screen in Filigree (shared brief for the screen agents)

The owner has locked the house style: **"Filigree", the 64-bit tier**.
- The world is C's painted, sunlit country.
- Over it sits a 1:1 pixel UI: carved walnut windows with brass corner caps, Jacquard 24 for places and screen titles, Source Serif 4 for reading and for people, 24px icons, and faces at 1×.

The map and combat screens are already done: `Hyb64Map` and `Hyb64Combat`, with renders in `out/preview/`. Your job is to draw the remaining screens in exactly the same style, so the whole game reads as one product.

## Read first, in this order
1. `src/BRIEF.md`: the board file format, the asset table, the QA loop, the forbidden looks and the base game data. All of it still applies.
2. `src/kit64/KIT.md` and `kit.py`: **the shared component kit. You MUST build from it.**
   - Import it (`sys.path.insert(0, 'tools/pxworld/src/kit64'); from kit import *`). Do not copy and fork it.
   - If you need a component the kit lacks, write it in your own folder on top of the kit's primitives, and name it in your report.
   - Never edit the kit itself. Five agents are using it at the same time.
3. The renders `out/preview/KitControls.png`, `KitPanels.png`, `Hyb64Map.png` and `Hyb64Combat.png`. This is the bar you must match.
4. For each screen you own, use these sources:
   - **The game's real UI source**, at `E:/Work/GameDev/Godot/fe-mb/game/src/ui/screens|modals|overlays/*.tsx`. It tells you what is actually on the screen, its states and its exact strings and labels. Read-only.
   - **Data and rules**, at `E:/Work/GameDev/Godot/fe-mb/game/src/` (data JSON, `rules.ts` and the engine). Use them for real names, prices, numbers and lines of dialogue. Never invent mechanics, and there is no morale and no terrain bonus.
   - **The current screen as it looks today**, at `shots/<name>.png`.
   - **The round-1 composition spec**, at `audit/compose_<screen>.json`. It gives regions, focal point, primary action and states.
     - Use its CONTENT and STATE thinking.
     - IGNORE its materials and look. It was written for a rejected paper style: sheets, linen, straps and seals are all gone.

## Rules that keep every screen consistent
- **Size and scope.** The stage is 1280×720, and each board is one screen in one named state. The state goes in the board's `<title>` as "Screen · the state" (it becomes the canvas label), never as a caption inside the screen. Scope all CSS under the kit's `.f64` class.
- **The world shows through.** Where a screen happens somewhere (town, camp, dungeon), set it against painted ground or a painted scene from C's world, built with the same code family (`src/hyb-64/world_*.py`, `src/camp/`). The UI sits in Filigree windows on top. Pop-ups (pause, contracts, company, dialogue, check, name) sit over a dimmed render of the map or combat screen: a flat dim, never blur.
- **One primary action per screen.** It is brass. Everything else is walnut or a plain command. Brass also marks whatever you point at, and nothing else.
- **Type.**
  - Jacquard 24 at 43px only for places, screen titles and the Round marker. Never a person, a foe or an item: at 43 px Bagrat "Oak" reads as "Dak". People and foes named on their own (the speaker, the one acting, the target) are Source Serif 4 bold at 20px, the kit's `person()`. The title wordmark at 86px is the one exception.
  - Source Serif 4 at 13–20px for everything read.
  - Sprite digits only for the one or two headline numbers on a screen.
- **Every interactive element shows its state.** Show at least one hover or selected state per screen, and a disabled item with its reason where the screen has one.
- **Real data only.** Every number must trace to the game source or BRIEF.md. If a screen needs a run state other than day 1, derive it consistently. For example, after one hop to Riverside Market it is day 2, food 7, gold 80.
- **Player-fiction strings only.** No internal ids, no codenames, no "Press X to…" body copy. Write copy in the game's voice (dry gallows humour, found family), and keep it short.
- **The owner's no-AI-trappings list applies in full.** See the global CLAUDE.md and BRIEF.md.

## QA (mandatory)
Run `node preview.mjs <Board>` and look at every PNG. Do at least three rounds per board. Zoom into crops to check that text is crisp at 13px or larger, that nothing overlaps or clips, and that the frames match the kit. Then hold your render side by side with `Hyb64Map.png` and ask whether they read as the same game. If not, fix it.

## Files
- Boards go in `out/boards/F64<Name>.dc.html`, each 1280×720 with `$preview` 1280×720.
- Scratch code goes in `src/f64-<your-group>/`.
- Touch nothing else.

## What to return
A short report:
- the boards you made, with name, the state each shows and the primary action;
- any kit gaps you filled locally;
- any data you could not find and how you handled it;
- the weakest point.
