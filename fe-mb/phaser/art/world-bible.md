# FE_MB — World & Art Bible

The single source of truth for what the world looks like and how we generate its art.
All character / creature / building art is produced locally through **ComfyUI** (see
§3). Per-asset specs live beside this file (`art/characters/*.json`, later
`art/buildings/*.json`); `npm run comfy -- --batch art/characters` generates them.

> **Tone updated 2026-08-28; art NOT re-baked.** §1 below has been rewritten to
> match `docs/worldbuilding/story-bible.md` (the live creative truth) and the
> "Field Ledger" UI direction
> (`docs/superpowers/specs/2026-08-28-ui-retheme-field-ledger-design.md`).
> **§2 (regions), §3's prompt/trigger strings and §4 (cast) still describe the
> earlier premise and have NOT been regenerated** — changing prompt text
> unverified would silently break a cast that is already consistent. What a
> full re-bake would require is listed at the end of §3.

---

## 1. Premise & Tone

A tactical **roguelite of permadeath and scarcity**, played as a **free mercenary
company** — a travelling outfit that exists while it moves. Towns hire it; battles
are jobs and ambushes; misfits join the roster. The player character is a foundling
raised in the company's wagons, who inherits the banner when the Captain is murdered
by his own sworn brother, and hunts him across an open map while the company keeps
taking work to eat.

**Tone:** **grounded medieval — Mount & Blade energy.** No cataclysm, no cosmic
stakes; a handful of petty realms at low-grade border war, endless merc work, no side
purely right. Earthy and working: mud, wool, oiled leather, road dust, daylight.
**Gallows humour over a warm found-family core** — a hard world full of people who
like each other. Stakes are real (the fallen stay fallen), but the register is *not*
despair.

Dragons are the **one** fantastical element and they are **extinct legend** — bones
over castle gates, names on old banners, histories most people treat as myth. Magic
is thin and unglamorous where it appears at all.

**Explicitly NOT:** not bright/cute; not grimdark-gore; and — corrected 2026-08-28 —
**not candle-lit "dark fantasy" grimdark** either. The earlier framing of this
section ("darker things stir deeper in", torch-and-shadow mood) is retired along with
the candle-lit UI skin. Light is **daylight**: it falls, it does not emit.

---

## 2. The World — three regions → the throne

> **PRE-STORY-BIBLE (flagged 2026-08-28, not rewritten).** The three-region tier
> ladder ending at the Iron Throne predates the story bible's **omnidirectional
> open sandbox of petty realms** and its Mercer Kaine final boss. It also predates
> the "Field Ledger" UI, whose page/field grounds are deliberately region-neutral.
> Treat the table below as the CURRENT SHIPPED content (the code and region palettes
> still use it), not as agreed world canon. Reconciling the two is a design task, not
> a docs edit — see §3's re-bake list, item 3.

Each region has a **hard material identity** that drives palettes for its enemies,
gear, and architecture. The run climbs the tiers, then ends at the Iron Throne.

| Region | Tier | Key color | Materials / theme | Mood | Enemies |
|---|---|---|---|---|---|
| **The Borderlands** | 1 | tan / iron-grey `#a07a40` | iron, steel, leather, road-dust | frontier military, mercenary, road-worn | bandits, brigands, wolves |
| **Thornwood Wilds** | 2 | dark green `#3a6a3e` | darkwood, bone, venom-green, shadow | grim mysticism, choking forest, poison | (TBD) thornwood raiders, beasts, hexers |
| **Ashfall Peaks** | 3 | dark red `#7a2010` | obsidian, magma, ember, ash | volcanic, apocalyptic, raw power | (TBD) ashfall raiders, fire-things |
| **The Iron Throne** | — | — | (final) | the seat of the threat; boss | (TBD) the boss |

Architecture follows the same themes: Borderlands = timber + grey stone palisade
towns; Thornwood = mossed stone, bone totems, dark timber; Ashfall = black basalt,
forge-glow, iron.

---

## 3. Art Direction — the House Style (ComfyUI)

**Everything is generated, transparent, full-body, front-facing**, so it drops onto
the board and into the roster cleanly. One recipe keeps the whole game coherent.

**Model / pipeline** (captured at `scripts/cli/comfy/template.workflow.json`):
- Checkpoint `waiIllustriousSDXL_v160` + LoRA `DarkFantasy-PixelSprite` (**trigger `DFSV1`**), strength 0.8.
- KSampler 30 steps, cfg 7, `dpmpp_2m` / `karras`, 832×1216.
- `RemBGSession+ → ImageRemoveBackground+ → SaveImageWithAlpha` (auto-transparent).

**Prompt structure** — `comfy-gen` prepends a fixed preamble; each character file's
`prompt` supplies the *subject*:
```
[quality tags], DFSV1, sprite, pixel art,
solo, full body, front view, looking at viewer, plain background,
<SUBJECT: who they are, hair, clothing/armor, weapon, expression, region accent>
```
Negative (fixed): `worst quality, lowres, bad hands, simple background, text,
signature, chibi, multiple characters, complex background, blurry, realistic,
3d render, watermark, deformed`.

**Consistency rules (the "house style"):**
- Always **one character, full body, front view, plain/transparent background**.
- **Dark-fantasy pixel-sprite** look — cohesive, slightly desaturated, weathered;
  steer away from glossy-anime via the negative + notes if it drifts.
- **Palette anchored to the region** the unit belongs to (Borderlands iron/steel for
  the starters; enemies/buildings pick up their region's materials from §2).
- **Readable silhouette + class identifier** (lord=cape/circlet+sword, knight=heavy
  plate+lance/shield, mage=robe+staff/orb/tome, archer=bow+light leather, etc.).
- Consistent scale/proportion across the roster (so a knight reads bigger than a mage).

**Output → board:** sprites generate large (832×1216). A later pipeline step will
trim + downscale each to a consistent on-tile size; for now we lock the *look*.

**Tone steer (2026-08-28, note only — no prompt text changed).** The strings above
are the ones the existing cast was generated from; they are deliberately untouched.
When the next bake happens, steer the *subject* line (not the preamble, not the
trigger, not the negative) toward §1's register: working clothes over heroic armour,
earth/wool/leather over black-and-ember, daylight key over torchlight, weathered but
not ghoulish. `DarkFantasy-PixelSprite` / `DFSV1` is the LoRA's technical name — it
is not a licence to render grimdark mood.

**What a full art re-bake would require** (deliberately NOT done here — untestable
from a docs pass):
1. A tone-steer A/B on 2–3 existing characters (same seed, subject line edited) rated
   in `npm run sprite-lab`, to prove the steer moves the look without breaking the
   house style — the LoRA may simply pull back to its trained mood.
2. A decision on whether the preamble/negative need a daylight or palette term at all,
   or whether the subject line carries it. Only change the fixed preamble if (1) shows
   the subject line can't.
3. Re-deriving §2's region material identities against the story bible's petty-realms
   map (the three-region tier ladder + Iron Throne predates it) — see §2's note.
4. Re-deriving §4's cast against the story bible's roster (foundling MC, Corwin Vale,
   Mercer Kaine, Bagrat "Oak", Cassius Merrow) — see §4's note.
5. Re-approving every `status: "approved"` character afterwards, since the whole point
   of one recipe is that the roster stays coherent — a half-rebaked cast is worse than
   either end state.

---

## 4. The Cast (roster → `art/characters/<id>.json`)

> **PRE-STORY-BIBLE (flagged 2026-08-28, not rewritten).** This roster is the FE6
> homage cast (Roy / Marcus / Lilina). The story bible locks a different one — an
> authored, player-named **foundling** MC, Captain **Corwin Vale**, traitor
> **Mercer Kaine**, **Bagrat "Oak"** as first companion, **Cassius Merrow** as a
> turnable sub-boss — with companions recruited BG3-style through main and faction
> quests rather than as shop-row hires. The names below are what the game files and
> generated sprites currently contain (name hardcoding was removed in e157814; unit
> **ids** are the identity key), so they stay until a deliberate content pass swaps
> them. Do not half-migrate.

Appearances below are **drafts** — the open part we're deciding now. Edit the files
(or tell me) and regenerate.

### Allies — player units
- **Roy** (`roy`) — **Lord**, company leader. Earnest young commander; the logistics/
  rally voice. *Draft look:* short tousled red-orange hair, blue cape, light steel-and-
  leather armor with a noble crest, circlet, ornate sword.
- **Marcus** (`marcus`) — **Knight** (veteran). The tactical, defensive voice; warns of
  ambushes. *Draft look:* greying veteran, heavy weathered steel plate, red cape, scar,
  cavalry lance.
- **Lilina** (`lilina`) — **Mage**, scholar. Gathers rumors; diplomatic intelligence.
  *Draft look:* young noble, long pale-blue hair, blue-and-gold robe, staff with a
  sapphire orb / tome.
- **Garrik** (`garrik`) — **Knight** recruit (Pine Crossing). *"A grizzled veteran
  looking for steady pay."* Battered iron armor, mercenary, no-nonsense.
- **Lyra** (`lyra`) — **Mage** recruit. *"A traveling scholar with a small bag of
  tricks."* Worn traveling robe, scroll satchel, curious wanderer.
- **Kael** (`kael`) — **Bounty Hunter** recruit (quest "Blood Ties"; joins if Daren is
  captured). *"A hooded bounty hunter nursing a drink alone."* Dark hooded cloak,
  daggers/crossbow, brooding, weathered.

### Enemies — Borderlands (tier 1)
- **Bandit** (`bandit`) — rugged road brigand; leather + fur, heavy notched axe, scarred.
- **Bandit Archer** (`bandit_archer`) — wiry, hooded, shortbow + quiver, sneering.
- **Brigand Chief** (`brigand_chief`) — the leader variant; better gear, fur cloak, big
  weapon, cruel/commanding.
- **Wolf** (`wolf`) — lean grey dire-wolf, bristling, snarling, pale eyes.
- **Daren** (`daren`) — named capture target, **Kael's brother**. Younger bandit, lighter
  gear, a desperate/conflicted edge (he's meant to be taken alive — a tragic beat).

### Later
Thornwood + Ashfall enemy sets, regional bosses, and **The Iron Throne** boss — defined
once we reach those regions, each in its region's material palette.

---

## 5. Asset pipeline & file format

**Per-character file** (`art/characters/<id>.json`):
```json
{
  "id": "roy", "name": "Roy", "side": "ally", "class": "lord",
  "role": "company leader",
  "canon": "what the game's files actually establish (don't contradict)",
  "appearance": "the visual description (the open, editable part)",
  "personality": "for flavor + future portrait/voice",
  "prompt": "the SUBJECT string fed to ComfyUI (compiled from appearance)",
  "status": "draft"            // draft -> generating -> approved
}
```
- **Generate:** `npm run comfy -- --batch art/characters` (skips `approved`), or one at
  a time `npm run comfy -- --id roy --prompt "..."`.
- **Rate:** `npm run sprite-lab` → tag ★/✓/✕ + notes → `ratings.json`; notes refine the
  `prompt`. Repeat until a sprite is right, then set `status: "approved"`.
- **Buildings** will use the same flow (`art/buildings/*.json`) with region palettes.

**Roads / terrain are the hard exception:** they must *tile and connect*, which a
one-off transparent sprite can't do. Plan (deferred): a tileset approach — either a
CC0 tileset, or a tiling-aware ComfyUI pass + manual seam-fixing — handled separately
from the character pipeline. Flagged, not solved.

---

## 6. Status

- **Tone (§1)** = updated 2026-08-28 to the story bible + Field Ledger direction.
- **Art direction (§3 recipe)** = unchanged and still **drafting**; no prompt text
  was touched by the tone update. Re-bake prerequisites are listed at the end of §3.
- **World (§2) and cast (§4)** = pre-story-bible, flagged in place, awaiting a
  deliberate content pass.
- **Characters** = drafted, awaiting appearance sign-off + generation. Update
  `status` per character as we approve them.
