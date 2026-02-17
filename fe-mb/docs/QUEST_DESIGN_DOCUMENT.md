# FE_MB Quest Design Document — The Borderlands

## Overview

This document defines the complete quest content for the Borderlands region: a **9-stage main questline** and **6 side quests** distributed across the map's 5 towns, 8 camps, 1 dungeon, and 1 exit.

**Design goals:**
- Main questline guides the player through every town and the dungeon in a natural order
- Side quests are optional but rewarding — they prepare the player for harder main quest stages
- Every quest is permadeath-safe (no specific unit requirements)
- Quests use the existing flag + dialogue systems — no new engine features needed for basic flow

---

## Map Reference

```
         Miller's Rest (CAMP)
              (7,2)
                |
Pine Crossing---Northern Bridge-------Eastern Farm (CAMP)---Borderkeep Castle
  (TOWN 3,5)     (TOWN 7,5)              (14,5)              (TOWN 21,5)
      |               |                    |                      |
Frontier Camp---Central Crossroads---Hilltop Watchtower      Eastern Gate
  (CAMP 3,8)     (CAMP 7,8)          (CAMP 14,8)         (EXIT 21,8)
      |               |                    |
      |          Riverside Market-----Stone Ruins (DUNGEON 18,8)
      |            (TOWN 10,8)
      |               |
South Junction---Southern Shrine---Forest Edge---Far South Road
  (TOWN 5,11)    (CAMP 5,14)     (CAMP 10,14)   (CAMP 18,14)

Spawn: (2,9) — near Frontier Camp / Pine Crossing
```

---

## New Mechanics: Subdue & Bounties

### Subdue (Universal Combat Skill)

Every unit has access to the **Subdue** action in combat alongside Attack and Wait.

- **Range:** 1 tile (melee only — even ranged units must close the distance)
- **Cost:** Uses the unit's action for the turn
- **Effect:** Attempts to capture/tie up the target enemy. Does NOT deal damage.
- **On success:** Enemy is bound — shown tied up on their tile. Cannot act, removed from combat.
- **On failure:** Nothing happens. The unit's turn is wasted.

**Success Rate (based on target's current HP %):**

| Enemy HP % | Base Rate | Bounty Hunter Rate |
|-----------|-----------|-------------------|
| 50%+ | 0% | 15% |
| 40-50% | 10% | 30% |
| 25-40% | 30% | 60% |
| 10-25% | 60% | 85% |
| 1-10% | 85% | 100% |
| <5% | 100% | 100% |

**Untie Mechanic:** Any enemy adjacent to a bound ally can spend their full turn to free them. The freed unit returns at whatever HP they had when captured.

**Tactical Implications:**
- Players must weaken enemies without killing them — overkill wastes a potential capture
- Zone control matters — block enemies from reaching captured units
- Ranged units must risk entering melee range to attempt Subdue
- Risk/reward: spend a turn on capture (might fail) vs. guaranteed kill

### Bounty System

Captured enemies can be turned in at town **bounty boards** for gold.

**Bounty Payouts:**

| Unit Type | Bounty |
|----------|--------|
| Generic L1-2 | 15-25 gold |
| Generic L3-4 | 30-50 gold |
| Named / Mini-boss | 80-150 gold |
| Special bounty target (quest-attached) | 200+ gold |

- Bounty boards appear in town taverns (doubles as the quest board)
- Some special bounty targets appear on the board BEFORE the player encounters them, creating incentive to capture rather than kill
- Higher-level units and named characters have higher bounties
- Certain special targets may trigger follow-up quests when turned in

---

## Main Questline: "The Eastern March"

### Theme & Arc

The party is a small warband pushing east through the Borderlands to reach the Eastern Gate — a mountain pass leading to the kingdom beyond. But the road is not simply long; it's contested. Bandits control the southern routes, an ancient curse festers in the Stone Ruins, and Borderkeep Castle's garrison is stretched thin. The party must secure their passage by dealing with the region's threats — or push through unprepared and hope for the best.

**Tone:** Grounded dark fantasy. No chosen-one prophecy. The party are capable fighters trying to survive a dangerous journey. Their choices determine whether they leave the Borderlands as heroes or merely survivors.

### Critical Path (Required Route)

```
Pine Crossing → Northern Bridge OR Riverside Market → Riverside Market →
Stone Ruins area → Stone Ruins (dungeon) → Borderkeep Castle → Eastern Gate
```

The player MUST visit Pine Crossing first (it's adjacent to spawn). After that, the order of the middle stages has some flexibility. The dungeon and Borderkeep are required late-game.

---

### Stage 1: "Arrival at the Crossroads"
**Type:** Automatic (triggers on first visit to Pine Crossing)
**Location:** Pine Crossing (TOWN 3,5)

**Hook:** The party arrives at Pine Crossing, the first settlement in the Borderlands. The innkeeper greets them and explains the lay of the land: the Eastern Gate is far to the east, and the roads are dangerous. He recommends talking to people in the tavern for information.

**Objective:** Visit Pine Crossing's tavern (automatic on entering town menu).

**Resolution:** Tavern dialogue introduces three threads:
- "The road east through Riverside Market is the main trade route, but bandits have been hitting caravans."
- "Northern Bridge has a garrison — they might have news about safe passage."
- "Nobody goes near the Stone Ruins anymore. Strange things happen there at night."

Sets the player's direction: head to Northern Bridge or Riverside Market next.

**Rewards:** None (introduction stage)

**Flags:**
- Sets: `main_quest_active`, `main_quest_stage_1`
- Checks: Nothing

---

### Stage 2: "The Road Ahead"
**Type:** Location visit (Northern Bridge OR Riverside Market)
**Location:** Northern Bridge (7,5) or Riverside Market (10,8) — either advances the quest

**Hook:** Following the tavern leads from Pine Crossing.

**Objective:** Visit either Northern Bridge or Riverside Market and speak to the tavern.

**Resolution (Northern Bridge path):**
The bridge garrison commander tells the party that a patrol went to investigate the Stone Ruins weeks ago and never returned. He asks the party to look into it if they're heading east. He also warns that Borderkeep Castle won't grant passage through the Eastern Gate to just anyone — they'll need to prove their worth.

**Resolution (Riverside Market path):**
A merchant in the tavern says trade has dried up because of two problems: bandits on the southern road, and "something foul" near the Stone Ruins that's scaring off travelers. She mentions that Borderkeep's lord has put out a bounty on the ruins — clearing them would earn passage through the Gate.

Both paths converge: the Stone Ruins are the key, and Borderkeep controls the Gate.

**Rewards:** 30 gold (information payment from NPC), +3 food
**Flags:**
- Sets: `main_quest_stage_2`, `main_quest_knows_ruins`
- Optional: `main_quest_visited_bridge` or `main_quest_visited_market`

---

### Stage 3: "Gathering Strength"
**Type:** Visit + dialogue
**Location:** Riverside Market (10,8) — if not visited in Stage 2, this is the required stop

**Hook:** Whether the player came from Northern Bridge or arrived here directly, Riverside Market is the last major settlement before the wilderness east.

**Objective:** Visit Riverside Market. A special dialogue triggers in the tavern: a retired soldier offers tactical advice about the Stone Ruins — "the dead walk there, but they're slow. Fire and faith work best against them." He also mentions that the ruins have a sealed inner chamber that requires a key held by the Borderkeep garrison.

**Resolution:** The player now knows:
1. Stone Ruins enemies are undead (combat hint)
2. They need the "Ruins Key" from Borderkeep — OR they can force the door (harder fight)
3. The direct path east goes through dangerous wilderness

This creates a routing decision: go to Borderkeep first for the key (longer but easier dungeon), or head straight to the ruins (shorter but harder).

**Rewards:** Free inn rest (the soldier buys them a night), combat intel
**Flags:**
- Sets: `main_quest_stage_3`, `main_quest_knows_key`
- Checks: `main_quest_stage_2`

---

### Stage 4: "Into the Wilds"
**Type:** Travel encounter (forced, triggers during travel toward Stone Ruins area)
**Location:** Travel event — triggers on any hop between Hilltop Watchtower and Stone Ruins

**Hook:** As the party approaches the eastern wilderness, they encounter a wounded scout from Borderkeep crawling toward safety.

**Objective:** Dialogue encounter. The scout tells the party that the Stone Ruins have gotten worse — the undead are now emerging at night and attacking travelers. He gives them a rough map of the ruins' layout. The player chooses:
- **Help him back to camp** → Costs 1 food, sets `helped_borderkeep_scout` (Borderkeep reputation later)
- **Take his info and move on** → No cost, no flag
- **Heal him** (requires unit with MAG 6+) → Sets `helped_borderkeep_scout`, no food cost

**Resolution:** The party now has context for the dungeon. This encounter ensures the player gets the story beat even if they skipped optional dialogue.

**Rewards:** Map info (flavor), potential reputation flag
**Flags:**
- Sets: `main_quest_stage_4`
- Optional: `helped_borderkeep_scout`
- Checks: `main_quest_stage_3`
- Travel event condition: `has_flag: main_quest_stage_3` AND `not_flag: main_quest_stage_4`

---

### Stage 5: "The Sealed Gate"
**Type:** Conditional — two paths based on player route

**Path A: Player goes to Borderkeep first**
**Location:** Borderkeep Castle (21,5)

The castle's lord recognizes the party (especially if `helped_borderkeep_scout` is set — bonus dialogue). He provides the Ruins Key and promises passage through the Eastern Gate if the party clears the dungeon.

- Sets: `has_ruins_key`, `main_quest_stage_5`, `borderkeep_alliance`
- Reward: Ruins Key (flag), 50 gold advance, Steel Lance (if `helped_borderkeep_scout`)

**Path B: Player goes to Stone Ruins directly**
**Location:** Stone Ruins (18,8)

The dungeon entrance is sealed. Without the key, the party must force entry (sets a flag that makes the first dungeon fight harder — extra enemy wave). A stat check (STR 12+) bypasses the door; failure means a harder fight.

- Sets: `forced_ruins_entry`, `main_quest_stage_5`
- No key reward — but saves travel time

**Flags:**
- Checks: `main_quest_stage_3` or `main_quest_stage_4`
- The dungeon location checks `main_quest_stage_5` to allow entry

---

### Stage 6: "The Stone Ruins"
**Type:** Dungeon clear
**Location:** Stone Ruins (18,8)

**Hook:** The party enters the Stone Ruins — the game's first (and currently only) dungeon.

**Objective:** Clear the dungeon. The dungeon has 3-4 rooms of increasing difficulty:
1. **Entrance hall** — Skeletons (basic undead enemies, weak to magic)
2. **Collapsed corridor** — Skeleton archers + environmental hazard (narrow tiles)
3. **Inner sanctum** — Undead Knight boss (high DEF, moderate SPD, hits hard)
4. **Sealed chamber** (if `has_ruins_key`: treasure room. If `forced_ruins_entry`: extra skeleton wave before boss)

**Resolution:** After the boss falls, the party finds evidence of what caused the curse — a dark artifact. They can:
- **Destroy it** → Sets `ruins_artifact_destroyed` (Borderkeep rewards favor, safe ending)
- **Keep it** → Sets `ruins_artifact_kept` (powerful but dark — could have consequences in future regions)

**Rewards:**
- Boss drop: Runed Blade (unique sword, +2 might over Steel Sword, slight crit bonus)
- Sealed chamber treasure: 200 gold + Elixir (if had key), or 100 gold (if forced entry)
- Main quest progress

**Flags:**
- Sets: `main_quest_stage_6`, `stone_ruins_cleared`
- Sets: `ruins_artifact_destroyed` OR `ruins_artifact_kept`
- Clears: dungeon lock (Stone Ruins becomes visitable camp afterward)

---

### Stage 7: "Borderkeep's Judgment"
**Type:** Town visit + dialogue
**Location:** Borderkeep Castle (21,5)

**Hook:** With the ruins cleared, the party heads to Borderkeep to claim passage through the Eastern Gate.

**Objective:** Visit Borderkeep Castle. The lord's response varies based on prior choices:

**If `borderkeep_alliance` + `ruins_artifact_destroyed`:** Full honors. The lord grants free passage, provides supplies, and offers a recruit (Cavalier unit).

**If `borderkeep_alliance` + `ruins_artifact_kept`:** The lord is suspicious. He grants passage but no extras. Tavern NPCs whisper about the party.

**If no alliance + `ruins_artifact_destroyed`:** The lord is grateful but cautious. Grants passage, provides some gold.

**If no alliance + `ruins_artifact_kept`:** Tense confrontation. The lord demands the artifact. Player can hand it over (passage granted, lose artifact buff) or refuse (must fight a garrison squad to leave, then passage is forced).

**Rewards:**
- Best case: Free passage + recruit + 150 gold + supplies (5 food)
- Worst case: Forced passage (after combat) + no reward

**Flags:**
- Sets: `main_quest_stage_7`, `eastern_gate_unlocked`
- Checks: `borderkeep_alliance`, `ruins_artifact_destroyed`/`kept`, `helped_borderkeep_scout`

---

### Stage 8: "The Eastern Gate"
**Type:** Location visit + final encounter
**Location:** Eastern Gate (21,8)

**Hook:** The party makes for the gate. But the road isn't clear yet.

**Objective:** Travel to the Eastern Gate. A **forced travel encounter** triggers on the final hop:

The gate's approach is ambushed by a large bandit force — the same brigands that have been plaguing the region, making their last desperate play. This is the climactic combat encounter.

**Enemy composition:** Scaled based on party strength:
- 3 Brigand Fighters (L3)
- 2 Brigand Archers (L2)
- 1 Brigand Captain (L4, Knight class, high DEF)

If `ruins_artifact_kept`: The artifact pulses during battle — all party units get +2 STR for the fight (dark power buff, foreshadowing consequences).

**Resolution:** After winning, the party reaches the Eastern Gate. Final dialogue:

A brief cutscene — the gate opens, the road beyond stretches into mist. The party steps through.

**If most side quests completed:** "The Borderlands were safer for their passing."
**If few side quests:** "They left as they arrived — survivors, nothing more."
**If artifact kept:** "The dark artifact hummed in their pack, a power not yet understood..."

**Rewards:** Victory screen with run stats. End of Borderlands region.

**Flags:**
- Sets: `main_quest_complete`
- Checks: `eastern_gate_unlocked`, `main_quest_stage_7`

---

## Side Quests

### SQ1: "Blood Ties" (Capture Tutorial + Recruitment)
**Source:** Pine Crossing tavern — available immediately (earliest side quest)
**Hook:** A hooded bounty hunter named Kael sits alone in the tavern. She asks the party to help capture a bandit named Daren — her younger brother who fell in with a gang operating near Frontier Camp. "He's an idiot, not a monster. I want him alive."

**Objective:** Travel toward Frontier Camp (3,8). A forced travel encounter triggers: Daren's gang.

**Enemy Composition:**
- 2 Brigand (L2)
- 1 Brigand Archer (L2)
- **Daren** (Fighter L2, flagged as capture target) — starts in back row

**Tutorial Design:** Daren starts behind his allies. The player naturally fights through the front line first, learning basic combat. When they reach Daren, the quest objective encourages using Subdue — teaching the capture mechanic organically. If the fight drags, surviving allies may attempt to untie captured units, teaching that mechanic too.

**Outcomes:**
- **Daren captured (perfect):** Kael takes custody of Daren. Grateful dialogue: "I owe you more than gold." She offers to join the party. Player receives Daren's bounty (50 gold). First bounty board interaction at Pine Crossing explains the turn-in system for any other captured bandits.
- **Daren killed (partial):** Kael is visibly upset. Pays 80 gold. "You did what you had to." Leaves. No recruit.
- **Bonus:** Any OTHER bandits captured in this fight can be turned in at Pine Crossing for bounty gold (15-25 each) — first bounty board tutorial.

**Kael — Bounty Hunter (New Class, Archer variant):**
- **Weapon:** Bow (Range 2)
- **Level:** 3
- **Stats:** High SKL, good SPD, moderate STR. Fills the ranged gap in starting party (Lord/Knight/Mage).
- **Passive — Tracker:** Improved Subdue success rates (see Subdue table above). The bounty hunter column applies to Kael specifically.

**Rewards:**
- Perfect: 50 gold (Daren's bounty) + Kael (Bounty Hunter L3) + extra bounty for other captures
- Partial: 80 gold, no recruit

**Difficulty:** Easy-Medium — designed as the first introduction to the capture mechanic
**Flags:** `sq_blood_ties_active`, `sq_blood_ties_daren_captured`, `sq_blood_ties_daren_killed`, `sq_blood_ties_complete`, `sq_blood_ties_kael_recruited`

---

### SQ2: "Wolf Problem" (Bounty)
**Source:** Pine Crossing tavern rumor / quest board
**Hook:** "Wolves have been attacking travelers on the northern road near Miller's Rest."

**Objective:** Travel to Miller's Rest (7,2) area. A forced travel encounter triggers: wolf pack battle (3 Wolves L2 + 1 Alpha Wolf L3, higher stats than normal wolves).

**Resolution:** Return to Pine Crossing. The innkeeper rewards the party.

**Rewards:** 80 gold, +3 food
**Difficulty:** Easy — good first side quest
**Flags:** `sq_wolves_active`, `sq_wolves_complete`

---

### SQ3: "The Missing Caravan" (Investigation)
**Source:** Pine Crossing tavern rumor
**Hook:** "A merchant caravan went missing near Thornwood — the southern forests."

**Objective:** Multi-stage:
1. Travel to Forest Edge (10,14). Travel encounter: find the wrecked caravan. Set `sq_caravan_found_wreck`.
2. Examine the wreck (dialogue). Clues point to brigands from the south, not wolves.
3. Travel to South Junction (5,11). Tavern dialogue: a shady merchant offers to "sell back" the caravan goods for 100 gold.
   - **Pay 100 gold** → Get the goods, quest complete (peaceful resolution)
   - **Refuse and threaten** → Stat check (STR 8+). Success: he gives up the goods. Failure: he flees, quest fails.
   - **Report to Pine Crossing** → Sets flag, Pine Crossing innkeeper gives 50 gold for the info. Partial completion.

**Rewards:**
- Full success: 150 gold worth of recovered trade goods + merchant discount at Riverside Market (10% off)
- Partial (report only): 50 gold + reputation
- Paid ransom: Trade goods but net -100 gold cost

**Difficulty:** Medium — requires visiting 2-3 locations
**Flags:** `sq_caravan_active`, `sq_caravan_found_wreck`, `sq_caravan_complete`, `sq_caravan_paid_ransom`

---

### SQ4: "Strange Lights" (Investigation / Unlock)
**Source:** Northern Bridge tavern rumor
**Hook:** "Strange lights have been seen in the northern gorge near Miller's Rest at night."

**Objective:** Multi-stage:
1. Travel to Miller's Rest (7,2). Night encounter (dialogue): the party sees ghostly lights leading into a hidden cave.
2. Follow the lights (dialogue choice):
   - **Follow** → Discover a hermit mage's abandoned sanctum. Loot: Thunder tome + 80 gold + lore about the Stone Ruins curse (sets `sq_lights_found_sanctum`, gives bonus info for main quest Stage 6).
   - **Ignore** → Quest ends, small XP flavor text.
3. If sanctum found: a journal inside reveals the curse was caused by a war-era sorcerer. This info makes the dungeon boss fight easier (boss starts with -2 DEF if `sq_lights_found_sanctum`).

**Rewards:** Thunder tome, 80 gold, dungeon boss debuff
**Difficulty:** Easy-Medium — exploration reward
**Flags:** `sq_lights_active`, `sq_lights_found_sanctum`, `sq_lights_complete`

---

### SQ5: "Brigands of the Southern Pass" (Bounty + Moral Dilemma)
**Source:** South Junction tavern
**Hook:** "Brigands have a camp south of here. They've been robbing everyone on the southern road."

**Objective:** Travel toward Southern Shrine (5,14). Forced encounter: brigand camp battle.

**Twist:** After winning, the brigand leader is wounded but alive. Dialogue choice:
- **Execute him** → Sets `sq_brigands_executed`. South Junction rewards full bounty. Some NPCs disapprove.
- **Spare him** → Sets `sq_brigands_spared`. He swears to leave the Borderlands. Half bounty from South Junction, but later during main quest Stage 8, the bandit force is weaker (he warned them to flee, some did).
- **Recruit him** (requires empty party slot, or if unit was lost) → Sets `sq_brigands_recruited`. He joins as a Fighter L3. No bounty gold.

**Capture interaction:** If the player uses Subdue on the brigand leader during combat (instead of killing him), the post-battle dialogue is the same but the "Execute" option is replaced with "Turn in for bounty" (150 gold via bounty board). The capture mechanic gives the "spare" path a gameplay-motivated alternative — spare for strategic benefit OR capture for guaranteed gold.

**Rewards:**
- Execute: 150 gold
- Spare: 75 gold + easier final battle
- Recruit: New unit (Fighter L3, no gold)

**Difficulty:** Medium-Hard combat
**Flags:** `sq_brigands_active`, `sq_brigands_executed`/`spared`/`recruited`, `sq_brigands_complete`

---

### SQ6: "The Lost Patrol" (Rescue + Recruitment)
**Source:** Northern Bridge garrison commander (during main quest Stage 2 if visited) OR Borderkeep tavern
**Hook:** "A patrol of knights rode north to investigate the gorge. They never came back."

**Objective:** Multi-stage:
1. Travel to Miller's Rest (7,2). Travel encounter: find abandoned patrol camp, signs of battle.
2. Travel to Central Crossroads (7,8). Encounter: find a surviving knight, badly wounded.
3. Dialogue: She explains they were ambushed by undead from the Stone Ruins. She's the only survivor.
   - **Heal her** (requires healing item or unit with MAG 6+) → She recovers. Offers to join the party.
   - **Give her food and directions to Northern Bridge** → She leaves. Sets reputation flag.
   - **Leave her** → She dies. Dark flag set.

**Rewards:**
- Recruit: Knight L2 unit (Elara — strong DEF, moderate SPD)
- Reputation: `sq_patrol_helped` — Borderkeep commander gives bonus reward during main Stage 7
- Dark: `sq_patrol_abandoned` — Northern Bridge tavern has hostile dialogue

**Difficulty:** Low combat, high narrative weight
**Flags:** `sq_patrol_active`, `sq_patrol_found_camp`, `sq_patrol_found_survivor`, `sq_patrol_recruited`/`helped`/`abandoned`, `sq_patrol_complete`

**Note:** This quest ties directly into the main questline — finding the lost patrol reinforces the Stone Ruins threat.

---

### SQ7: "War Preparations" (Delivery / Multi-location)
**Source:** Borderkeep Castle tavern (available after main quest Stage 5)
**Hook:** "The lord needs supplies and allies for the coming war. The garrison is undermanned."

**Objective:** Hub-and-spoke — visit 2 of 3 locations (player chooses which):
1. **Riverside Market** — Convince the merchant guild to send supply wagons. Costs 50 gold bribe OR successful stat check (SKL 10+).
2. **South Junction** — Recruit the waystation's militia. Dialogue persuasion OR stat check (STR 10+). Easier if `sq_brigands_complete` (brigand threat removed).
3. **Northern Bridge** — Request the garrison sends reinforcements. Automatic if `sq_patrol_complete`. Otherwise requires stat check (LCK 8+).

Completing any 2 of 3 finishes the quest.

**Rewards:** 200 gold + 5 food + Borderkeep's best weapon stock unlocked (Steel weapons at 20% discount)
**Difficulty:** Travel-heavy, low combat, lots of dialogue
**Flags:** `sq_war_active`, `sq_war_market`, `sq_war_junction`, `sq_war_bridge`, `sq_war_complete`

---

## Quest Distribution Map

| Location | Main Quest Stage | Side Quests Available |
|----------|------------------|-----------------------|
| **Pine Crossing** | Stage 1 (auto), Stage 2 (alt) | SQ1 Blood Ties, SQ2 Wolf Problem, SQ3 Missing Caravan |
| **Northern Bridge** | Stage 2 (alt) | SQ4 Strange Lights, SQ6 Lost Patrol |
| **Riverside Market** | Stage 3 | SQ7 War Preparations (target) |
| **South Junction** | — | SQ3 Missing Caravan (target), SQ5 Brigands, SQ7 (target) |
| **Borderkeep Castle** | Stage 5a, Stage 7 | SQ7 War Preparations (source) |
| **Stone Ruins** | Stage 6 (dungeon) | — |
| **Eastern Gate** | Stage 8 (finale) | — |
| **Miller's Rest** | — | SQ2 (target), SQ4 (target), SQ6 (target) |
| **Central Crossroads** | — | SQ6 (target) |
| **Forest Edge** | — | SQ3 (target) |
| **Southern Shrine** | — | SQ5 (target) |
| **Frontier Camp** | — | SQ1 (target) |
| **Travel encounters** | Stage 4, Stage 8 | SQ1 Blood Ties, various quest encounters |

---

## Quest Economy

### Gold Flow Analysis

| Source | Gold In | Gold Out | Net |
|--------|---------|----------|-----|
| Starting gold | 50 | — | 50 |
| Main Quest (all stages) | ~430-580 | 0 | +430-580 |
| SQ1 Blood Ties | 50-130 | 0 | +50-130 (bounty + captures) |
| SQ2 Wolf Problem | 80 | 0 | +80 |
| SQ3 Missing Caravan | 50-150 | 0-100 | -50 to +150 |
| SQ4 Strange Lights | 80 | 0 | +80 |
| SQ5 Brigands | 0-150 | 0 | 0-150 |
| SQ6 Lost Patrol | 0 | 0 | 0 (recruit is reward) |
| SQ7 War Preparations | 200 | 0-50 | +150-200 |
| **Shops/Inns/Food** | — | ~300-500 | -300 to -500 |

| Bounty captures (all fights) | ~50-200 | 0 | +50-200 (ongoing) |
**Expected total gold earned:** ~800-1400 (main + sides + bounties)
**Expected total gold spent:** ~300-500 (supplies, inn, shop)
**Net:** Player ends Borderlands with 400-700g surplus for next region

### Item Rewards

| Quest | Item Reward | Value |
|-------|-------------|-------|
| SQ4 Strange Lights | Thunder tome | 900g equivalent |
| Main Stage 6 | Runed Blade (unique sword) | ~800g equivalent |
| Main Stage 7 (best) | Steel Lance | 560g equivalent |
| SQ7 War Prep | Steel weapon discount | ~100-200g savings |

### Recruitment Opportunities

| Quest | Unit | Class | Level | Condition |
|-------|------|-------|-------|-----------|
| SQ1 Blood Ties (capture Daren) | Kael | Bounty Hunter | L3 | Capture Daren alive via Subdue |
| SQ5 Brigands (recruit path) | Brigand Leader | Fighter | L3 | Choose "recruit" in post-battle dialogue |
| SQ6 Lost Patrol (heal path) | Elara | Knight | L2 | Heal the survivor (item or MAG 6+) |
| Main Stage 7 (best outcome) | Borderkeep Cavalier | Cavalier | L3 | Alliance + artifact destroyed |

**Maximum party size by endgame:** 3 (start) + 4 (recruits) = 7
**Minimum party size:** 3 (start) - losses. Quests are balanced for 2-3 units minimum.

---

## Pacing Chart

```
SPAWN ──→ Pine Crossing (MQ1, pick up SQ1/SQ2/SQ3)
              │
         [Optional: Do SQ1 Blood Ties near Frontier Camp — CAPTURE TUTORIAL]
         [Optional: Do SQ2 wolves near Miller's Rest]
              │
         Northern Bridge (MQ2) ──OR── Riverside Market (MQ2)
         [Pick up SQ4, SQ6]          [Learn about ruins]
              │                            │
         [Optional: Do SQ4/SQ6]           │
              │                            │
              └──→ Riverside Market (MQ3) ←┘
                        │
                   [Optional: Do SQ3 caravan via Forest Edge + South Junction]
                   [Optional: Do SQ5 brigands via South Junction]
                        │
                   Travel east toward Stone Ruins (MQ4 encounter)
                        │
              ┌── Borderkeep Castle (MQ5a: get key) ──┐
              │                                        │
              │    ──OR──                              │
              │                                        │
              └── Stone Ruins directly (MQ5b: force) ──┘
                        │
                   Stone Ruins dungeon (MQ6)
                        │
                   Borderkeep Castle (MQ7: claim passage)
                   [Pick up / complete SQ7 War Preparations]
                        │
                   Eastern Gate (MQ8: finale)
```

**Estimated total play time (hops):**
- Main quest only: ~15-20 hops
- Main + all side quests: ~30-40 hops
- Food consumption at 1/hop: 15-40 food needed (starting 10 + purchases + quest rewards)

---

## Flag Registry

### Main Quest Flags

| Flag | Set By | Checked By |
|------|--------|------------|
| `main_quest_active` | MQ Stage 1 | All MQ stages |
| `main_quest_stage_1` | Pine Crossing arrival | MQ Stage 2 |
| `main_quest_stage_2` | Northern Bridge or Riverside Market visit | MQ Stage 3 |
| `main_quest_visited_bridge` | Visiting Northern Bridge in Stage 2 | Flavor dialogue |
| `main_quest_visited_market` | Visiting Riverside Market in Stage 2 | Flavor dialogue |
| `main_quest_knows_ruins` | MQ Stage 2 completion | MQ Stage 3 dialogue |
| `main_quest_stage_3` | Riverside Market intel | MQ Stage 4, Stage 5 |
| `main_quest_knows_key` | MQ Stage 3 | MQ Stage 5 dialogue |
| `main_quest_stage_4` | Scout encounter | MQ Stage 5 |
| `helped_borderkeep_scout` | Helping the scout | MQ Stage 5a, Stage 7 |
| `main_quest_stage_5` | Key obtained or door forced | MQ Stage 6 (dungeon unlock) |
| `has_ruins_key` | Borderkeep gives key | Stone Ruins dungeon (easier path) |
| `forced_ruins_entry` | Forcing the door | Stone Ruins dungeon (harder path) |
| `borderkeep_alliance` | Getting key from Borderkeep | MQ Stage 7 outcomes |
| `main_quest_stage_6` | Dungeon cleared | MQ Stage 7 |
| `stone_ruins_cleared` | Dungeon cleared | World state, NPC dialogue |
| `ruins_artifact_destroyed` | Player choice in dungeon | MQ Stage 7 outcomes |
| `ruins_artifact_kept` | Player choice in dungeon | MQ Stage 7, Stage 8 |
| `main_quest_stage_7` | Borderkeep judgment | MQ Stage 8 |
| `eastern_gate_unlocked` | Borderkeep grants passage | Eastern Gate access |
| `main_quest_complete` | Reaching Eastern Gate | End state |

### Side Quest Flags

| Flag | Set By | Checked By |
|------|--------|------------|
| `sq_blood_ties_active` | Accept SQ1 | SQ1 travel encounter |
| `sq_blood_ties_daren_captured` | Subdue Daren in combat | SQ1 post-battle dialogue (Kael joins) |
| `sq_blood_ties_daren_killed` | Daren dies in combat | SQ1 post-battle dialogue (Kael pays, leaves) |
| `sq_blood_ties_kael_recruited` | Kael joins party | Party composition, bounty capture rates |
| `sq_blood_ties_complete` | Any SQ1 resolution | Pine Crossing dialogue |
| `sq_wolves_active` | Accept SQ2 | SQ2 travel encounter |
| `sq_wolves_complete` | Turn in SQ2 | Pine Crossing dialogue |
| `sq_caravan_active` | Accept SQ3 | SQ3 encounters |
| `sq_caravan_found_wreck` | Forest Edge encounter | SQ3 South Junction dialogue |
| `sq_caravan_complete` | Any SQ3 resolution | Riverside Market discount |
| `sq_caravan_paid_ransom` | Paying the fence | Flavor only |
| `sq_lights_active` | Accept SQ4 | SQ4 encounter |
| `sq_lights_found_sanctum` | Exploring the cave | MQ Stage 6 boss debuff |
| `sq_lights_complete` | SQ4 resolution | NPC dialogue |
| `sq_brigands_active` | Accept SQ5 | SQ5 encounter |
| `sq_brigands_executed` | Execute choice | South Junction dialogue |
| `sq_brigands_spared` | Spare choice | MQ Stage 8 (fewer enemies) |
| `sq_brigands_recruited` | Recruit choice | Party composition |
| `sq_brigands_complete` | Any SQ5 resolution | SQ7 South Junction check |
| `sq_patrol_active` | Accept SQ6 | SQ6 encounters |
| `sq_patrol_found_camp` | Miller's Rest encounter | SQ6 next stage |
| `sq_patrol_found_survivor` | Central Crossroads encounter | SQ6 dialogue |
| `sq_patrol_recruited` | Heal choice | Party composition |
| `sq_patrol_helped` | Send-home choice | MQ Stage 7 bonus |
| `sq_patrol_abandoned` | Leave choice | Northern Bridge dialogue |
| `sq_patrol_complete` | Any SQ6 resolution | SQ7 Northern Bridge check |
| `sq_war_active` | Accept SQ7 | SQ7 objectives |
| `sq_war_market` | Riverside Market objective | SQ7 completion check |
| `sq_war_junction` | South Junction objective | SQ7 completion check |
| `sq_war_bridge` | Northern Bridge objective | SQ7 completion check |
| `sq_war_complete` | 2/3 objectives done | Borderkeep shop discount |

---

## Implementation Notes

### What Exists Already
- Flag system (EventBus `_flags` dictionary) — fully working
- Dialogue system with conditions, effects, choices, stat checks — fully working
- Travel encounter system with conditions and one-shot events — fully working
- Town menu with tavern (rumors), shop, inn — fully working
- Dungeon location type (locked) — exists but dungeon gameplay is placeholder

### What Needs Building (Wave 5)
1. **QuestManager autoload** — Tracks active quests, stages, completion. Wraps EventBus flags with quest-specific logic.
2. **Quest log UI** — Shows active/completed quests with stage descriptions.
3. **Quest/bounty board UI** — Town tavern panel that lists available quests AND bounty turn-ins. Captured enemies appear here for turn-in.
4. **Quest-aware location nodes** — Visual indicators (!) for quest-relevant locations.
5. **Quest-specific travel events** — New entries in `travel_events.json` with flag conditions.
6. **Quest dialogue files** — One JSON per quest stage that needs dialogue.
7. **Dungeon combat sequences** — Multiple sequential battles for Stone Ruins (currently placeholder).
8. **Recruitment system** — `recruit_unit` dialogue effect (currently no-op). Triggered by quest outcomes (e.g. Kael joins after capturing Daren).
9. **Subdue combat action** — Universal skill available to all units. HP%-based success rate, melee range, no damage. See Subdue mechanic section.
10. **Capture state in combat** — Bound enemy visual state, tile occupation, untie AI behavior for enemies.
11. **Bounty Hunter class** — Archer variant with Tracker passive (improved Subdue rates). Used by Kael (SQ1 recruit).
12. **Captured enemy tracking** — GameManager tracks captured enemies across battles for bounty board turn-in.

### Dialogue Files Needed

| File | Quest | Stage |
|------|-------|-------|
| `sq_blood_ties_accept.json` | SQ1 | Kael's request in tavern |
| `sq_blood_ties_daren_captured.json` | SQ1 | Post-battle: Daren alive, Kael joins |
| `sq_blood_ties_daren_killed.json` | SQ1 | Post-battle: Daren dead, Kael pays |
| `sq_blood_ties_bounty_tutorial.json` | SQ1 | First bounty board interaction |
| `mq_pine_crossing_arrival.json` | MQ | Stage 1 |
| `mq_northern_bridge_intel.json` | MQ | Stage 2a |
| `mq_riverside_market_intel.json` | MQ | Stage 2b/3 |
| `mq_wounded_scout.json` | MQ | Stage 4 |
| `mq_borderkeep_key.json` | MQ | Stage 5a |
| `mq_ruins_entrance.json` | MQ | Stage 5b |
| `mq_ruins_artifact.json` | MQ | Stage 6 (post-boss) |
| `mq_borderkeep_judgment.json` | MQ | Stage 7 |
| `mq_eastern_gate.json` | MQ | Stage 8 |
| `sq_wolves_accept.json` | SQ2 | Accept |
| `sq_wolves_complete.json` | SQ2 | Turn-in |
| `sq_caravan_wreck.json` | SQ3 | Stage 1 |
| `sq_caravan_fence.json` | SQ3 | Stage 2 |
| `sq_lights_cave.json` | SQ4 | Main encounter |
| `sq_brigands_camp.json` | SQ5 | Post-battle choice |
| `sq_patrol_camp.json` | SQ6 | Stage 1 |
| `sq_patrol_survivor.json` | SQ6 | Stage 2 |
| `sq_war_accept.json` | SQ7 | Accept |
| `sq_war_market.json` | SQ7 | Riverside objective |
| `sq_war_junction.json` | SQ7 | South Junction objective |
| `sq_war_bridge.json` | SQ7 | Northern Bridge objective |
| `sq_war_complete.json` | SQ7 | Turn-in |

### Enemy Groups Needed

| Group ID | Quest | Composition |
|----------|-------|-------------|
| `darens_gang` | SQ1 | 2 Brigand (L2) + 1 Brigand Archer (L2) + Daren (Fighter L2, capture target) |
| `wolves_alpha` | SQ2 | 3 Wolf (L2) + 1 Alpha Wolf (L3) |
| `brigand_camp` | SQ5 | 3 Brigand (L2) + 1 Brigand Leader (L3) |
| `ruins_skeletons` | MQ6 Room 1 | 3 Skeleton (L2) |
| `ruins_archers` | MQ6 Room 2 | 2 Skeleton (L2) + 2 Skeleton Archer (L2) |
| `ruins_boss` | MQ6 Room 3 | 1 Undead Knight (L4) + 2 Skeleton (L3) |
| `gate_ambush` | MQ8 | 3 Brigand (L3) + 2 Brigand Archer (L2) + 1 Brigand Captain (L4) |

---

## Cross-Quest Influence Map

Shows how side quest outcomes affect the main questline:

```
SQ1 (Blood Ties) ─────kael_recruited──→ All fights: Kael has improved Subdue rates (Tracker passive)
SQ1 (Blood Ties) ─────complete───────→ Bounty board unlocked at all towns, capture = gold income
SQ4 (Strange Lights) ──found_sanctum──→ MQ6 boss has -2 DEF
SQ5 (Brigands) ────────spared──────→ MQ8 fewer enemies in final battle
SQ5 (Brigands) ────────complete────→ SQ7 South Junction easier
SQ6 (Lost Patrol) ─────helped─────→ MQ7 Borderkeep bonus reward
SQ6 (Lost Patrol) ─────complete────→ SQ7 Northern Bridge auto-success
MQ4 (Scout) ───────────helped─────→ MQ5a/MQ7 better Borderkeep reception
MQ5 (Key vs Force) ────has_key────→ MQ6 easier dungeon + bonus loot
MQ6 (Artifact) ────────kept──────→ MQ8 party gets +2 STR in final battle
MQ6 (Artifact) ────────destroyed──→ MQ7 Borderkeep full rewards
```
