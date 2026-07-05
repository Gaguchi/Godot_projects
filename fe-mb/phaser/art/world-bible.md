# FE_MB — World & Art Bible

The single source of truth for what the world looks like and how we generate its art.
All character / creature / building art is produced locally through **ComfyUI** (see
§3). Per-asset specs live beside this file (`art/characters/*.json`, later
`art/buildings/*.json`); `npm run comfy -- --batch art/characters` generates them.

---

## 1. Premise & Tone

A tactical **roguelite of permadeath and scarcity**. A small company — *"three souls
bound by duty"* — is charged with crossing a collapsing frontier before winter seals
the mountain passes. Bandits prey on the roads; older, darker things stir deeper in.

**Tone:** grounded medieval **dark fantasy** with an arcane edge. Weathered, lived-in,
a little grim — not bright/cute, not grimdark-gore. A Fire Emblem homage (the cast
nods to FE6) but its own world. Stakes are real: the fallen stay fallen.

---

## 2. The World — three regions → the throne

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

---

## 4. The Cast (roster → `art/characters/<id>.json`)

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

Art direction (this bible) = **drafting**. Characters = drafted, awaiting appearance
sign-off + generation. Update `status` per character as we approve them.
