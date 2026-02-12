# FE_MB - MVP Demo Content Plan

> Full content specification for a 2-3 region, 30-45 minute roguelite demo run.
> All numbers are final and implementable directly into GDScript.

Last Updated: February 12, 2026

---

## Table of Contents

1. [Run Overview](#1-run-overview)
2. [Starter Party (Existing)](#2-starter-party-existing)
3. [Recruitable Units](#3-recruitable-units)
4. [Enemy Roster](#4-enemy-roster)
5. [Weapon Catalog](#5-weapon-catalog)
6. [Event Content](#6-event-content)
7. [Boss Designs](#7-boss-designs)
8. [Region Design](#8-region-design)
9. [Shop Inventories](#9-shop-inventories)
10. [Balance Analysis](#10-balance-analysis)
11. [Difficulty Scaling](#11-difficulty-scaling)
12. [Implementation Reference](#12-implementation-reference)

---

## 1. Run Overview

| Metric | Target |
|--------|--------|
| Total regions | 3 (The Borderlands, Thornwood Wilds, Ashfall Peaks) |
| Run duration | 30-45 minutes |
| Total battles (overworld) | 8-12 across all regions |
| Total dungeons | 2-3 (one per region, Region 1 dungeon is optional) |
| Starting party size | 3 |
| Max recruitable units | 5 (player ends with 4-6 of max 6) |
| Expected unit deaths | 1-2 per successful run |
| Starting gold | 50 |
| Starting food | 10 |
| Starting morale | 100 |
| Final boss level target | Party average level 6-8 |

---

## 2. Starter Party (Existing)

These three units are already implemented in `GameManager.start_new_run()`. Listed here for reference and to confirm their full stat blocks (some stats were not set explicitly and use UnitData defaults).

### Roy (LORD)

| Stat | Value | Growth |
|------|-------|--------|
| HP | 22 | 60% |
| STR | 6 | 45% |
| MAG | 0 | 5% |
| SKL | 6 | 50% |
| SPD | 7 | 45% |
| LCK | 7 | 60% |
| DEF | 5 | 30% |
| RES | 2 | 25% |
| MOV | 5 | -- |

- **Class**: Lord
- **Level**: 1
- **Weapon**: Rapier (see Weapon Catalog -- upgrade from current generic sword)
- **Personality**: Young lord thrust into command. Earnest, grows into leadership.
- **Role**: Balanced frontliner. Must survive (game over if Roy dies).

### Marcus (KNIGHT)

| Stat | Value | Growth |
|------|-------|--------|
| HP | 28 | 40% |
| STR | 8 | 30% |
| MAG | 0 | 0% |
| SKL | 5 | 25% |
| SPD | 3 | 15% |
| LCK | 5 | 20% |
| DEF | 10 | 25% |
| RES | 2 | 15% |
| MOV | 4 | -- |

- **Class**: Knight
- **Level**: 3 (Jagen archetype -- starts strong, grows slowly)
- **Weapon**: Iron Lance
- **Personality**: Veteran soldier, loyal and cautious. Gives tactical advice.
- **Role**: Tank. Absorbs damage early game, falls off in later regions.

### Lilina (MAGE)

| Stat | Value | Growth |
|------|-------|--------|
| HP | 18 | 40% |
| STR | 1 | 5% |
| MAG | 8 | 55% |
| SKL | 6 | 40% |
| SPD | 6 | 40% |
| LCK | 7 | 50% |
| DEF | 3 | 15% |
| RES | 5 | 35% |
| MOV | 5 | -- |

- **Class**: Mage
- **Level**: 1
- **Weapon**: Fire (Tome)
- **Personality**: Eager scholar with a sharp tongue. Roy's childhood friend.
- **Role**: Ranged magic damage. Targets RES, bypasses high-DEF armored enemies.

---

## 3. Recruitable Units

Five recruitable characters across the three regions. The player will likely recruit 2-4 depending on route choices.

### 3.1 Wren -- Thief (Region 1: The Borderlands)

**Found**: Riverside Market (TOWN) -- available for recruitment for 0 gold (free, joins if spoken to). Can also appear at "Central Crossroads" EVENT if the player misses the town.

**Personality**: Street-smart orphan from the borderlands. Sarcastic, fiercely loyal once trust is earned. Steals items from treasure rooms more effectively.

| Stat | Value | Growth |
|------|-------|--------|
| HP | 19 | 45% |
| STR | 4 | 30% |
| MAG | 0 | 0% |
| SKL | 8 | 55% |
| SPD | 10 | 60% |
| LCK | 9 | 55% |
| DEF | 3 | 15% |
| RES | 1 | 10% |
| MOV | 6 | -- |

- **Class**: Thief
- **Level**: 1
- **Weapon**: Iron Dagger (Sword-type)
- **Starting Inventory**: Vulnerary (heals 10 HP, 3 uses)
- **Recruitment Cost**: Free

**Design Notes**: Glass cannon dodgetank. Highest SPD in the game. Can double almost everything early but will die to any focused attack. Provides weapon triangle coverage (sword vs enemy axes).

### 3.2 Aldric -- Fighter (Region 1: The Borderlands)

**Found**: South Junction (BATTLE) -- after winning the battle, Aldric is a wounded soldier who asks to join. Automatically joins party if party size < 6.

**Personality**: Former mercenary, gruff and practical. Drinks too much. Surprisingly tender about fallen comrades.

| Stat | Value | Growth |
|------|-------|--------|
| HP | 24 | 65% |
| STR | 8 | 50% |
| MAG | 0 | 0% |
| SKL | 5 | 35% |
| SPD | 5 | 30% |
| LCK | 3 | 20% |
| DEF | 4 | 25% |
| RES | 1 | 10% |
| MOV | 5 | -- |

- **Class**: Fighter
- **Level**: 2
- **Weapon**: Iron Axe
- **Starting Inventory**: None
- **Recruitment Cost**: Free (post-battle)

**Design Notes**: High STR and HP, low luck and speed. Hits hard but gets hit back. Weapon triangle advantage vs lances (common in Region 2). Gives the player a dedicated axe user.

### 3.3 Sera -- Cleric (Region 2: Thornwood Wilds)

**Found**: Thornwood Chapel (TOWN/CAMP equivalent in Region 2) -- joins for free. Alternatively found at a Region 2 EVENT ("The Wounded Healer").

**Personality**: Gentle priestess who fled her order after they were corrupted. Soft-spoken but steel-willed. Refuses to let anyone die on her watch.

| Stat | Value | Growth |
|------|-------|--------|
| HP | 20 | 45% |
| STR | 1 | 5% |
| MAG | 6 | 45% |
| SKL | 5 | 35% |
| SPD | 6 | 35% |
| LCK | 8 | 55% |
| DEF | 2 | 10% |
| RES | 7 | 45% |
| MOV | 5 | -- |

- **Class**: Cleric
- **Level**: 2
- **Weapon**: Heal Staff (Staff-type)
- **Starting Inventory**: Vulnerary (heals 10 HP, 3 uses)
- **Recruitment Cost**: Free

**Design Notes**: The party's first dedicated healer. Critical for sustaining through Region 2 and 3's harder battles. Cannot fight -- only heals. Very high RES growth makes her the magic tank later.

### 3.4 Garrett -- Cavalier (Region 2: Thornwood Wilds)

**Found**: Region 2 EVENT ("The Deserter") -- a cavalier fleeing the enemy army offers to join. Player choice: accept him (free recruit) or turn him away (+15 gold bounty).

**Personality**: Disillusioned knight who deserted the enemy forces. Guilt-ridden, seeks redemption. Fierce in combat to prove his loyalty.

| Stat | Value | Growth |
|------|-------|--------|
| HP | 23 | 55% |
| STR | 7 | 45% |
| MAG | 0 | 0% |
| SKL | 6 | 35% |
| SPD | 7 | 40% |
| LCK | 4 | 25% |
| DEF | 6 | 30% |
| RES | 2 | 15% |
| MOV | 7 | -- |

- **Class**: Cavalier
- **Level**: 3
- **Weapon**: Steel Lance
- **Starting Inventory**: None
- **Recruitment Cost**: Free (or refuse for 15 gold)

**Design Notes**: High mobility (7 MOV) makes him the party's reach unit. Balanced stats. Arrives in Region 2 at level 3, so he's immediately combat-ready. Lance user provides weapon triangle coverage vs swords.

### 3.5 Isolde -- Archer (Region 3: Ashfall Peaks)

**Found**: Ashfall Outpost (first TOWN in Region 3) -- joins for 30 gold recruitment fee. If party has lost 2+ units, she joins for free out of pity.

**Personality**: Cold, calculating huntress from the mountains. Speaks in clipped sentences. Secretly terrified of losing people, which is why she keeps distance.

| Stat | Value | Growth |
|------|-------|--------|
| HP | 21 | 50% |
| STR | 7 | 40% |
| MAG | 0 | 0% |
| SKL | 9 | 55% |
| SPD | 8 | 45% |
| LCK | 5 | 30% |
| DEF | 4 | 20% |
| RES | 3 | 20% |
| MOV | 5 | -- |

- **Class**: Archer
- **Level**: 4
- **Weapon**: Steel Bow
- **Starting Inventory**: None
- **Recruitment Cost**: 30 gold (free if 2+ units lost)

**Design Notes**: Late-game ranged physical unit. Bow range 2 means she can attack without counterattack from melee enemies. High SKL gives reliable hit rates. Arrives at level 4 to be competitive in Region 3. Outside weapon triangle -- pure neutral damage.

---

## 4. Enemy Roster

### 4.1 Enemy Type Definitions

Each enemy type has a base stat block that scales per region. The formula is:
```
Actual Stat = Base + (Region - 1) * Scaling
```

Where Region is 1, 2, or 3.

#### Bandit (FIGHTER) -- Regions 1, 2

Common melee fodder. Axe wielders.

| Stat | Base (R1) | Scaling | R1 | R2 | R3 |
|------|-----------|---------|-----|-----|-----|
| HP | 18 | +4 | 18 | 22 | 26 |
| STR | 5 | +2 | 5 | 7 | 9 |
| MAG | 0 | 0 | 0 | 0 | 0 |
| SKL | 3 | +1 | 3 | 4 | 5 |
| SPD | 4 | +1 | 4 | 5 | 6 |
| LCK | 2 | +1 | 2 | 3 | 4 |
| DEF | 3 | +1 | 3 | 4 | 5 |
| RES | 0 | +1 | 0 | 1 | 2 |
| MOV | 5 | 0 | 5 | 5 | 5 |

- **Weapon**: Hand Axe (Might 5, Hit 75, Weight 7)
- **AI**: Aggressive -- always targets lowest HP player unit
- **Level**: R1=1, R2=3, R3=5

#### Soldier (FIGHTER) -- Regions 1, 2, 3

Disciplined lance infantry. Backbone of enemy forces.

| Stat | Base (R1) | Scaling | R1 | R2 | R3 |
|------|-----------|---------|-----|-----|-----|
| HP | 20 | +4 | 20 | 24 | 28 |
| STR | 5 | +2 | 5 | 7 | 9 |
| MAG | 0 | 0 | 0 | 0 | 0 |
| SKL | 5 | +2 | 5 | 7 | 9 |
| SPD | 4 | +1 | 4 | 5 | 6 |
| LCK | 3 | +1 | 3 | 4 | 5 |
| DEF | 5 | +2 | 5 | 7 | 9 |
| RES | 1 | +1 | 1 | 2 | 3 |
| MOV | 4 | 0 | 4 | 4 | 4 |

- **Weapon**: Iron Lance (Might 7, Hit 80, Weight 8)
- **AI**: Defensive -- prefers to hold position, attacks if in range
- **Level**: R1=1, R2=3, R3=5

#### Brigand (FIGHTER) -- Regions 1, 2

Heavy hitter, slow. Mini-elite.

| Stat | Base (R1) | Scaling | R1 | R2 | R3 |
|------|-----------|---------|-----|-----|-----|
| HP | 24 | +5 | 24 | 29 | 34 |
| STR | 8 | +2 | 8 | 10 | 12 |
| MAG | 0 | 0 | 0 | 0 | 0 |
| SKL | 2 | +1 | 2 | 3 | 4 |
| SPD | 2 | +1 | 2 | 3 | 4 |
| LCK | 1 | +1 | 1 | 2 | 3 |
| DEF | 3 | +2 | 3 | 5 | 7 |
| RES | 0 | 0 | 0 | 0 | 0 |
| MOV | 5 | 0 | 5 | 5 | 5 |

- **Weapon**: Steel Axe (Might 8, Hit 65, Weight 10)
- **AI**: Aggressive -- charges nearest unit, ignores weapon triangle
- **Level**: R1=2, R2=4, R3=6

#### Mercenary (FIGHTER) -- Regions 2, 3

Skilled sword fighter. Balanced and dangerous.

| Stat | Base (R2) | Scaling | R2 | R3 |
|------|-----------|---------|-----|-----|
| HP | 22 | +4 | 22 | 26 |
| STR | 7 | +2 | 7 | 9 |
| MAG | 0 | 0 | 0 | 0 |
| SKL | 8 | +2 | 8 | 10 |
| SPD | 8 | +2 | 8 | 10 |
| LCK | 4 | +1 | 4 | 5 |
| DEF | 5 | +1 | 5 | 6 |
| RES | 2 | +1 | 2 | 3 |
| MOV | 5 | 0 | 5 | 5 |

- **Weapon**: Iron Sword (Might 5, Hit 90, Weight 5)
- **AI**: Smart -- targets weakest unit it has weapon triangle advantage against
- **Level**: R2=3, R3=6

#### Armor Knight (KNIGHT) -- Regions 2, 3

Slow wall of steel. Requires magic or armor-effective weapons to deal with efficiently.

| Stat | Base (R2) | Scaling | R2 | R3 |
|------|-----------|---------|-----|-----|
| HP | 26 | +4 | 26 | 30 |
| STR | 8 | +2 | 8 | 10 |
| MAG | 0 | 0 | 0 | 0 |
| SKL | 4 | +1 | 4 | 5 |
| SPD | 1 | +1 | 1 | 2 |
| LCK | 2 | +1 | 2 | 3 |
| DEF | 12 | +2 | 12 | 14 |
| RES | 1 | +1 | 1 | 2 |
| MOV | 3 | 0 | 3 | 3 |

- **Weapon**: Steel Lance (Might 8, Hit 75, Weight 10)
- **AI**: Defensive -- holds chokepoints, does not chase
- **Level**: R2=4, R3=6

#### Dark Mage (MAGE) -- Regions 2, 3

Ranged magic user. Forces the player to handle threats at distance.

| Stat | Base (R2) | Scaling | R2 | R3 |
|------|-----------|---------|-----|-----|
| HP | 18 | +3 | 18 | 21 |
| STR | 0 | 0 | 0 | 0 |
| MAG | 7 | +2 | 7 | 9 |
| SKL | 6 | +1 | 6 | 7 |
| SPD | 5 | +2 | 5 | 7 |
| LCK | 3 | +1 | 3 | 4 |
| DEF | 2 | +1 | 2 | 3 |
| RES | 6 | +2 | 6 | 8 |
| MOV | 5 | 0 | 5 | 5 |

- **Weapon**: Flux (Tome, Might 5, Hit 85, Range 1-2, Weight 6)
- **AI**: Ranged -- stays at max range, targets lowest RES unit
- **Level**: R2=3, R3=5

#### Scout (THIEF) -- Regions 1, 2, 3

Fast flanker. Targets backline (healers, mages).

| Stat | Base (R1) | Scaling | R1 | R2 | R3 |
|------|-----------|---------|-----|-----|-----|
| HP | 16 | +3 | 16 | 19 | 22 |
| STR | 4 | +1 | 4 | 5 | 6 |
| MAG | 0 | 0 | 0 | 0 | 0 |
| SKL | 6 | +2 | 6 | 8 | 10 |
| SPD | 9 | +2 | 9 | 11 | 13 |
| LCK | 5 | +1 | 5 | 6 | 7 |
| DEF | 2 | +1 | 2 | 3 | 4 |
| RES | 1 | +1 | 1 | 2 | 3 |
| MOV | 6 | 0 | 6 | 6 | 6 |

- **Weapon**: Iron Dagger (Sword, Might 3, Hit 95, Weight 2)
- **AI**: Flanker -- always targets the unit with lowest DEF (healers/mages)
- **Level**: R1=1, R2=3, R3=5

#### Rider (CAVALIER) -- Regions 2, 3

Mounted lance unit. High mobility threat.

| Stat | Base (R2) | Scaling | R2 | R3 |
|------|-----------|---------|-----|-----|
| HP | 24 | +4 | 24 | 28 |
| STR | 7 | +2 | 7 | 9 |
| MAG | 0 | 0 | 0 | 0 |
| SKL | 5 | +1 | 5 | 6 |
| SPD | 6 | +2 | 6 | 8 |
| LCK | 3 | +1 | 3 | 4 |
| DEF | 6 | +2 | 6 | 8 |
| RES | 2 | +1 | 2 | 3 |
| MOV | 7 | 0 | 7 | 7 |

- **Weapon**: Iron Lance (Might 7, Hit 80, Weight 8)
- **AI**: Aggressive -- charges from range using high MOV, targets isolated units
- **Level**: R2=4, R3=6

#### Sniper (ARCHER) -- Region 3

Ranged physical threat. Cannot be counterattacked by melee.

| Stat | Base (R3) | R3 |
|------|-----------|-----|
| HP | 22 | 22 |
| STR | 8 | 8 |
| MAG | 0 | 0 |
| SKL | 10 | 10 |
| SPD | 7 | 7 |
| LCK | 4 | 4 |
| DEF | 4 | 4 |
| RES | 3 | 3 |
| MOV | 5 | 5 |

- **Weapon**: Iron Bow (Might 6, Hit 85, Range 2, Weight 5)
- **AI**: Ranged -- maintains distance, targets lowest HP unit
- **Level**: R3=5

#### Shaman (MAGE) -- Region 3

Advanced magic user. Debuffs party.

| Stat | Base (R3) | R3 |
|------|-----------|-----|
| HP | 20 | 20 |
| STR | 0 | 0 |
| MAG | 10 | 10 |
| SKL | 7 | 7 |
| SPD | 6 | 6 |
| LCK | 3 | 3 |
| DEF | 3 | 3 |
| RES | 9 | 9 |
| MOV | 5 | 5 |

- **Weapon**: Nosferatu (Tome, Might 7, Hit 80, Range 1-2, Weight 8)
- **AI**: Smart -- targets the unit it deals most damage to, heals itself (Nosferatu effect = recovers HP equal to damage dealt -- implement as special weapon flag)
- **Level**: R3=6

### 4.2 Elite Enemies

Elites appear in dungeon ELITE rooms and as rare overworld mini-bosses. They use the same types above but with the following multiplier applied:

```
Elite HP = Base HP * 1.4 (rounded down)
Elite STR/MAG = Base + 2
Elite DEF/RES = Base + 2
Elite SKL/SPD = Base + 1
Gold Reward = Normal * 2
EXP Reward = Normal * 1.5
```

**Elite Names**: Prefix the type with a title:
- "Veteran Bandit", "Shield Soldier", "Ironclad Knight", "Shadow Mage", "Blade Mercenary"

### 4.3 Encounter Compositions by Region

**Region 1 -- The Borderlands** (2-3 enemies per battle):
| Battle | Composition |
|--------|------------|
| Easy | 2 Bandits |
| Medium | 2 Bandits + 1 Scout |
| Hard | 1 Brigand + 2 Soldiers |
| Elite | 1 Veteran Bandit + 2 Bandits |

**Region 2 -- Thornwood Wilds** (3-4 enemies per battle):
| Battle | Composition |
|--------|------------|
| Easy | 2 Soldiers + 1 Scout |
| Medium | 1 Mercenary + 2 Soldiers |
| Hard | 1 Armor Knight + 1 Dark Mage + 1 Rider |
| Elite | 1 Ironclad Knight + 1 Dark Mage + 2 Soldiers |

**Region 3 -- Ashfall Peaks** (3-5 enemies per battle):
| Battle | Composition |
|--------|------------|
| Easy | 2 Mercenaries + 1 Sniper |
| Medium | 1 Armor Knight + 1 Shaman + 2 Soldiers |
| Hard | 1 Rider + 1 Sniper + 1 Shaman + 1 Mercenary |
| Elite | 1 Shadow Mage + 1 Ironclad Knight + 2 Mercenaries |

---

## 5. Weapon Catalog

### 5.1 Swords

| # | Name | Might | Hit | Crit | Weight | Range | Special | Buy | Sell | Found |
|---|------|-------|-----|------|--------|-------|---------|-----|------|-------|
| 1 | Iron Dagger | 3 | 95 | 5 | 2 | 1 | -- | 60 | 30 | Wren starting weapon |
| 2 | Iron Sword | 5 | 90 | 0 | 5 | 1 | -- | 100 | 50 | R1 shop, enemy drops |
| 3 | Rapier | 5 | 95 | 10 | 3 | 1 | Effective vs Armor (2x DMG) | -- | -- | Roy starting weapon (unique) |
| 4 | Steel Sword | 8 | 80 | 0 | 8 | 1 | -- | 200 | 100 | R2 shop |
| 5 | Killing Edge | 7 | 85 | 25 | 6 | 1 | -- | 350 | 175 | R3 shop, treasure |

### 5.2 Lances

| # | Name | Might | Hit | Crit | Weight | Range | Special | Buy | Sell | Found |
|---|------|-------|-----|------|--------|-------|---------|-----|------|-------|
| 6 | Iron Lance | 7 | 80 | 0 | 8 | 1 | -- | 120 | 60 | Marcus starting, R1 shop |
| 7 | Steel Lance | 8 | 75 | 0 | 10 | 1 | -- | 220 | 110 | Garrett starting, R2 shop |
| 8 | Javelin | 5 | 65 | 0 | 9 | 1-2 | Ranged option | 300 | 150 | R2 shop, treasure |
| 9 | Silver Lance | 12 | 80 | 0 | 10 | 1 | -- | 500 | 250 | R3 shop, treasure |

### 5.3 Axes

| # | Name | Might | Hit | Crit | Weight | Range | Special | Buy | Sell | Found |
|---|------|-------|-----|------|--------|-------|---------|-----|------|-------|
| 10 | Iron Axe | 6 | 75 | 0 | 7 | 1 | -- | 90 | 45 | Aldric starting, R1 shop |
| 11 | Hand Axe | 5 | 65 | 0 | 8 | 1-2 | Ranged option | 250 | 125 | R1 shop, enemy weapon |
| 12 | Steel Axe | 10 | 65 | 0 | 12 | 1 | -- | 200 | 100 | R2 shop |
| 13 | Hammer | 8 | 55 | 0 | 13 | 1 | Effective vs Armor (2x DMG) | 350 | 175 | R2 treasure, R3 shop |
| 14 | Killer Axe | 9 | 70 | 25 | 11 | 1 | -- | 400 | 200 | R3 treasure |

### 5.4 Bows

| # | Name | Might | Hit | Crit | Weight | Range | Special | Buy | Sell | Found |
|---|------|-------|-----|------|--------|-------|---------|-----|------|-------|
| 15 | Iron Bow | 6 | 85 | 0 | 5 | 2 | -- | 120 | 60 | R1 shop |
| 16 | Steel Bow | 9 | 80 | 0 | 8 | 2 | -- | 250 | 125 | Isolde starting, R3 shop |
| 17 | Longbow | 5 | 70 | 0 | 6 | 2-3 | Extended range | 350 | 175 | R3 shop, treasure |

### 5.5 Tomes

| # | Name | Might | Hit | Crit | Weight | Range | Special | Buy | Sell | Found |
|---|------|-------|-----|------|--------|-------|---------|-----|------|-------|
| 18 | Fire | 5 | 90 | 0 | 4 | 1-2 | -- | 150 | 75 | Lilina starting, R1 shop |
| 19 | Thunder | 7 | 80 | 5 | 6 | 1-2 | -- | 250 | 125 | R2 shop |
| 20 | Flux | 5 | 85 | 0 | 6 | 1-2 | -- | -- | -- | Enemy weapon only |
| 21 | Elfire | 10 | 85 | 0 | 8 | 1-2 | -- | 400 | 200 | R3 shop, treasure |
| 22 | Nosferatu | 7 | 80 | 0 | 8 | 1-2 | Heals user = damage dealt | -- | -- | Enemy/boss only, R3 treasure |

### 5.6 Staves

| # | Name | Might | Hit | Crit | Weight | Range | Special | Buy | Sell | Found |
|---|------|-------|-----|------|--------|-------|---------|-----|------|-------|
| 23 | Heal Staff | 0 | 100 | 0 | 2 | 1 | Heals (MAG + 5) HP | 150 | 75 | Sera starting, R2 shop |
| 24 | Mend Staff | 0 | 100 | 0 | 3 | 1 | Heals (MAG + 10) HP | 350 | 175 | R3 shop |

### 5.7 Consumables

| # | Name | Type | Effect | Buy | Sell | Found |
|---|------|------|--------|-----|------|-------|
| 25 | Vulnerary | Consumable | Heals 10 HP, 3 uses | 80 | 40 | All shops, starting items |
| 26 | Elixir | Consumable | Full HP heal, 1 use | 300 | 150 | R3 shop, R2-R3 treasure |
| 27 | Pure Water | Consumable | +5 RES for 1 battle, 1 use | 60 | 30 | R2+ shops |
| 28 | Speedwing | Consumable | Permanent +2 SPD, 1 use | -- | 250 | R2 treasure only |
| 29 | Energy Drop | Consumable | Permanent +2 STR, 1 use | -- | 250 | R3 treasure only |
| 30 | Door Key | Key Item | Opens locked treasure rooms | 50 | 25 | All shops |

---

## 6. Event Content

Events occur at EVENT locations on the overworld and in dungeon EVENT rooms. Each event presents 2-3 choices with different outcomes.

### 6.1 "The Abandoned Caravan" (Region 1)

> *You find an overturned wagon on the roadside. Supplies are scattered, but you hear growling from the nearby bushes.*

| Choice | Outcome |
|--------|---------|
| **Investigate carefully** (SKL check: best unit's SKL >= 6) | **Success**: +15 gold, +2 food. **Fail**: Ambush! Lose 1 food, random unit takes 5 damage |
| **Take what you can and leave** | +8 gold, +1 food |
| **Set an ambush for the predators** | +10 gold, +5 morale ("Clever tactics impress the party") |

### 6.2 "The Traveling Merchant" (Region 1)

> *A merchant with a heavy pack flags you down. "I've got rare goods, but I'm in a hurry. Quick deals only!"*

| Choice | Outcome |
|--------|---------|
| **Buy supplies** (costs 20 gold) | +5 food |
| **Buy a weapon** (costs 40 gold) | Receive random weapon: Iron Sword, Iron Lance, or Iron Axe |
| **Rob the merchant** | +30 gold, -15 morale |

### 6.3 "The Old Battlefield" (Region 1, Region 2)

> *A field of rusted weapons and broken shields. Some look salvageable.*

| Choice | Outcome |
|--------|---------|
| **Scavenge for weapons** | 50% chance: find 1 random weapon (Iron tier). 50% chance: nothing, but +1 food (rations left behind) |
| **Pay respects to the fallen** | +10 morale, a ghostly figure whispers tactical advice (+5 Hit to all units for next battle -- implement as temporary morale-like buff) |
| **Move on quickly** | No effect |

### 6.4 "The Wounded Healer" (Region 2 -- Sera recruitment fallback)

> *A priestess lies by the road, injured and exhausted. She begs for help.*

| Choice | Outcome |
|--------|---------|
| **Help her and offer supplies** (costs 2 food) | If Sera not yet recruited: she joins the party. If already recruited: +15 morale, +1 Vulnerary |
| **Help her but keep supplies** | +5 morale. If Sera not recruited: she thanks you but moves on (missed recruitment) |
| **Ignore her** | -10 morale |

### 6.5 "The Deserter" (Region 2 -- Garrett recruitment)

> *An armored knight emerges from the forest, hands raised. "Please -- I've fled Baron Cragmaw's forces. I want no more part of this war."*

| Choice | Outcome |
|--------|---------|
| **Accept him into the party** | Garrett joins (Level 3 Cavalier with Steel Lance) |
| **Demand proof of his loyalty** (LCK check: Roy's LCK >= 6) | **Success**: Garrett joins + gives 20 gold. **Fail**: Garrett joins but -5 morale (party distrusts him) |
| **Turn him in for the bounty** | +15 gold, -5 morale |

### 6.6 "The Haunted Bridge" (Region 2)

> *The bridge ahead is draped in fog. Local legends say a spirit guards the crossing. You hear whispers...*

| Choice | Outcome |
|--------|---------|
| **Cross boldly** | 60% chance: nothing happens. 40% chance: random unit cursed, -2 LCK for remainder of run |
| **Leave an offering** (costs 10 gold) | Safe passage, +5 morale, find 1 Pure Water on the other side |
| **Find another way around** | Costs 1 extra food (longer route), but safe |

### 6.7 "The Blazing Shrine" (Region 3)

> *A volcanic shrine glows with ancient fire. An inscription reads: "Offer strength to receive strength."*

| Choice | Outcome |
|--------|---------|
| **Make an offering** (choose a unit: that unit takes 8 damage) | Offered unit gains permanent +2 STR |
| **Pray at the shrine** | +10 morale, all units restore 5 HP |
| **Defile the shrine** | Find 25 gold in the offering bowl, -10 morale, all enemies in next battle gain +1 STR |

### 6.8 "The War Refugees" (Region 2, Region 3)

> *A group of displaced villagers blocks the road, begging for aid.*

| Choice | Outcome |
|--------|---------|
| **Share your supplies** (costs 3 food) | +15 morale, villagers tell you a shortcut (+1 food refund from shorter travel) |
| **Give gold instead** (costs 20 gold) | +10 morale |
| **Push through** | -10 morale, -5 Hit to all units for next battle (guilt weighs on the party) |

### 6.9 "The Dueling Arena" (Region 1, Region 3)

> *A makeshift fighting pit. "Best your champion and win the prize!" shouts a bookie.*

| Choice | Outcome |
|--------|---------|
| **Send your best fighter** (solo combat vs a Mercenary of region level) | **Win**: +40 gold, +5 morale. **Lose**: Chosen unit reduced to 1 HP |
| **Bet on the fight** (costs 15 gold) | 50% chance: +30 gold. 50% chance: lose your 15 gold |
| **Walk away** | No effect |

### 6.10 "The Hermit's Hut" (Region 1)

> *Smoke rises from a tiny cabin. An old hermit offers you tea and wisdom.*

| Choice | Outcome |
|--------|---------|
| **Accept tea and listen** | Random unit gains +1 to a random stat (permanent). Costs nothing but "time" (narrative only) |
| **Ask for supplies** | +2 food, hermit seems disappointed |
| **Ask about the road ahead** | Reveals all locations in current region (all locations become "revealed = true") |

### 6.11 "The Poisoned Well" (Region 2)

> *Your party stops at a well to refill waterskins. The water has a strange color...*

| Choice | Outcome |
|--------|---------|
| **Drink anyway** | 70% chance: fine, +1 food (refilled waterskins). 30% chance: all units take 4 damage (poisoned) |
| **Boil the water first** | +1 food (safe), costs 1 food to make a fire (net 0 food gain, but safe) |
| **Search for the source of contamination** (SKL check: best unit SKL >= 8) | **Success**: Find the source -- a dead animal. Remove it, +2 food, +5 morale. **Fail**: Waste time, nothing found |

### 6.12 "The Mysterious Chest" (Dungeon EVENT rooms, any region)

> *A locked chest sits in the center of the room. It radiates faint magic.*

| Choice | Outcome |
|--------|---------|
| **Force it open** (STR check: best unit STR >= 7) | **Success**: random weapon (one tier above current region's shop). **Fail**: trap, random unit takes 6 damage |
| **Pick the lock** (requires Thief in party) | Always succeeds: random weapon + 15 gold |
| **Leave it** | No effect |

---

## 7. Boss Designs

### 7.1 Region 1 Boss: Roderick the Brigand King

**Location**: "Stone Ruins" dungeon boss room, or as overworld boss at "Eastern Gate" if dungeon is skipped.

**Narrative**: A bandit warlord who controls the Borderlands' eastern pass. Brutal and overconfident.

| Stat | Value |
|------|-------|
| HP | 32 |
| STR | 9 |
| MAG | 0 |
| SKL | 6 |
| SPD | 5 |
| LCK | 3 |
| DEF | 7 |
| RES | 1 |
| MOV | 5 |
| Level | 5 |

- **Class**: Fighter
- **Weapon**: Steel Axe (Might 10, Hit 65, Weight 12) -- custom "Brigand's Cleaver"
- **AI**: Aggressive -- always targets the unit he can deal the most damage to
- **Special Mechanic**: **Rally** -- at the start of every other enemy turn (turns 2, 4, etc.), 1 reinforcement Bandit spawns at the edge of the map (max 2 reinforcements total)
- **Arena**: Open field, some forest tiles for cover. 2 starting Bandits + Roderick.
- **Rewards**: 60 gold, +10 morale, Steel Axe (loot)

**Strategy**: Kill reinforcement Bandits fast or rush Roderick. Lilina's magic bypasses his DEF. Sword users have weapon triangle advantage.

### 7.2 Region 2 Boss: Lady Morgana the Thornwitch

**Location**: "Thornwood Heart" dungeon boss room, at the end of Region 2's dungeon.

**Narrative**: A sorceress who has corrupted the forest. She commands dark magic and undead soldiers. Speaks in riddles.

| Stat | Value |
|------|-------|
| HP | 28 |
| STR | 0 |
| MAG | 12 |
| SKL | 9 |
| SPD | 8 |
| LCK | 6 |
| DEF | 4 |
| RES | 11 |
| MOV | 5 |
| Level | 7 |

- **Class**: Mage
- **Weapon**: Nosferatu (Tome, Might 7, Hit 80, Range 1-2, Weight 8) -- heals herself equal to damage dealt
- **AI**: Smart -- targets the unit with lowest RES. Stays at range 2 when possible.
- **Special Mechanic**: **Thorn Shield** -- at the start of battle, Morgana has a barrier that reduces all incoming damage by 3 (stacks with DEF/RES). The barrier breaks after she takes 15 cumulative damage. Visual cue: purple aura disappears.
- **Arena**: Forest tiles (avoid bonuses), 2 Dark Mages flanking Morgana. One narrow approach path.
- **Rewards**: 80 gold, +10 morale, Nosferatu tome (loot), Elixir

**Strategy**: The Thorn Shield makes chip damage ineffective -- commit to strong attacks. Physical units are best since her DEF is only 4 (vs 11 RES). But Nosferatu healing means you need to burst her down. Use Aldric's axe or Roy's Rapier for raw damage. Sera's healing is critical to survive the Dark Mages' chip damage.

### 7.3 Region 3 Boss: Baron Cragmaw the Iron Tyrant (Final Boss)

**Location**: "Cragmaw's Fortress" -- the final battle of the demo. Overworld boss at the EXIT location of Region 3.

**Narrative**: The warlord whose armies have been pursuing the party. Armored general mounted on a warhorse. The demo's climactic fight.

| Stat | Value |
|------|-------|
| HP | 40 |
| STR | 14 |
| MAG | 0 |
| SKL | 8 |
| SPD | 6 |
| LCK | 4 |
| DEF | 14 |
| RES | 4 |
| MOV | 6 |
| Level | 9 |

- **Class**: Cavalier (unique "General" variant)
- **Weapon**: Silver Lance (Might 12, Hit 80, Weight 10) -- custom "Cragmaw's Lance"
- **AI**: Aggressive -- charges the nearest unit, switches to targeting damaged units for kills
- **Special Mechanic**: **Iron Command** -- all other enemies on the field gain +2 Hit and +1 DMG while Cragmaw is alive. When Cragmaw drops below 50% HP (20 HP), he enters **Fury** mode: +3 STR, +2 SPD, but -3 DEF (becomes more dangerous but vulnerable).
- **Arena**: Castle courtyard. Mix of stone tiles (DEF bonus) and open ground. Starting enemies: 1 Armor Knight, 1 Mercenary, 1 Sniper + Cragmaw.
- **Rewards**: Victory screen. Run complete. Final gold/morale are scored for the run summary.

**Battle Phases**:
1. **Phase 1** (100%-50% HP): Cragmaw at full power with Iron Command aura. Focus on clearing adds first.
2. **Phase 2** (<50% HP): Fury mode. Higher damage but lower DEF. This is the kill window.

**Strategy**: Rapier's armor-effective bonus (2x damage) is the intended counter to his 14 DEF. Lilina's magic also bypasses it. The Hammer (if found) is devastating. Kill the Sniper first to avoid being picked off at range. When Fury activates, Cragmaw's DEF drops to 11 -- more manageable for physical units.

---

## 8. Region Design

### 8.1 Region 1: The Borderlands

**Theme**: Temperate frontier. Farms, forests, rivers, dirt roads. Early-game comfort zone.

**Map Size**: 24x18 tiles (existing map, updated with content assignments)

**Difficulty**: Easy. Teaches core mechanics.

**Locations (15 total)**:

| # | Name | Type | Purpose |
|---|------|------|---------|
| 1 | Frontier Camp | CAMP | Starting location. Tutorial rest. |
| 2 | Pine Crossing | TOWN | First shop. Buy Vulnerary, Iron weapons. |
| 3 | Miller's Rest | EVENT | "The Hermit's Hut" or "Abandoned Caravan" |
| 4 | Northern Bridge | EVENT | "The Traveling Merchant" |
| 5 | Central Crossroads | EVENT | "The Old Battlefield" or Wren fallback recruitment |
| 6 | Riverside Market | TOWN | Recruit Wren. Better shop. |
| 7 | South Junction | BATTLE | Recruit Aldric post-battle. 2 Bandits + 1 Scout |
| 8 | Eastern Farm | EVENT | "The Dueling Arena" |
| 9 | Hilltop Watchtower | BATTLE | 2 Soldiers + 1 Brigand |
| 10 | Stone Ruins | DUNGEON | Region 1 dungeon. Boss: Roderick. Optional. |
| 11 | Borderkeep Castle | TOWN | Pre-exit shop. Best R1 gear. |
| 12 | Eastern Gate | EXIT | If dungeon skipped, Roderick is here as overworld boss. |
| 13 | Southern Shrine | CAMP | Rest point. Heal 30% HP. |
| 14 | Forest Edge | BATTLE | 2 Bandits + 1 Brigand |
| 15 | Far South Road | EVENT | "The Abandoned Caravan" |

**Expected Path**: Start (Camp) -> Pine Crossing (shop) -> 1-2 events -> 1-2 battles -> Riverside Market (recruit Wren) -> South Junction (recruit Aldric) -> Dungeon OR Castle -> Eastern Gate.

**Travel Steps**: 6-9 location hops. Cost: 6-9 food.

**Gold Income (Region 1)**:
- Battles (3): ~15-20 gold each = 45-60 gold
- Events (3): ~10-15 gold average = 30-45 gold
- Dungeon (if entered): ~40-80 gold
- Starting gold: 50
- **Total available**: ~165-235 gold
- **Expected spending**: ~80-120 gold on shop items

### 8.2 Region 2: Thornwood Wilds

**Theme**: Dark enchanted forest. Twisted paths, fog, corrupted wildlife. Mid-game tension.

**Map Size**: 24x18 tiles (new map to create)

**Difficulty**: Medium. New enemy types introduced (Armor Knight, Dark Mage, Rider, Mercenary).

**Locations (14 total)**:

| # | Name | Type | Purpose |
|---|------|------|---------|
| 1 | Forest Gate | CAMP | Entry point. Rest and heal after Region 1. |
| 2 | Thornwood Chapel | TOWN | Recruit Sera. Heal staff shop. |
| 3 | Hollow Tree Inn | TOWN | Mid-region shop. Steel weapons. |
| 4 | Mossy Crossroads | EVENT | "The Deserter" (recruit Garrett) |
| 5 | Webwood Path | BATTLE | 2 Soldiers + 1 Scout |
| 6 | Haunted Bridge | EVENT | "The Haunted Bridge" |
| 7 | Foggy Clearing | BATTLE | 1 Mercenary + 2 Soldiers |
| 8 | Refugee Camp | EVENT | "The War Refugees" |
| 9 | Thornwood Depths | DUNGEON | Region 2 dungeon. Boss: Lady Morgana. |
| 10 | Witch's Watch | BATTLE | 1 Dark Mage + 1 Armor Knight + 1 Rider |
| 11 | Poisoned Well | EVENT | "The Poisoned Well" |
| 12 | Thornwood Heart | BATTLE | 1 Armor Knight + 2 Dark Mages (pre-boss area) |
| 13 | Forest Exit | EXIT | Advance to Region 3 |
| 14 | Hidden Grove | CAMP | Secret rest point. Off the main path. |

**Expected Path**: Forest Gate (rest) -> Thornwood Chapel (recruit Sera, shop) -> 2-3 events/battles -> Hollow Tree Inn (shop) -> Dungeon or more battles -> Forest Exit.

**Travel Steps**: 7-10 location hops. Cost: 7-10 food.

**Gold Income (Region 2)**:
- Battles (3-4): ~20-30 gold each = 60-120 gold
- Events (3): ~10-20 gold average = 30-60 gold
- Dungeon: ~60-100 gold
- Carried from R1: ~80-150 gold
- **Total available**: ~230-430 gold
- **Expected spending**: ~150-250 gold on steel weapons, healing items

### 8.3 Region 3: Ashfall Peaks

**Theme**: Volcanic mountains. Ash-covered paths, lava flows (impassable), crumbling ruins. Endgame.

**Map Size**: 24x18 tiles (new map to create)

**Difficulty**: Hard. All enemy types present. Tighter resources.

**Locations (12 total)**:

| # | Name | Type | Purpose |
|---|------|------|---------|
| 1 | Mountain Pass | CAMP | Entry point from Region 2. |
| 2 | Ashfall Outpost | TOWN | Recruit Isolde. Best shop. |
| 3 | Lava Bridge | EVENT | "The Blazing Shrine" |
| 4 | Ember Ridge | BATTLE | 2 Mercenaries + 1 Sniper |
| 5 | Scorched Village | EVENT | "The War Refugees" |
| 6 | Ash Crater | DUNGEON | Region 3 optional dungeon (short -- 8 rooms). |
| 7 | Iron Mine | BATTLE | 1 Armor Knight + 1 Shaman + 2 Soldiers |
| 8 | Clifftop Camp | CAMP | Last rest before boss. |
| 9 | The Gauntlet | BATTLE | 1 Rider + 1 Sniper + 1 Mercenary + 1 Shaman |
| 10 | Cragmaw's Gate | BATTLE | Pre-boss. 2 Armor Knights + 1 Dark Mage |
| 11 | Cragmaw's Fortress | EXIT | Final boss: Baron Cragmaw. |
| 12 | Dueling Pit | EVENT | "The Dueling Arena" (higher stakes) |

**Expected Path**: Mountain Pass -> Ashfall Outpost (recruit Isolde, shop) -> 2-3 battles -> Clifftop Camp (rest) -> Cragmaw's Fortress.

**Travel Steps**: 6-8 location hops. Cost: 6-8 food.

**Gold Income (Region 3)**:
- Battles (3-4): ~25-40 gold each = 75-160 gold
- Events (2): ~15-25 gold average = 30-50 gold
- Dungeon (if entered): ~60-100 gold
- Carried from R2: ~80-180 gold
- **Total available**: ~245-490 gold
- **Expected spending**: ~200-350 gold (silver weapons, elixirs)

---

## 9. Shop Inventories

### 9.1 Region 1 Shops

#### Pine Crossing (Early Shop)

| Item | Price |
|------|-------|
| Iron Sword | 100 |
| Iron Lance | 120 |
| Iron Axe | 90 |
| Iron Bow | 120 |
| Vulnerary (3 uses) | 80 |
| Door Key | 50 |

**Food available**: 3 food for 15 gold each = 45 gold for full restock

#### Riverside Market (Mid-Region Shop)

| Item | Price |
|------|-------|
| Iron Sword | 100 |
| Iron Lance | 120 |
| Iron Axe | 90 |
| Iron Bow | 120 |
| Fire (Tome) | 150 |
| Hand Axe | 250 |
| Vulnerary (3 uses) | 80 |
| Door Key | 50 |

**Food available**: 5 food for 15 gold each

#### Borderkeep Castle (Pre-Exit Shop)

| Item | Price |
|------|-------|
| Iron Sword | 100 |
| Steel Sword | 200 |
| Iron Lance | 120 |
| Hand Axe | 250 |
| Fire (Tome) | 150 |
| Vulnerary (3 uses) | 80 |
| Vulnerary (3 uses) | 80 |

**Food available**: 5 food for 15 gold each

### 9.2 Region 2 Shops

#### Thornwood Chapel

| Item | Price |
|------|-------|
| Heal Staff | 150 |
| Vulnerary (3 uses) | 80 |
| Pure Water | 60 |

**Food available**: 3 food for 20 gold each

#### Hollow Tree Inn (Main R2 Shop)

| Item | Price |
|------|-------|
| Steel Sword | 200 |
| Steel Lance | 220 |
| Steel Axe | 200 |
| Javelin | 300 |
| Thunder (Tome) | 250 |
| Heal Staff | 150 |
| Vulnerary (3 uses) | 80 |
| Pure Water | 60 |
| Door Key | 50 |

**Food available**: 5 food for 20 gold each

### 9.3 Region 3 Shops

#### Ashfall Outpost (Final Shop)

| Item | Price |
|------|-------|
| Steel Sword | 200 |
| Killing Edge | 350 |
| Silver Lance | 500 |
| Steel Axe | 200 |
| Hammer | 350 |
| Steel Bow | 250 |
| Longbow | 350 |
| Elfire (Tome) | 400 |
| Mend Staff | 350 |
| Vulnerary (3 uses) | 80 |
| Elixir (1 use) | 300 |
| Pure Water | 60 |

**Food available**: 5 food for 25 gold each

---

## 10. Balance Analysis

### 10.1 Expected Stat Progression

Average party unit stats at each region milestone (accounting for growth rates and level-ups):

**Roy (Lord)** -- high growth, central to the party:

| Region | Level | HP | STR | SPD | SKL | DEF |
|--------|-------|----|-----|-----|-----|-----|
| R1 Start | 1 | 22 | 6 | 7 | 6 | 5 |
| R1 End | 3 | 23-24 | 7 | 8 | 7 | 5-6 |
| R2 End | 5 | 25-26 | 8 | 9 | 8-9 | 6 |
| R3 Boss | 7 | 27-28 | 9-10 | 10 | 10 | 7 |

**Marcus (Knight)** -- low growth, starts strong:

| Region | Level | HP | STR | SPD | DEF |
|--------|-------|----|-----|-----|-----|
| R1 Start | 3 | 28 | 8 | 3 | 10 |
| R1 End | 4 | 28-29 | 8 | 3 | 10 |
| R2 End | 5 | 29 | 8-9 | 3-4 | 10-11 |
| R3 Boss | 6 | 29-30 | 9 | 4 | 11 |

**Average recruit** (Wren/Aldric/Sera/Garrett/Isolde):

| Region | Level | Approx Combat Stats |
|--------|-------|---------------------|
| Recruited | 1-4 | As listed in unit definitions |
| +2 levels | +2 | +1-2 to primary stats, +1 HP |
| +4 levels | +4 | +2-3 to primary stats, +2 HP |

### 10.2 Damage Math Validation

Key combat scenarios to verify balance works:

**Early R1: Roy (Rapier) vs Bandit**
```
Roy ATK = 6 STR + 5 Might = 11
Bandit Armor = 3 DEF
Bandit effective HP = 18 HP + 3 Armor = 21
Damage per hit = 11 (ATK is raw, armor absorbs first)
  -> 3 armor absorbed, then 8 to HP
Roy Hit = 6*2 + 7 + 95 = 114 - Bandit Avoid (4*2+2=10) = 104 -> capped at 100%
Roy AS = 7 - max(0, 3-6) = 7. Bandit AS = 4 - max(0, 7-5)=4. Diff = 3. No double.
Result: 2 hits to kill. Roy takes 1 counter.
```

**Mid R2: Lilina (Thunder) vs Armor Knight**
```
Lilina ATK = ~9 MAG + 7 Might = 16
Armor Knight Armor = 12 DEF (but magic ignores DEF in GDD... checking code)
```

**NOTE**: The current combat code (`_calculate_damage`) does NOT subtract defender DEF or RES. It only returns `attack_power + triangle_bonus`. Damage reduction happens in `UnitData.take_damage()` where armor (equal to DEF stat) absorbs first. This means:

```
Effective damage flow:
1. Raw damage = ATK + triangle
2. Armor absorbs up to current_armor amount
3. Remaining goes to HP

So Lilina (16 ATK) vs Armor Knight (12 armor):
  -> 12 absorbed by armor, 4 to HP
  -> Next hit: armor gone, 16 to HP
  -> 2 hits to kill (26 HP knight)... actually 12+14 HP left after armor.
     Hit 1: 16 raw -> 12 armor absorbed, 4 to HP (22 HP remaining)
     Hit 2: 16 raw -> 0 armor left, 16 to HP (6 HP remaining)
     Hit 3: 16 raw -> kills

For physical: Roy (11 ATK) vs Armor Knight (12 armor):
  Hit 1: 11 raw -> 11 armor absorbed, 0 to HP (1 armor remaining)
  Hit 2: 11 raw -> 1 armor absorbed, 10 to HP (16 HP remaining)
  Hit 3: 11 raw -> 0 armor, 11 to HP (5 HP remaining)
  Hit 4: kills
```

This means the armor system makes DEF very strong in the first hit but deteriorating. Magic and physical work the same way against armor. The balance lever is that armor resets per combat room, so chip damage between rooms does not matter for armor, only HP.

**Late R3: Roy (Steel Sword) vs Cragmaw**
```
Roy ATK = ~10 STR + 8 Might = 18 (+1 weapon triangle vs lance = 19)
Cragmaw Armor = 14 DEF
  Hit 1: 19 raw -> 14 absorbed, 5 to HP (35 HP remaining)
  Hit 2: 19 raw -> 0 armor, 19 to HP (16 HP remaining)
  Hit 3: 19 raw -> kills (if Fury hasn't activated with DEF drop)

With Rapier (armor effective 2x): ATK = 10+5 = 15, but 2x = 30
  Hit 1: 30 raw -> 14 absorbed, 16 to HP (24 HP remaining)
  Hit 2: 30 raw -> 0 armor, 30 to HP -> kills
```

The Rapier is the intended answer to Cragmaw. Without it, the fight takes 3-4 rounds of full party attacks. With it, Roy can two-round the boss. This is the reward for keeping Roy alive and using his unique weapon.

### 10.3 Gold Economy

| Phase | Income | Expenses | Net |
|-------|--------|----------|-----|
| Starting | 50 | 0 | 50 |
| Region 1 | 75-125 (battles + events) | 80-120 (iron weapons, vulneraries, food) | 45-55 |
| Region 2 | 90-180 (battles + events + dungeon) | 150-250 (steel weapons, staves, food) | -15 to -15 |
| Region 3 | 100-200 (battles + events) | 200-350 (silver weapons, elixirs, food) | Deficit |

**Design Intent**: Gold should feel tight. The player can afford to upgrade most of their party's weapons but NOT all to silver tier. They must choose: upgrade a few units to silver, or spread iron/steel across everyone. The Killing Edge and Hammer are luxury purchases that compete with Elixirs for survival gold.

**Target gold at each milestone**:
- End of R1: 80-130 gold remaining
- End of R2: 50-100 gold remaining
- R3 shop: Spend most remaining gold, enter final battles with 0-30 gold

### 10.4 Food/Supply Pressure

| Region | Food Available | Food Consumed | Net |
|--------|---------------|---------------|-----|
| Start | 10 | 0 | 10 |
| R1 | +7-10 (events, shops) | 6-9 (travel) | 8-11 |
| R2 | +5-8 (events, shops) | 7-10 (travel) | 6-9 |
| R3 | +3-5 (events, shops) | 6-8 (travel) | 3-6 |

**Design Intent**: Food should never be truly abundant but shouldn't cause starvation if the player plans ahead. Region 3 is tightest. Buying food costs gold that could go to weapons, creating a tension. Starvation (hitting 0 food) should happen ~10% of runs as a punishment for poor planning.

### 10.5 Level Curve

Expected party average level at each milestone:

| Milestone | Expected Avg Level | Enemy Level Range |
|-----------|-------------------|-------------------|
| R1 Start | 1.7 (Roy 1, Marcus 3, Lilina 1) | 1-2 |
| R1 End | 2.5-3.5 | 2-5 (boss) |
| R2 Start | 3-4 (new recruits even it out) | 3-4 |
| R2 End | 4.5-5.5 | 4-7 (boss) |
| R3 Start | 5-6 | 5-6 |
| R3 Boss | 6-8 | 6-9 (boss) |

**EXP per battle**: ~30-50 EXP per participating unit per battle (varies by level difference). 100 EXP = 1 level. So ~2-3 battles per level-up.

**Total battles in a run**: 8-12. That is 4-6 level-ups per unit across the run, which aligns with the progression table.

---

## 11. Difficulty Scaling

### 11.1 Enemy Stat Scaling by Region

All enemy stats are computed as:
```gdscript
func _scale_enemy_stat(base: int, scaling: int, region: int) -> int:
    return base + (region - 1) * scaling
```

Summary of effective enemy power by region:

| Region | Avg Enemy HP | Avg Enemy ATK | Avg Enemy DEF | Avg Enemy SPD |
|--------|-------------|---------------|---------------|---------------|
| 1 | 18-24 | 8-13 | 3-5 | 3-5 |
| 2 | 22-29 | 12-18 | 5-12 | 5-8 |
| 3 | 22-34 | 14-22 | 4-14 | 6-13 |

(ATK = STR + weapon might. Ranges represent variety across enemy types.)

### 11.2 Encounter Sizing

| Region | Normal Battle | Elite Battle | Boss Fight |
|--------|--------------|-------------|------------|
| 1 | 2-3 enemies | 3 enemies (1 elite) | 3 enemies + boss |
| 2 | 3-4 enemies | 4 enemies (1 elite) | 3 enemies + boss |
| 3 | 3-5 enemies | 4-5 enemies (1-2 elite) | 4 enemies + boss |

### 11.3 Elite Frequency

| Context | Elite Chance |
|---------|-------------|
| Overworld BATTLE | 0% (fixed compositions) |
| Dungeon COMBAT room | 0% |
| Dungeon ELITE room | 100% (1 elite + 1-2 normal) |
| Dungeon generation elite room rate | ~10-12% of rooms |

### 11.4 Boss Difficulty Relative to Party

| Boss | Boss Level | Expected Party Avg | Level Advantage |
|------|-----------|-------------------|-----------------|
| Roderick (R1) | 5 | 3 | Boss +2 |
| Morgana (R2) | 7 | 5 | Boss +2 |
| Cragmaw (R3) | 9 | 7 | Boss +2 |

Bosses are always ~2 levels above the party average, making them a genuine threat but not impossible. The special mechanics (reinforcements, Thorn Shield, Iron Command/Fury) add strategic depth beyond raw stats.

### 11.5 Death Rate Expectations

Target: 1-2 unit deaths per successful run.

**Where deaths are most likely**:
- Region 1: Unlikely unless player makes a major tactical error. Brigands are the biggest threat (high STR).
- Region 2: First realistic death window. Armor Knights + Dark Mages create pinch points. Scouts targeting the backline can kill Lilina or Sera.
- Region 3: Most deaths happen here. Snipers and Shamans create unavoidable damage. Cragmaw boss fight is the highest death risk.

**Unit most likely to die**: Marcus (low SPD means he gets doubled by Region 2+ enemies, and his low growth means he falls behind). This is intentional -- the Jagen archetype serves as an early crutch and a meaningful loss when he eventually falls.

---

## 12. Implementation Reference

### 12.1 Key Constants for Code

```gdscript
# content_constants.gd (suggested autoload or const file)

# Economy
const STARTING_GOLD: int = 50
const STARTING_FOOD: int = 10
const FOOD_PRICE_R1: int = 15
const FOOD_PRICE_R2: int = 20
const FOOD_PRICE_R3: int = 25

# Combat rewards
const GOLD_PER_BATTLE_R1: Array = [12, 20]  # [min, max]
const GOLD_PER_BATTLE_R2: Array = [20, 30]
const GOLD_PER_BATTLE_R3: Array = [25, 40]
const GOLD_ELITE_MULTIPLIER: float = 2.0
const EXP_PER_KILL_BASE: int = 30
const EXP_LEVEL_DIFF_BONUS: int = 10  # Extra EXP per level enemy is above unit

# Boss rewards
const GOLD_BOSS_R1: int = 60
const GOLD_BOSS_R2: int = 80
const GOLD_BOSS_R3: int = 0  # Final boss, run ends

# Dungeon gold (per room type)
const DUNGEON_COMBAT_GOLD: Array = [10, 20]
const DUNGEON_ELITE_GOLD: Array = [25, 40]
const DUNGEON_TREASURE_GOLD: Array = [30, 50]
const DUNGEON_BOSS_GOLD: Array = [50, 100]

# Recruitment
const ISOLDE_RECRUIT_COST: int = 30
const ISOLDE_FREE_IF_UNITS_LOST: int = 2

# Morale changes
const MORALE_UNIT_DEATH: int = -10
const MORALE_STARVATION: int = -15
const MORALE_DUNGEON_COMPLETE: int = 10
const MORALE_DUNGEON_FLEE: int = -5
const MORALE_REST: int = 10
const MORALE_BOSS_KILL: int = 10

# Boss special mechanics
const RODERICK_REINFORCEMENT_TURNS: Array = [2, 4]  # Turns when reinforcements spawn
const RODERICK_MAX_REINFORCEMENTS: int = 2
const MORGANA_THORN_SHIELD_REDUCTION: int = 3
const MORGANA_THORN_SHIELD_HP: int = 15  # Cumulative damage to break
const CRAGMAW_FURY_THRESHOLD: float = 0.5  # 50% HP
const CRAGMAW_FURY_STR_BONUS: int = 3
const CRAGMAW_FURY_SPD_BONUS: int = 2
const CRAGMAW_FURY_DEF_PENALTY: int = 3
const CRAGMAW_IRON_COMMAND_HIT: int = 2
const CRAGMAW_IRON_COMMAND_DMG: int = 1
```

### 12.2 Starter Unit Code Fixes

The current `GameManager.start_new_run()` does not set all stats (SKL, LCK, MAG, RES, MOV) or growth rates. Here is the corrected initialization:

```gdscript
func start_new_run() -> void:
    is_run_active = true
    current_floor = 1
    current_node_id = -1

    party.clear()
    gold = 50
    food = 10
    morale = 100

    battles_won = 0
    units_lost = 0
    nodes_visited = 0

    run_started.emit()

    # --- Roy (LORD) ---
    var u1 = UnitData.new()
    u1.unit_name = "Roy"
    u1.unit_class = UnitData.UnitClass.LORD
    u1.level = 1
    u1.max_hp = 22; u1.current_hp = 22
    u1.strength = 6; u1.magic = 0; u1.skill = 6
    u1.speed = 7; u1.luck = 7; u1.defense = 5; u1.resistance = 2
    u1.current_armor = u1.defense
    u1.movement = 5
    u1.hp_growth = 60; u1.str_growth = 45; u1.mag_growth = 5
    u1.skl_growth = 50; u1.spd_growth = 45; u1.lck_growth = 60
    u1.def_growth = 30; u1.res_growth = 25
    var i1 = ItemData.new()
    i1.item_name = "Rapier"; i1.weapon_type = ItemData.WeaponType.SWORD
    i1.might = 5; i1.hit = 95; i1.crit = 10; i1.weight = 3
    i1.range_min = 1; i1.range_max = 1
    i1.is_unbreakable = true; i1.buy_price = 0; i1.sell_price = 0
    u1.equipped_weapon = i1
    add_unit(u1)

    # --- Marcus (KNIGHT) ---
    var u2 = UnitData.new()
    u2.unit_name = "Marcus"
    u2.unit_class = UnitData.UnitClass.KNIGHT
    u2.level = 3
    u2.max_hp = 28; u2.current_hp = 28
    u2.strength = 8; u2.magic = 0; u2.skill = 5
    u2.speed = 3; u2.luck = 5; u2.defense = 10; u2.resistance = 2
    u2.current_armor = u2.defense
    u2.movement = 4
    u2.hp_growth = 40; u2.str_growth = 30; u2.mag_growth = 0
    u2.skl_growth = 25; u2.spd_growth = 15; u2.lck_growth = 20
    u2.def_growth = 25; u2.res_growth = 15
    var i2 = ItemData.new()
    i2.item_name = "Iron Lance"; i2.weapon_type = ItemData.WeaponType.LANCE
    i2.might = 7; i2.hit = 80; i2.crit = 0; i2.weight = 8
    i2.range_min = 1; i2.range_max = 1
    i2.is_unbreakable = true; i2.buy_price = 120; i2.sell_price = 60
    u2.equipped_weapon = i2
    add_unit(u2)

    # --- Lilina (MAGE) ---
    var u3 = UnitData.new()
    u3.unit_name = "Lilina"
    u3.unit_class = UnitData.UnitClass.MAGE
    u3.level = 1
    u3.max_hp = 18; u3.current_hp = 18
    u3.strength = 1; u3.magic = 8; u3.skill = 6
    u3.speed = 6; u3.luck = 7; u3.defense = 3; u3.resistance = 5
    u3.current_armor = u3.defense
    u3.movement = 5
    u3.hp_growth = 40; u3.str_growth = 5; u3.mag_growth = 55
    u3.skl_growth = 40; u3.spd_growth = 40; u3.lck_growth = 50
    u3.def_growth = 15; u3.res_growth = 35
    var i3 = ItemData.new()
    i3.item_name = "Fire"; i3.weapon_type = ItemData.WeaponType.TOME
    i3.might = 5; i3.hit = 90; i3.crit = 0; i3.weight = 4
    i3.range_min = 1; i3.range_max = 2
    i3.is_unbreakable = true; i3.buy_price = 150; i3.sell_price = 75
    u3.equipped_weapon = i3
    add_unit(u3)

    print("[GameManager] New run started with 3 units")
```

### 12.3 Enemy Factory Function

Suggested function for creating enemies from the roster:

```gdscript
# enemy_factory.gd
class_name EnemyFactory

enum EnemyType {
    BANDIT, SOLDIER, BRIGAND, MERCENARY,
    ARMOR_KNIGHT, DARK_MAGE, SCOUT, RIDER,
    SNIPER, SHAMAN
}

static func create_enemy(type: EnemyType, region: int, is_elite: bool = false) -> UnitData:
    var unit = UnitData.new()
    unit.is_player_unit = false

    match type:
        EnemyType.BANDIT:
            unit.unit_name = "Veteran Bandit" if is_elite else "Bandit"
            unit.unit_class = UnitData.UnitClass.FIGHTER
            unit.level = 1 + (region - 1) * 2
            unit.max_hp = 18 + (region - 1) * 4
            unit.strength = 5 + (region - 1) * 2
            unit.skill = 3 + (region - 1)
            unit.speed = 4 + (region - 1)
            unit.luck = 2 + (region - 1)
            unit.defense = 3 + (region - 1)
            unit.resistance = (region - 1)
            unit.movement = 5
            var w = ItemData.new()
            w.item_name = "Hand Axe"; w.weapon_type = ItemData.WeaponType.AXE
            w.might = 5; w.hit = 75; w.weight = 7
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.SOLDIER:
            unit.unit_name = "Shield Soldier" if is_elite else "Soldier"
            unit.unit_class = UnitData.UnitClass.FIGHTER
            unit.level = 1 + (region - 1) * 2
            unit.max_hp = 20 + (region - 1) * 4
            unit.strength = 5 + (region - 1) * 2
            unit.skill = 5 + (region - 1) * 2
            unit.speed = 4 + (region - 1)
            unit.luck = 3 + (region - 1)
            unit.defense = 5 + (region - 1) * 2
            unit.resistance = 1 + (region - 1)
            unit.movement = 4
            var w = ItemData.new()
            w.item_name = "Iron Lance"; w.weapon_type = ItemData.WeaponType.LANCE
            w.might = 7; w.hit = 80; w.weight = 8
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.BRIGAND:
            unit.unit_name = "Ironclad Brigand" if is_elite else "Brigand"
            unit.unit_class = UnitData.UnitClass.FIGHTER
            unit.level = 2 + (region - 1) * 2
            unit.max_hp = 24 + (region - 1) * 5
            unit.strength = 8 + (region - 1) * 2
            unit.skill = 2 + (region - 1)
            unit.speed = 2 + (region - 1)
            unit.luck = 1 + (region - 1)
            unit.defense = 3 + (region - 1) * 2
            unit.resistance = 0
            unit.movement = 5
            var w = ItemData.new()
            w.item_name = "Steel Axe"; w.weapon_type = ItemData.WeaponType.AXE
            w.might = 8; w.hit = 65; w.weight = 10
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.MERCENARY:
            unit.unit_name = "Blade Mercenary" if is_elite else "Mercenary"
            unit.unit_class = UnitData.UnitClass.FIGHTER
            unit.level = 3 + (region - 2) * 3
            unit.max_hp = 22 + (region - 2) * 4
            unit.strength = 7 + (region - 2) * 2
            unit.skill = 8 + (region - 2) * 2
            unit.speed = 8 + (region - 2) * 2
            unit.luck = 4 + (region - 2)
            unit.defense = 5 + (region - 2)
            unit.resistance = 2 + (region - 2)
            unit.movement = 5
            var w = ItemData.new()
            w.item_name = "Iron Sword"; w.weapon_type = ItemData.WeaponType.SWORD
            w.might = 5; w.hit = 90; w.weight = 5
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.ARMOR_KNIGHT:
            unit.unit_name = "Ironclad Knight" if is_elite else "Armor Knight"
            unit.unit_class = UnitData.UnitClass.KNIGHT
            unit.level = 4 + (region - 2) * 2
            unit.max_hp = 26 + (region - 2) * 4
            unit.strength = 8 + (region - 2) * 2
            unit.skill = 4 + (region - 2)
            unit.speed = 1 + (region - 2)
            unit.luck = 2 + (region - 2)
            unit.defense = 12 + (region - 2) * 2
            unit.resistance = 1 + (region - 2)
            unit.movement = 3
            var w = ItemData.new()
            w.item_name = "Steel Lance"; w.weapon_type = ItemData.WeaponType.LANCE
            w.might = 8; w.hit = 75; w.weight = 10
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.DARK_MAGE:
            unit.unit_name = "Shadow Mage" if is_elite else "Dark Mage"
            unit.unit_class = UnitData.UnitClass.MAGE
            unit.level = 3 + (region - 2) * 2
            unit.max_hp = 18 + (region - 2) * 3
            unit.magic = 7 + (region - 2) * 2
            unit.skill = 6 + (region - 2)
            unit.speed = 5 + (region - 2) * 2
            unit.luck = 3 + (region - 2)
            unit.defense = 2 + (region - 2)
            unit.resistance = 6 + (region - 2) * 2
            unit.movement = 5
            var w = ItemData.new()
            w.item_name = "Flux"; w.weapon_type = ItemData.WeaponType.TOME
            w.might = 5; w.hit = 85; w.weight = 6
            w.range_min = 1; w.range_max = 2
            unit.equipped_weapon = w

        EnemyType.SCOUT:
            unit.unit_name = "Veteran Scout" if is_elite else "Scout"
            unit.unit_class = UnitData.UnitClass.THIEF
            unit.level = 1 + (region - 1) * 2
            unit.max_hp = 16 + (region - 1) * 3
            unit.strength = 4 + (region - 1)
            unit.skill = 6 + (region - 1) * 2
            unit.speed = 9 + (region - 1) * 2
            unit.luck = 5 + (region - 1)
            unit.defense = 2 + (region - 1)
            unit.resistance = 1 + (region - 1)
            unit.movement = 6
            var w = ItemData.new()
            w.item_name = "Iron Dagger"; w.weapon_type = ItemData.WeaponType.SWORD
            w.might = 3; w.hit = 95; w.weight = 2
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.RIDER:
            unit.unit_name = "Iron Rider" if is_elite else "Rider"
            unit.unit_class = UnitData.UnitClass.CAVALIER
            unit.level = 4 + (region - 2) * 2
            unit.max_hp = 24 + (region - 2) * 4
            unit.strength = 7 + (region - 2) * 2
            unit.skill = 5 + (region - 2)
            unit.speed = 6 + (region - 2) * 2
            unit.luck = 3 + (region - 2)
            unit.defense = 6 + (region - 2) * 2
            unit.resistance = 2 + (region - 2)
            unit.movement = 7
            var w = ItemData.new()
            w.item_name = "Iron Lance"; w.weapon_type = ItemData.WeaponType.LANCE
            w.might = 7; w.hit = 80; w.weight = 8
            w.range_min = 1; w.range_max = 1
            unit.equipped_weapon = w

        EnemyType.SNIPER:
            unit.unit_name = "Deadeye Sniper" if is_elite else "Sniper"
            unit.unit_class = UnitData.UnitClass.ARCHER
            unit.level = 5
            unit.max_hp = 22; unit.strength = 8; unit.skill = 10
            unit.speed = 7; unit.luck = 4; unit.defense = 4
            unit.resistance = 3; unit.movement = 5
            var w = ItemData.new()
            w.item_name = "Iron Bow"; w.weapon_type = ItemData.WeaponType.BOW
            w.might = 6; w.hit = 85; w.weight = 5
            w.range_min = 2; w.range_max = 2
            unit.equipped_weapon = w

        EnemyType.SHAMAN:
            unit.unit_name = "Elder Shaman" if is_elite else "Shaman"
            unit.unit_class = UnitData.UnitClass.MAGE
            unit.level = 6
            unit.max_hp = 20; unit.magic = 10; unit.skill = 7
            unit.speed = 6; unit.luck = 3; unit.defense = 3
            unit.resistance = 9; unit.movement = 5
            var w = ItemData.new()
            w.item_name = "Nosferatu"; w.weapon_type = ItemData.WeaponType.TOME
            w.might = 7; w.hit = 80; w.weight = 8
            w.range_min = 1; w.range_max = 2
            unit.equipped_weapon = w

    # Apply elite modifiers
    if is_elite:
        unit.max_hp = int(unit.max_hp * 1.4)
        unit.strength += 2
        unit.magic += 2
        unit.defense += 2
        unit.resistance += 2
        unit.skill += 1
        unit.speed += 1

    # Finalize
    unit.current_hp = unit.max_hp
    unit.current_armor = unit.defense

    return unit
```

### 12.4 Recruit Factory Function

```gdscript
# recruit_factory.gd
class_name RecruitFactory

enum RecruitID { WREN, ALDRIC, SERA, GARRETT, ISOLDE }

static func create_recruit(id: RecruitID) -> UnitData:
    var unit = UnitData.new()
    unit.is_player_unit = true

    match id:
        RecruitID.WREN:
            unit.unit_name = "Wren"
            unit.unit_class = UnitData.UnitClass.THIEF
            unit.level = 1
            unit.max_hp = 19; unit.strength = 4; unit.magic = 0
            unit.skill = 8; unit.speed = 10; unit.luck = 9
            unit.defense = 3; unit.resistance = 1; unit.movement = 6
            unit.hp_growth = 45; unit.str_growth = 30; unit.mag_growth = 0
            unit.skl_growth = 55; unit.spd_growth = 60; unit.lck_growth = 55
            unit.def_growth = 15; unit.res_growth = 10
            var w = ItemData.new()
            w.item_name = "Iron Dagger"; w.weapon_type = ItemData.WeaponType.SWORD
            w.might = 3; w.hit = 95; w.crit = 5; w.weight = 2
            w.is_unbreakable = true; w.buy_price = 60; w.sell_price = 30
            unit.equipped_weapon = w
            # Starting inventory: Vulnerary
            var vuln = ItemData.new()
            vuln.item_name = "Vulnerary"; vuln.item_type = ItemData.ItemType.CONSUMABLE
            vuln.heal_amount = 10; vuln.max_uses = 3; vuln.current_uses = 3
            vuln.buy_price = 80; vuln.sell_price = 40
            unit.inventory.append(vuln)

        RecruitID.ALDRIC:
            unit.unit_name = "Aldric"
            unit.unit_class = UnitData.UnitClass.FIGHTER
            unit.level = 2
            unit.max_hp = 24; unit.strength = 8; unit.magic = 0
            unit.skill = 5; unit.speed = 5; unit.luck = 3
            unit.defense = 4; unit.resistance = 1; unit.movement = 5
            unit.hp_growth = 65; unit.str_growth = 50; unit.mag_growth = 0
            unit.skl_growth = 35; unit.spd_growth = 30; unit.lck_growth = 20
            unit.def_growth = 25; unit.res_growth = 10
            var w = ItemData.new()
            w.item_name = "Iron Axe"; w.weapon_type = ItemData.WeaponType.AXE
            w.might = 6; w.hit = 75; w.crit = 0; w.weight = 7
            w.is_unbreakable = true; w.buy_price = 90; w.sell_price = 45
            unit.equipped_weapon = w

        RecruitID.SERA:
            unit.unit_name = "Sera"
            unit.unit_class = UnitData.UnitClass.CLERIC
            unit.level = 2
            unit.max_hp = 20; unit.strength = 1; unit.magic = 6
            unit.skill = 5; unit.speed = 6; unit.luck = 8
            unit.defense = 2; unit.resistance = 7; unit.movement = 5
            unit.hp_growth = 45; unit.str_growth = 5; unit.mag_growth = 45
            unit.skl_growth = 35; unit.spd_growth = 35; unit.lck_growth = 55
            unit.def_growth = 10; unit.res_growth = 45
            var w = ItemData.new()
            w.item_name = "Heal Staff"; w.weapon_type = ItemData.WeaponType.STAFF
            w.might = 0; w.hit = 100; w.crit = 0; w.weight = 2
            w.range_min = 1; w.range_max = 1
            w.is_unbreakable = true; w.buy_price = 150; w.sell_price = 75
            unit.equipped_weapon = w
            # Starting inventory: Vulnerary
            var vuln = ItemData.new()
            vuln.item_name = "Vulnerary"; vuln.item_type = ItemData.ItemType.CONSUMABLE
            vuln.heal_amount = 10; vuln.max_uses = 3; vuln.current_uses = 3
            vuln.buy_price = 80; vuln.sell_price = 40
            unit.inventory.append(vuln)

        RecruitID.GARRETT:
            unit.unit_name = "Garrett"
            unit.unit_class = UnitData.UnitClass.CAVALIER
            unit.level = 3
            unit.max_hp = 23; unit.strength = 7; unit.magic = 0
            unit.skill = 6; unit.speed = 7; unit.luck = 4
            unit.defense = 6; unit.resistance = 2; unit.movement = 7
            unit.hp_growth = 55; unit.str_growth = 45; unit.mag_growth = 0
            unit.skl_growth = 35; unit.spd_growth = 40; unit.lck_growth = 25
            unit.def_growth = 30; unit.res_growth = 15
            var w = ItemData.new()
            w.item_name = "Steel Lance"; w.weapon_type = ItemData.WeaponType.LANCE
            w.might = 8; w.hit = 75; w.crit = 0; w.weight = 10
            w.is_unbreakable = true; w.buy_price = 220; w.sell_price = 110
            unit.equipped_weapon = w

        RecruitID.ISOLDE:
            unit.unit_name = "Isolde"
            unit.unit_class = UnitData.UnitClass.ARCHER
            unit.level = 4
            unit.max_hp = 21; unit.strength = 7; unit.magic = 0
            unit.skill = 9; unit.speed = 8; unit.luck = 5
            unit.defense = 4; unit.resistance = 3; unit.movement = 5
            unit.hp_growth = 50; unit.str_growth = 40; unit.mag_growth = 0
            unit.skl_growth = 55; unit.spd_growth = 45; unit.lck_growth = 30
            unit.def_growth = 20; unit.res_growth = 20
            var w = ItemData.new()
            w.item_name = "Steel Bow"; w.weapon_type = ItemData.WeaponType.BOW
            w.might = 9; w.hit = 80; w.crit = 0; w.weight = 8
            w.range_min = 2; w.range_max = 2
            w.is_unbreakable = true; w.buy_price = 250; w.sell_price = 125
            unit.equipped_weapon = w

    # Finalize
    unit.current_hp = unit.max_hp
    unit.current_armor = unit.defense

    return unit
```

### 12.5 Event Data Schema

Suggested JSON structure for event definitions (loaded by an event system):

```json
{
    "id": "abandoned_caravan",
    "name": "The Abandoned Caravan",
    "region": [1],
    "description": "You find an overturned wagon on the roadside. Supplies are scattered, but you hear growling from the nearby bushes.",
    "choices": [
        {
            "text": "Investigate carefully",
            "check": {"stat": "skill", "threshold": 6, "mode": "best_unit"},
            "success": {"gold": 15, "food": 2},
            "failure": {"food": -1, "damage_random_unit": 5}
        },
        {
            "text": "Take what you can and leave",
            "result": {"gold": 8, "food": 1}
        },
        {
            "text": "Set an ambush for the predators",
            "result": {"gold": 10, "morale": 5}
        }
    ]
}
```

### 12.6 Weapon Special Effects to Implement

The following weapon special effects need code support:

| Effect | Weapons | Implementation |
|--------|---------|---------------|
| Effective vs Armor | Rapier, Hammer | If defender class == KNIGHT: damage *= 2 |
| Ranged melee | Hand Axe, Javelin | range_min=1, range_max=2 (already supported) |
| Life drain | Nosferatu | After dealing damage, attacker heals equal to damage dealt |
| Extended range | Longbow | range_min=2, range_max=3 |
| High crit | Killing Edge, Killer Axe | crit=25 (already supported via crit stat) |

**Suggested implementation**: Add `special_effect: String` field to ItemData:
- `""` = no effect
- `"effective_armor"` = 2x damage vs Knight class
- `"life_drain"` = heal attacker for damage dealt
- These can be checked in `CombatManager._calculate_damage()` and `execute_combat()`

### 12.7 Important Notes on Current Code vs This Plan

1. **Damage formula discrepancy**: The GDD says `Damage = ATK - DEF`, but the code computes raw ATK and lets the armor system absorb. This plan is balanced around the CODE behavior (armor absorbs, then HP takes full damage). If the formula changes to subtract DEF from every hit, all damage numbers need rebalancing.

2. **Weapon durability**: The GDD section 5.4 says weapons have "Infinite Durability". The code has `max_uses` and `current_uses` but also `is_unbreakable`. This plan sets all player weapons as `is_unbreakable = true`. Enemy weapons do not matter since they are not looted.

3. **Staff healing**: Staves are currently `WeaponType.STAFF` but there is no healing action in combat. The Heal Staff should heal `(user.magic + staff.might) HP` to an adjacent ally instead of attacking. `might = 0` on Heal Staff means it heals `MAG + 0 = MAG` HP (Sera's 6 MAG = 6 HP healed). Use `heal_amount` field or compute from magic.

4. **Consumable usage**: The `use()` method on ItemData decrements uses but there is no UI or combat action to use consumables. This needs implementation.

5. **Armor-effective weapons**: No code exists to check for special weapon effects. Needs a new field on ItemData and a check in CombatManager.

---

*This document is the authoritative content specification for the FE_MB MVP Demo. All stats, prices, and mechanics described here should be implemented as-is.*
