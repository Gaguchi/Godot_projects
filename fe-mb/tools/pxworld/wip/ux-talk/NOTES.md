# ux-talk · the conversation as visual-novel screens

Four boards replace F64Dialogue for story and quest talk. Road events stay pop-ups over the map (UXFLOW principle 6).
Every line is read verbatim, at build time, from `game/src/content/data/dialogue/sq_blood_ties_accept.json` and
`sq_blood_ties_daren_captured.json`.

**Rebuild:**

```
cd C:/Users/Boris/AppData/Local/Temp/claude/E--Work-GameDev-Godot-fe-mb/e5e9852c-d431-468d-8484-b6afcae96b58/scratchpad && python dirs/ux-talk/gen_talk.py && node preview.mjs UxTalk UxTalkChoice UxTalkTwo UxTalkLog
```

Run it after `ux-tavern`: each build re-renders the room from `dirs/ux-tavern/interior.py` (`render(people=False)`), in its own process.

## How it is built

`talk.py` builds the conversation screen once, and `gen_talk.py` makes the four boards with it. `talk_screen(cast, speaker, side, line, choices, pointed, quick, epithet)` composes a board from these parts:

- **The room.** The room is full screen at 1:1, as `room.py` writes it to `cache/room.png`. The source is the tavern builder's empty interior. If that module is missing or fails, the source falls back to the px-town street, dimmed flat. The final boards use the interior.
  - The room is a backdrop, a step down at `brightness(.8) saturate(.9)` (as Hades sets its box over a dimmed room), so the hearth fire between the two people does not compete with the one speaking. The stands and the box keep their own light.
- **The stands.** Each stand is `Stand(sprite, role, x)`. The ComfyUI full art (`game/public/sprites/units/<sprite>.png`) is resized once with Pillow LANCZOS and embedded at 1:1 as WebP with alpha.
  - Nothing is drawn, repainted or mirrored.
  - Each stand is cut at the box's foot, so it shows from the head to the hips above the box.
  - The kit's 1 px ink edge (`f64-ol1`, as `cutin()` uses) sits each stand on the pixel room.
  - **The speaker:** scale 0.80, eye line at y 206, drawn in front, unfiltered.
  - **The listener:** scale 0.63, eye line at y 250, drawn behind, so its head top sits 45 px or more under the speaker's. It is dimmed to a target, not by one fixed filter: its mean luma over its alpha (the rows above the box) is brought to 0.6 of the speaker's, and never above `brightness(.56)`. One fixed filter gave gold-armoured roy and dark-cloaked kael very different results. Saturation drops with it: `saturate(.55)` for roy (gold and orange), `.75` for the rest. Measured on the composited boards: The Foundling 36 against Kael 60 (0.60, at `brightness(.442)`), Kael 35 against Daren 78 (0.45, at the `.56` cap). It is a display state on the img, the way the game's own `.talk-bust` is. The file is not recoloured.
- **The box.** The box follows Ren'Py's frame: full width, 168 tall, ending at y 706. The reading column is 720 wide and centred (x 280 to 1000), and the line is s20 regular.
  - The name plate is the kit's tag frame with `person()` in straw. It rides the box's top edge at the speaker's end of the column.
  - The advance mark is a brass wedge at the end of a finished line.
  - The quick menu, History · Auto · Skip, sits centred at the foot in s14 dim. Auto "on" is straw with the kit's brass square.
- **The choice list.** `answers()` is one window sized to its longest row (key cap, answer, note, 24 px padding) and centred in the gap between the two people's solid outlines across its rows, 34 px above the box, so it sits over the room and not over a body. Each row is 40 px with a number key and the answer in s18. The pointed row has the kit's hover: a band, the brass arrow and straw text. An answer whose path reaches the end without starting anything carries a quiet note, "ends the talk", in s13 dim (no brass, no badge).
- **The History screen.** `history()` is a modal over the scrim, seated above the box, so the line you return to shows whole beneath it.
  - The eyebrow gives the place and the room, and the title is "History".
  - The log runs in CSS flow, anchored to its foot (opened at the latest line).
  - Names are right-aligned in a 150 px column, as in Ren'Py. The company's answers are its lead's lines: the name in rill, the line in the body ink like every other line (blue body text in a read-only log reads as a link).
  - One brass way back, with Esc after it, as UxTavern's way-back row has it.

## The boards

### UxTalk: read Kael's line

- **State:** Blood Ties, the "explain" node, at Pine Crossing's tavern.
- **Focal point:** Kael, lit and forward on the right, then his plate, then the line: "My brother Daren fell in with a bandit gang. They've been raiding travelers on the road near Frontier Camp."
- **The Foundling** listens on the left, a step back and dimmed, looking at Kael.
- **The act:** the advance mark (Space, Enter or a click). There is no button.
- **Way in:** UxTavern, pointing at Kael: "Talk" on his card, his number (1), or a click on him. Kael's first line ("start") comes first; this is his second.
- **Way out:** the talk's own answers, on UxTalkChoice. Esc opens the pause menu (UXREFS 2.2 and the key map).

### UxTalkChoice: what do we say?

- **State:** Kael's "request" line stays in the box, without an advance mark.
- **The answers** are in a centred, numbered list: 1 "We'll bring him back alive.", 2 "What's in it for us?" (pointed at) and 3 "Not our problem."
- **No check tags:** the three answers carry no check or cost in the data (`effects: []`), so none is drawn.
- **"ends the talk"** sits on answer 3 only, in the secondary ink: its path goes to "decline" and then to the end without starting anything. Answer 1 also reaches the end, but through "accept", which starts the quest, so it is not marked. The note is derived in `gen_talk.py` (`ends()`), not written by hand.
- **No brass button:** the answers are the acts (number keys 1 to 3). The quick menu stays, so History can be read before answering.
- **Way in:** advance from UxTalk.
- **Way out:** answer 3 ("Suit yourself. I'll be here if you change your mind.", then back to the tavern room). It is the last row, as Warband's leave row is.

### UxTalkTwo: two people on stage

- **State:** the reunion back at the tavern, the "daren_speaks" node: "Kael...? I thought you'd given up on me."
- **Daren** is forward and lit on the left, looking at his brother. His plate says once who he is: "Daren · Kael's brother", from Kael's "My brother Daren".
- **Kael** stands beside him on the right, a step back and a ramp darker. He keeps the side he had in the first talk.
- **The quick menu** has Auto running, which shows the toggle's state.
- **The act:** the advance mark.
- **Way in:** Daren captured on the field, then back at the tavern.
- **Way back:** none. The beat must be heard: it ends the quest and Kael joins. It closes on "Put a name to the band.", then the name prompt.

### UxTalkLog: what was said?

- **State:** the History screen, opened from the quick menu at Kael's offer, after "What's in it for us?".
- **The five lines so far:** Kael's start, explain and request lines, The Foundling's "What's in it for us?" (his name in rill), and Kael's offer last.
- **The way back:** the one brass primary, "Back to the conversation", then Esc.
- **Behind it:** the conversation, dimmed. The offer is in the box with its two answers, behind the modal.

## Who stands where, and why

- **The art faces the viewer's right.** All three ComfyUI stands are front-on, with their eyes or heads turned toward the viewer's right.
  - The game mirrors the right-hand bust (`overlays.css .talk-bust--right`). UXREFS 1.7 reads the brief's "never edit" as no mirroring, and I followed it.
  - So the one who looks at someone stands on the left.
  - At Kael's table, The Foundling is on the left, looking at Kael. Kael is on the right, facing the room: he is addressing the company.
  - At the reunion, Daren is on the left, looking at his brother. Kael is again on the right.
- **Nobody moves between lines.** Only the light changes (UXREFS 1.7).
- **The plate sits on the speaker's side.** That is the game's own rule (`DialogueOverlay.tsx`: the plaque and the lighting must agree).

## Left off, and where it lives

- **The place label and a way back** are off the say and choice screens.
  - Ren'Py's say screen has all other UI off (UXREFS 1.5), and Esc in a conversation opens the pause menu (UXREFS 2.2).
  - The room is the place, and the History's eyebrow names it ("Pine Crossing · the tavern").
  - The way out of a talk is its own last answer.
- **Gold, food, HP and the roster** are not needed to read or answer a line. They live in the town header, the inn and the person screens. Kael's offer names 80 gold; the purse does not decide it.
- **Faces in the History** are left off (Ren'Py shows names only). The people are on the conversation screen itself.
- **Kael's table, the barkeep and the bounty desk** are on UxTavern. The conversation uses the room with the two who can be talked to taken out (`people=False`). The final interior keeps its seated drinkers at the bar as part of the room; they are small, far back and dimmed with it, so the people on stage are the only ones who read as people in the scene.
- **Kael's kit and stats** live on his person screen once he joins.
- **The contract** that "accept" starts lives in Contracts, not on the talk.
- **Text speed and auto delay** belong in the pause menu's settings.

## References, and what was taken from each

- **Ren'Py default screens** (UXREFS 2.1, 2.2):
  - the box frame, its height and the centred reading column;
  - the name plate on the box's top edge;
  - the quick menu at the bottom centre, trimmed to History · Auto · Skip;
  - the choice list centred above the box, with the question kept in the box;
  - History opened at the bottom, with names right-aligned at about 150 and lines from about 170;
  - Esc opening the game menu.
- **Fire Emblem supports** (Awakening, Fates, GBA): two people on stage for the whole scene, the name tab on the speaker's side, and the lit speaker.
- **Fire Emblem: Three Houses and Triangle Strategy:** the advance mark; Auto, Log and Skip on the box. Triangle Strategy's profile pop-up on a first appearance became Daren's epithet.
- **Disco Elysium, Pillars of Eternity and Baldur's Gate 3:** numbered answers picked by number key, with checks written on the row. None apply here.
- **Mount & Blade: Warband:** the leave answer last.
- **Hades:** the speaker large, with the box along the bottom over the room.
- **The game's own `DialogueOverlay.tsx`:** the plaque on the speaker's side, the chest-up crop logic, and the bust rule (see the game changes below).

## Game changes these boards need

1. **Story and quest talk becomes a full-screen visual-novel screen over its room.** Today `DialogueOverlay` puts busts over a dimmed, blurred world. The dialogue, or its trigger, needs to name its room (here the tavern interior). Road events keep the pop-up.
2. **Staging.** `bustsAfter` seats every party-team character on the left. That puts Kael, a recruit on the party team, on the left, and The Foundling is never on stage unless he speaks.
   - The boards need optional stage directions per dialogue, for example `"stage": {"mc": "left", "kael": "right"}` and `{"daren": "left", "kael": "right"}`.
   - The company's lead stands in as the listener in a talk the company has.
   - The art is never mirrored (drop `scaleX(-1)` on `.talk-bust--right`).
   - Without directions, today's rule holds.
3. **The listener a step back.** Today the unlit bust is the same size, 10 px lower, at `brightness(.5) saturate(.5)`. The boards use a smaller resize for the listener (0.63 against the speaker's 0.80), drawn behind, with its head top 45+ px lower. Its dim is computed per pair: the listener's mean luma is brought to 0.6 of the speaker's, capped at `brightness(.56)`, with `saturate(.55)` for strongly coloured art (roy) and `.75` otherwise. The game can precompute each sprite's mean luma at build time. The speaker is forward and larger. Nobody moves between lines.
4. **The engine's single "Continue" choice is the advance mark,** not a primary button. Space, Enter or a click goes on, and the first press finishes a typing line.
5. **Answers are a centred, numbered list over the room,** with the question kept in the box. There is no primary among them; today the first answer is brass and the rest secondary.
6. **The quick menu, History · Auto · Skip, is new.**
   - Auto is a toggle with a visible state.
   - Skip runs through seen lines only and stops at a choice.
   - History opens the History screen.
7. **The History screen is new.**
   - It logs every line of the conversation, with the company's chosen answers as its lead's lines.
   - It is reading only: no rollback past a choice.
   - Esc, or "Back to the conversation", closes it.
8. **The epithet on a first appearance is new:** a short "who this is" on the plate the first time a character speaks ("Kael's brother"). It needs an optional `epithet` per character or per node.
9. **Esc in a conversation opens the pause menu.** Today `DialogueOverlay` does not handle Esc.
10. **An "ends" flag on answers.** Derived, not authored: a choice whose path reaches `end` through Continue-only nodes with no `onEnter` and no effects (no `startQuest`) shows "ends the talk" in the secondary ink.
11. **The room behind a talk is drawn a step down,** at `brightness(.8) saturate(.9)`; the stands and the box are not.
12. **Art requests for ComfyUI** (the boards do not edit the art):
    - **Daren:** the `daren` sprite reads as a woman, while the data says "My brother Daren" and the plate says "Kael's brother". Regenerate it with a male prompt, and have the owner confirm before the epithet ships. The lines stay verbatim.
    - **Kael, facing left:** all three stands face the viewer's right, so Kael on the right never looks at the person he talks to (Fire Emblem's supports pair the two facing each other). Request a left-facing `kael` pose; UxTalk, UxTalkChoice and UxTalkTwo take it on the rebuild, with `HEAD['kael']` re-measured.
13. **For the tavern builder** (`dirs/ux-tavern/interior.py`, not editable from here): the long trestle table and its bench have no hard cast shadow one ramp step down, offset down-right, as the writing desk has (PXWORLD: things stand on their contact shadow). Once added, rerun `gen_talk.py`; `room.py` picks it up.

## Where the data and the brief disagree

- **Kael's side.** In the game, Kael's character record is on the party team, so the bust rule would seat him on the LEFT in both talks. The boards seat him on the right; see game change 2.
- **History's scope.** Ren'Py's History is global (250 entries). Per the brief, these boards show this conversation so far.
- **The listener at Kael's table.** The brief's "The Foundling listening" needs the lead on stage, which the engine does not do today (game change 2).

## QA rounds

1. **First render on the stand-in.** The stands' legs showed in the strip under the box, so they are now cut at the box's foot. The listener was too bright (0.64 became 0.56). The answers window covered both faces, so it moved over the torsos. "the latest line is last" was filler and was removed.
2. **After UXREFS.**
   - Mirroring was dropped, and the sides were chosen by the art's facing.
   - The place label and the way back were dropped from the say and choice screens.
   - The quick menu moved to the centre.
   - The History names were right-aligned, and the answers set in rill.
   - The pointed answer's arrow sat on the moulding; the rows moved 10 px in.
   - The History had a phantom second row because the estimate ran 3% wide. It was moved to CSS flow, anchored to its foot.
3. **On the real tavern interior.**
   - NEAREST crops of the stand edges against the plaster, the plate, the box corners and the dimmed listener: clean.
   - The brothers were moved closer, to "beside".
   - The History was seated above the box and its plate, so neither is cut.
   - Checked against PxTownInn and PxCamp: the same frames, type and brass.
   - The screen's job reads in one second on each board.
4. **On the tavern builder's final interior** (the garland, the casks on the back counter, the new tables).
   - Rebuilt; the room is `dirs/ux-tavern/interior.py render(people=False)`, not the stand-in.
   - The Foundling's gold and orange hair still pulled the eye from the lit Kael at `brightness(.56)` alone (measured: 0.55 of the source on the composited board). The listener now also takes `saturate(.75)`, and Kael reads first.
   - NEAREST crops of Kael's hood against the garland and shelves, the Foundling's sword hilt at the box, and the History rows (the line is regular weight, the names bold): clean.
   - The way in matches UxTavern: Kael's card carries "Talk".
5. **After two critics' review.**
   - P1, the listener did not read as dimmed: on UxTalk The Foundling measured 68 against Kael's 75 (0.91), because one fixed filter does different things to gold and to dark art. The listener is now dimmed to 0.6 of the speaker's luma (roy at `brightness(.442) saturate(.55)`), shrunk to 0.63 and dropped to an eye line of 250. Measured on the composited PNG: 36 against 60, 0.60. His hair top sits at about y 183, against Kael's hood at about 125.
   - P1, his head was haloed by the window sky: he now stands at x 231, his head on the plaster pier between the two windows.
   - P1, the choice window was 560 wide for a 230 px answer and sat on both bodies: it is now sized to its rows (370 wide) and centred in the gap between the two solid outlines (x 390 to 760), clear of The Foundling's arm and Kael's belt.
   - P2, the room's hearth competed with Kael: the room is drawn at `brightness(.8) saturate(.9)` on all four boards.
   - P2, the leave answer did not say it leaves: "ends the talk" on answer 3, derived from the data.
   - P2, Daren's face against the notice board's papers: Daren moved to x 400 and Kael to 706; her head is on the wall and pier, clear of the board.
   - P2, the History: Esc moved after the brass way back, as on UxTavern; the chosen answer's line is in the body ink, only the name in rill.
   - P2, Daren reads as a woman and Kael faces out of the scene: recorded as ComfyUI requests (game change 12). The art is not edited.
   - P2, the trestle table's missing shadow: in the tavern builder's file; recorded as game change 13.
   - Not taken: the History eyebrow's top padding. It is the kit's `modal()` (eyebrow at y 14, title at 32), which every modal on the canvas shares; moving it on this board alone would make this one modal differ from the rest. If it is too tight, it is a kit change for all modals.
   - NEAREST crops (4x and 3x) of The Foundling's head against the pier, the choice window's edges and the "ends the talk" note, Daren's head against the wall, the Daren plate, and the History footer: clean.
6. **Final render.** All four boards rebuilt and rendered from `gen_talk.py`; the PNGs match the board files. The one-second read: UxTalk reads Kael first (lit, larger, higher), then the plate and the line; UxTalkChoice reads the three answers between the two people; UxTalkTwo reads Daren; UxTalkLog reads the log and its one way back.
