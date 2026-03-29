# FE_MB Ship Plan: Equipment-Card System & Full Game

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Equipment-driven card combat, regional gear, completable game loop, recruitment, dungeon, tutorial, sound
**Supersedes:** Parts of `2026-03-22-mechanics-redesign.md` (sharpness, quick slots, blacksmith removed)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Equipment-Card System](#2-equipment-card-system)
3. [Hand Slot Model](#3-hand-slot-model)
4. [Innate Class Cards](#4-innate-class-cards)
5. [Gear Rarity System](#5-gear-rarity-system)
6. [Regional Gear Themes](#6-regional-gear-themes)
7. [Gear Content Catalog](#7-gear-content-catalog)
8. [Quiver Modifier System](#8-quiver-modifier-system)
9. [Status Effects](#9-status-effects)
10. [Systems Removed](#10-systems-removed)
11. [Town & Economy Changes](#11-town--economy-changes)
12. [Completability Features](#12-completability-features)
13. [Content Expansion](#13-content-expansion)
14. [Sound Design](#14-sound-design)
15. [Migration Strategy](#15-migration-strategy)
16. [TDD Test Targets](#16-tdd-test-targets)
17. [Phased Roadmap](#17-phased-roadmap)

---

## 1. Design Philosophy

### Core Principle: Gear IS Your Deck

Instead of Slay the Spire's "pick a card after each fight," deck building happens through **equipment**. Each weapon, shield, and quiver contributes specific cards to your combat deck. Swapping an Iron Sword for a Darkwood Bow doesn't just change your damage stat — it replaces your entire attack card set.

This makes every gear decision a deck-building decision. Shops become card shops. Loot drops reshape your strategy. The grid inventory becomes your deck builder.

### Design Rules

- **All combat is deterministic.** No hit chances, no miss, no crit percentages. Card damage = fixed numbers. Capture is the sole exception (intentional risk/reward gamble).
- **Gear defines playstyle.** Your hand slot loadout determines 60-70% of your deck. Class innates provide identity; gear provides strategy.
- **Regional identity through gear.** Each region has distinct gear themes with signature effects. Mixing gear across regions creates hybrid builds.
- **Best gear is earned, not bought.** Shops sell Common/Uncommon. Rare is expensive. Epic comes from dungeons and quests. Legendary comes from boss kills and quest rewards only.

---

## 2. Equipment-Card System

### Deck Composition

```
Deck = Innate Class Cards (4-5) + Left Hand Cards (3-4) + Right Hand Cards (3-4)
```

Variable deck size based on loadout:

| Loadout | Deck Size | Playstyle |
|---------|-----------|-----------|
| Sword + Shield | ~11-13 | Balanced — attack + defense |
| Sword + Sword | ~11-13 | Aggressive — all attack, no defense cards |
| Greatsword (2H) | ~11-13 | Focused — fewer, stronger cards, tighter draws |
| Bow + Poison Quiver | ~11-13 | Ranged + status effects |
| Tome + Staff | ~11-13 | Mage support — offense + healing |
| Shield + Shield | ~13-14 | Pure tank wall |

### Damage Formula (Simplified)

```
Physical: DMG = gear_card.damage + unit.STR - floor(target.DEF/2) - terrain_bonus
Magic:    DMG = gear_card.damage + unit.MAG - floor(target.RES/2) - terrain_bonus
Minimum:  0
```

Damage is baked into each gear card (e.g., Iron Sword's Slash = 4 base dmg, Steel Sword's Slash = 6). No separate `weapon.might` stat — the card IS the weapon's power. Higher rarity gear = higher card damage values.

### How Gear Changes Work

When you swap a hand item (in inventory UI between battles):
1. Remove old item's cards from the deck definition
2. Add new item's cards to the deck definition
3. Next combat builds the deck from the updated definition

**No mid-combat weapon swaps.** Your hand slot loadout is locked for the duration of the battle. This makes the pre-battle inventory decision meaningful.

### Card Source Tracking

Each card in the deck knows its source: `"innate"`, `"hand_left"`, or `"hand_right"`. This is used for:
- UI: subtle visual indicator on cards showing their source
- Quiver modifiers: only apply to cards sourced from a bow in the other hand slot
- Deck rebuild: when gear changes, only that slot's cards are swapped

---

## 3. Hand Slot Model

Each unit has 2 hand slots replacing the old single `equipped_weapon`:

- `hand_left`: any one-handed item (weapon, shield, quiver) OR a two-handed weapon
- `hand_right`: any one-handed item, OR empty/locked if left holds a 2H weapon

### What Goes In Hand Slots

| Item Type | Hands | Cards Contributed | Examples |
|-----------|-------|-------------------|---------|
| One-handed weapon | 1 | 3-4 attack cards | Iron Sword, Bone Dagger, Obsidian Axe |
| Shield | 1 | 3-4 defense cards | Iron Buckler, Bark Shield, Volcanic Tower Shield |
| Quiver | 1 (off-hand to bow) | Modifies bow cards (no own cards) | Poison Quiver, Thunder Quiver |
| Two-handed weapon | 2 | 6-8 cards | Iron Greatsword, Longbow |
| Tome | 1 | 3-4 spell cards | Fire Tome, Ember Tome |
| Staff | 1 | 3-4 heal/support cards | Heal Staff, Thorn Staff |

### Slot Rules

- A 2H weapon in `hand_left` locks `hand_right` (empty/blocked)
- A quiver is only useful paired with a bow (otherwise contributes nothing)
- Any 1H item can go in either slot
- Tomes and Staves are one-handed — a mage could dual-wield Tome + Staff for offense + support

---

## 4. Innate Class Cards

These never change. They define class identity regardless of equipped gear.

| Class | Innate Cards (4-5) | Identity |
|-------|-------------------|----------|
| **LORD** | Rally (draw 2), Inspiring Strike (attack + gain 1 AP), Nobility (gain temp armor), Lord's Command (buff adjacent ally +3 dmg next attack) | Leader — enables teammates |
| **KNIGHT** | Fortify (gain 5 armor), Bulwark (taunt: enemies must target you), Hold the Line (self + adjacent allies gain 2 armor), Shield Expertise (next Block card this turn has +3 effect) | Tank — positional anchor |
| **CAVALIER** | Gallop (move again this turn), Charge (move to target + deal damage), Trample (deal 3 dmg to each enemy you move through), Swift Strike (attack + gain 1 AP) | Mobile — repositioning |
| **FIGHTER** | Battle Cry (draw 2), Reckless Blow (high dmg + take 3 self dmg), Axe Mastery (next attack this turn deals +4), Berserker Rage (if below 50% HP, gain 2 AP) | Glass cannon — risk/reward |
| **ARCHER** | Take Aim (next ranged attack deals +5 dmg), Pin Down (immobilize target 1 turn), Evasion (next attack against you deals 0 dmg), Quick Reflexes (draw 1) | Control + precision |
| **MAGE** | Focus (draw 2 + gain 1 AP), Arcane Burst (AOE magic damage, 2-tile radius), Barrier (gain 4 magic armor), Elemental Mastery (next spell this turn costs 0 AP) | AOE + burst |
| **CLERIC** | Prayer (draw 2), Mass Heal (heal all allies in range for 5), Divine Shield (give ally 5 armor), Sanctuary (ally takes no damage next enemy turn) | Support — heals + protection |
| **THIEF** | Smoke Bomb (become untargetable for 1 turn), Dodge (next attack against you deals 0 dmg), Steal (take 10 gold from enemy), Flurry (next 2 cards this turn cost 0 AP) | Tempo + utility |
| **BOUNTY_HUNTER** | Track Prey (mark target: +3 dmg from all sources for 2 turns), Net Throw (immobilize 1 turn), Capture (attempt capture, 2 AP), Bounty Knowledge (draw 2 if marked enemy on field) | Control + capture |

---

## 5. Gear Rarity System

5-tier color-coded rarity. All gear of the same type contributes the same NUMBER of cards regardless of rarity. Higher rarity = stronger numbers + unique effects.

| Rarity | Color | Card Design | Sources |
|--------|-------|-------------|---------|
| **Common** | White/Grey | Base cards, simple effects | Starting gear, Borderlands shops, battle loot |
| **Uncommon** | Green | Same cards, better numbers | Borderlands/Thornwood/Ashfall shops, battle loot |
| **Rare** | Blue | Better numbers + 1 card gains a bonus effect | Expensive shops (Ashfall), dungeon chests |
| **Epic** | Purple | Unique card set with synergy effects | Dungeon bosses, quest rewards |
| **Legendary** | Orange/Gold | Build-defining powerful unique cards | Final dungeon boss, major quest rewards |

### Rarity Distribution by Source

| Source | Rarities Available |
|--------|-------------------|
| Borderlands shops | Common, Uncommon |
| Thornwood shops | Uncommon, Rare |
| Ashfall shops | Uncommon, Rare |
| Battle loot (any region) | Common, Uncommon (weighted by enemy level) |
| Dungeon chests | Rare, Epic |
| Dungeon boss | Epic, Legendary |
| Quest rewards | Rare, Epic, Legendary |

---

## 6. Regional Gear Themes

Each region has a distinct gear identity with signature materials and effects.

| Region | Theme | Materials | Signature Effect | Gear Identity |
|--------|-------|-----------|-----------------|---------------|
| **Borderlands** | Frontier military | Iron, Steel, Leather | None (vanilla baseline) | Standard swords, lances, bucklers. Reliable, no frills. |
| **Thornwood Wilds** | Nature/shadow | Darkwood, Bone, Venom | **Poison** (X dmg for N turns) | Shortbows, poison quivers, thorn shields, druid staves, bone daggers. DOT and control. |
| **Ashfall Peaks** | Volcanic/forge | Obsidian, Magma Steel, Ember | **Burn** (X dmg for N turns, stacks) | Heavy obsidian axes, magma blades, ember tomes, volcanic tower shields. Raw power and AOE fire. |

### Shop Inventories by Region

**Borderlands** (Pine Crossing, Riverside Market, South Junction):
- Iron/Steel weapons (sword, lance, axe, bow, crossbow)
- Iron Buckler, Iron Tower Shield
- Standard Quiver
- Heal Staff, Fire Tome
- Common + Uncommon rarity

**Thornwood Wilds** (Thornwood Chapel + future towns):
- Darkwood Bow, Bone Dagger, Venom Lance, Thorn Staff
- Bark Shield (defense + thorns: attackers take 2 dmg)
- Poison Quiver, Ice Quiver
- Uncommon + Rare rarity

**Ashfall Peaks** (Ashfall Outpost + future towns):
- Obsidian Axe, Magma Blade, Ember Tome, Molten Crossbow
- Volcanic Tower Shield (block + burn attacker)
- Thunder Quiver, Explosive Quiver
- Uncommon + Rare rarity

### Cross-Region Build Mixing

Players carry gear across regions. A Borderlands Steel Sword + Thornwood Bark Shield creates a hybrid attack/nature-defense loadout. A Thornwood Darkwood Bow + Ashfall Explosive Quiver turns a poison archer into a fire archer. Regions create natural "build chapters."

---

## 7. Gear Content Catalog

### One-Handed Weapons (3-4 cards each)

#### Borderlands (Iron/Steel)

| Weapon | Rarity | Cards |
|--------|--------|-------|
| Iron Sword | Common | Slash (1 AP, 4 dmg), Thrust (2 AP, 8 dmg), Guard Break (1 AP, 3 dmg + remove 2 armor) |
| Steel Sword | Uncommon | Slash (1 AP, 6 dmg), Thrust (2 AP, 11 dmg), Guard Break (1 AP, 5 dmg + remove 3 armor) |
| Iron Lance | Common | Jab (1 AP, 5 dmg, range 1-2), Impale (2 AP, 10 dmg, melee only), Brace (1 AP, 4 dmg + gain 2 armor) |
| Steel Lance | Uncommon | Jab (1 AP, 7 dmg, range 1-2), Impale (2 AP, 14 dmg, melee only), Brace (1 AP, 6 dmg + gain 3 armor) |
| Iron Axe | Common | Chop (1 AP, 5 dmg), Wild Swing (2 AP, 4 dmg to target + adjacent enemies), Rend (1 AP, 3 dmg + destroy 3 armor) |
| Steel Axe | Uncommon | Chop (1 AP, 7 dmg), Wild Swing (2 AP, 6 dmg to target + adjacent), Rend (1 AP, 5 dmg + destroy 4 armor) |
| Iron Bow | Common | Quick Shot (1 AP, 4 dmg, range 2-3), Aimed Shot (2 AP, 9 dmg, range 2-3), Volley (3 AP, 3 dmg to 3x3 area, range 2-3) |
| Steel Bow | Uncommon | Quick Shot (1 AP, 6 dmg, range 2-3), Aimed Shot (2 AP, 12 dmg, range 2-3), Volley (3 AP, 5 dmg to 3x3 area, range 2-3) |
| Iron Crossbow | Common | Crossbow Bolt (1 AP, 5 dmg, range 1-2), Heavy Bolt (2 AP, 10 dmg + remove 2 armor, range 1-2), Pinning Shot (1 AP, 3 dmg + immobilize 1 turn, range 1-2) |
| Steel Crossbow | Uncommon | Crossbow Bolt (1 AP, 7 dmg, range 1-2), Heavy Bolt (2 AP, 13 dmg + remove 3 armor, range 1-2), Pinning Shot (1 AP, 5 dmg + immobilize 1 turn, range 1-2) |
| Fire Tome | Common | Fire (1 AP, 4 magic dmg, range 1-2), Blaze (2 AP, 8 magic dmg, range 1-2), Flame Burst (2 AP, 4 magic dmg to 2-tile radius, range 1-2) |
| Thunder Tome | Uncommon | Thunder (1 AP, 6 magic dmg, range 1-2), Thoron (2 AP, 11 magic dmg, range 1-2), Lightning (2 AP, 5 magic dmg to 2-tile radius, range 1-2) |
| Heal Staff | Common | Heal (1 AP, heal 8 HP, range 1-2), Restore (2 AP, heal 15 HP, range 1-2), Purify (1 AP, remove all debuffs, range 1-2) |
| Mend Staff | Uncommon | Heal (1 AP, heal 12 HP, range 1-2), Restore (2 AP, heal 20 HP, range 1-2), Purify (1 AP, remove all debuffs + heal 5 HP, range 1-2) |

#### Thornwood Wilds (Darkwood/Bone/Venom)

| Weapon | Rarity | Cards |
|--------|--------|-------|
| Bone Dagger | Uncommon | Stab (1 AP, 5 dmg), Lacerate (1 AP, 3 dmg + 2 poison/2 turns), Twist Blade (2 AP, 7 dmg + 3 poison/2 turns) |
| Venom Lance | Uncommon | Toxic Jab (1 AP, 5 dmg + 1 poison/2 turns, range 1-2), Venom Impale (2 AP, 9 dmg + 3 poison/2 turns), Poison Brace (1 AP, 3 dmg + gain 2 armor + 1 poison/2 turns) |
| Darkwood Bow | Uncommon | Thorn Arrow (1 AP, 5 dmg, range 2-3), Nature's Aim (2 AP, 10 dmg + 2 poison/2 turns, range 2-3), Briar Volley (3 AP, 3 dmg + 1 poison/2 turns to 3x3, range 2-3) |
| Thorn Staff | Uncommon | Nature's Touch (1 AP, heal 10 HP, range 1-2), Regrowth (2 AP, heal 8 HP + heal 4 HP next turn, range 1-2), Entangle (1 AP, immobilize target 1 turn, range 1-2) |
| Serpent Blade | Rare | Fang Strike (1 AP, 6 dmg + 2 poison/3 turns), Cobra Lunge (2 AP, 10 dmg + 3 poison/3 turns), Shed Skin (1 AP, remove all debuffs from self + deal 4 dmg to adjacent) |

#### Ashfall Peaks (Obsidian/Magma/Ember)

| Weapon | Rarity | Cards |
|--------|--------|-------|
| Obsidian Axe | Uncommon | Obsidian Chop (1 AP, 7 dmg), Magma Swing (2 AP, 5 dmg + 3 burn/2 turns to target + adjacent), Shatter (1 AP, 4 dmg + destroy 4 armor) |
| Magma Blade | Uncommon | Flame Slash (1 AP, 6 dmg + 2 burn/2 turns), Eruption Strike (2 AP, 10 dmg + 3 burn/2 turns), Molten Edge (1 AP, 5 dmg, if target already burning deal +4) |
| Ember Tome | Uncommon | Ember (1 AP, 5 magic dmg + 2 burn/2 turns, range 1-2), Conflagrate (2 AP, 4 magic dmg to 2-tile radius + 2 burn/2 turns, range 1-2), Volcanic Surge (3 AP, 12 magic dmg, range 1-2) |
| Molten Crossbow | Uncommon | Fire Bolt (1 AP, 6 dmg + 1 burn/2 turns, range 1-2), Magma Bolt (2 AP, 11 dmg + 2 burn/2 turns, range 1-2), Explosive Bolt (2 AP, 5 dmg + 3 burn/2 turns to target + adjacent, range 1-2) |
| Hellfire Tome | Rare | Hellfire (1 AP, 7 magic dmg + 3 burn/2 turns, range 1-2), Inferno (2 AP, 5 magic dmg + 3 burn/2 turns to 2-tile radius, range 1-2), Pyroclasm (3 AP, 8 magic dmg to ALL enemies + 2 burn/2 turns) |

### Shields (3-4 cards each)

| Shield | Region | Rarity | Cards |
|--------|--------|--------|-------|
| Iron Buckler | Borderlands | Common | Block (1 AP, gain 4 armor), Parry (1 AP, gain 3 armor + deal 2 dmg to next melee attacker), Deflect (0 AP, gain 2 armor) |
| Steel Buckler | Borderlands | Uncommon | Block (1 AP, gain 6 armor), Parry (1 AP, gain 4 armor + deal 3 dmg to next melee attacker), Deflect (0 AP, gain 3 armor) |
| Iron Tower Shield | Borderlands | Common | Fortress (2 AP, gain 8 armor), Shield Wall (1 AP, gain 4 armor + adjacent allies gain 2 armor), Cover (1 AP, redirect next attack on adjacent ally to you) |
| Steel Tower Shield | Borderlands | Uncommon | Fortress (2 AP, gain 11 armor), Shield Wall (1 AP, gain 6 armor + adjacent allies gain 3 armor), Cover (1 AP, redirect next attack on adjacent ally to you + gain 3 armor) |
| Bark Shield | Thornwood | Uncommon | Thorn Block (1 AP, gain 4 armor + attackers take 2 dmg), Root Guard (1 AP, gain 3 armor + immobilize adjacent enemy 1 turn), Nature's Shell (0 AP, gain 2 armor + heal 2 HP) |
| Volcanic Tower Shield | Ashfall | Uncommon | Magma Fortress (2 AP, gain 9 armor + deal 3 burn/2 turns to all adjacent enemies), Lava Wall (1 AP, gain 5 armor + adjacent allies gain 2 armor), Heat Shield (1 AP, gain 4 armor, next melee attacker takes 4 burn/2 turns) |

### Two-Handed Weapons (6-8 cards each)

| Weapon | Region | Rarity | Cards |
|--------|--------|--------|-------|
| Iron Greatsword | Borderlands | Common | Heavy Slash (1 AP, 7 dmg), Cleave (2 AP, 5 dmg to all adjacent enemies), Overhead Blow (2 AP, 12 dmg), Whirlwind (3 AP, 7 dmg to ALL adjacent tiles), Power Stance (1 AP, next attack +4 dmg), Guard (1 AP, gain 3 armor) |
| Steel Greatsword | Borderlands | Uncommon | Heavy Slash (1 AP, 10 dmg), Cleave (2 AP, 7 dmg to all adjacent), Overhead Blow (2 AP, 16 dmg), Whirlwind (3 AP, 9 dmg to ALL adjacent), Power Stance (1 AP, next attack +6 dmg), Guard (1 AP, gain 4 armor) |
| Longbow | Borderlands | Common | Long Shot (1 AP, 5 dmg, range 3-4), Snipe (2 AP, 12 dmg, range 3-4), Rain of Arrows (3 AP, 4 dmg to 3x3 area, range 3-4), Steady Aim (1 AP, next ranged attack +5 dmg), Quick Nock (1 AP, draw 1 card), Covering Fire (1 AP, 3 dmg + immobilize 1 turn, range 3-4) |
| Composite Bow | Borderlands | Uncommon | Long Shot (1 AP, 7 dmg, range 3-4), Snipe (2 AP, 16 dmg, range 3-4), Rain of Arrows (3 AP, 6 dmg to 3x3 area, range 3-4), Steady Aim (1 AP, next ranged attack +7 dmg), Quick Nock (1 AP, draw 1 card), Covering Fire (1 AP, 5 dmg + immobilize 1 turn, range 3-4) |

### Quivers

| Quiver | Region | Rarity | Modifier |
|--------|--------|--------|----------|
| Standard Quiver | Borderlands | Common | No modification |
| Poison Quiver | Thornwood | Uncommon | All bow attacks apply 2 poison (2 dmg/turn for 2 turns) |
| Ice Quiver | Thornwood | Uncommon | All bow attacks apply Slow (target loses 2 SPD for 1 turn) |
| Thunder Quiver | Ashfall | Uncommon | All bow attacks deal +3 bonus magic damage (ignores armor) |
| Explosive Quiver | Ashfall | Rare | All bow attacks deal 3 damage to all enemies adjacent to target |

### Epic Weapons (quest rewards, dungeon loot)

| Weapon | Type | Cards |
|--------|------|-------|
| Flame Blade | 1H Sword | Fire Slash (1 AP, 7 dmg + 3 burn/2 turns), Ignite (2 AP, 5 dmg to all adjacent to target + 2 burn/2 turns), Inferno Strike (2 AP, 14 dmg) |
| Frost Axe | 1H Axe | Frost Chop (1 AP, 7 dmg + slow 2 SPD/1 turn), Shatter (2 AP, 10 dmg + destroy all target's armor), Frozen Ground (2 AP, 3x3 area: all enemies lose 2 SPD for 2 turns) |
| Paladin's Aegis | 1H Shield | Holy Block (1 AP, gain 6 armor + heal self 3), Radiant Shield (2 AP, gain 8 armor + deal 4 magic dmg to all adjacent enemies), Martyr (0 AP, take next attack aimed at any ally) |
| Wraithbow | 2H Bow | Soul Arrow (1 AP, 8 dmg + heal self 3, range 3-4), Ghost Shot (2 AP, 14 dmg, ignores armor, range 3-4), Phantom Volley (3 AP, 6 dmg to 3x3 + heal self 2 per enemy hit, range 3-4), Death Sight (1 AP, next ranged attack +7 dmg + draw 1), Spectral Nock (0 AP, draw 1), Haunt (1 AP, 4 dmg + slow 3 SPD/1 turn, range 3-4) |

### Legendary Weapons (dungeon boss, major quest rewards)

| Weapon | Type | Cards |
|--------|------|-------|
| Shadowfang | 1H Dagger | Shadow Step (0 AP, teleport to any tile adjacent to an enemy), Assassinate (3 AP, deal 22 dmg, must be adjacent), Vanish (1 AP, untargetable for 1 turn) |
| Doombow | 2H Bow | Doom Arrow (2 AP, 16 dmg, range 2-4), Piercing Shot (1 AP, damages all enemies in a straight line for 8, range 2-4), Death Mark (1 AP, mark target: takes +5 dmg from all sources for 2 turns, range 2-4), Reaper's Aim (1 AP, next attack +8 dmg), Shadow Nock (0 AP, draw 2), Volley of Ruin (3 AP, 8 dmg to 3x3 + marked enemies take double, range 2-4) |
| Excalibur | 1H Sword | Holy Slash (1 AP, 9 dmg + heal self 4), Judgment (2 AP, 15 dmg, deals double to enemies below 25% HP), Radiance (2 AP, deal 6 magic dmg to ALL enemies + heal all allies 4) |

### Total Gear Count

| Category | Common | Uncommon | Rare | Epic | Legendary | Total |
|----------|-------:|--------:|-----:|-----:|----------:|------:|
| 1H Weapons | 7 | 9 | 2 | 2 | 2 | 22 |
| Shields | 2 | 3 | 0 | 1 | 0 | 6 |
| Quivers | 1 | 3 | 1 | 0 | 0 | 5 |
| 2H Weapons | 2 | 2 | 0 | 1 | 1 | 6 |
| **Total** | **12** | **17** | **3** | **4** | **3** | **39** |

39 pieces of gear, each with distinct card sets.

---

## 8. Quiver Modifier System

Quivers don't contribute their own cards. They **modify** all cards sourced from a bow in the other hand slot.

### How It Works

1. At deck build time, identify all cards contributed by the bow
2. For each bow card that deals damage, apply the quiver's modifier
3. The modifier is stored on the card instance (not the card definition)

### Modifier Types

| Modifier | Effect | Applied To |
|----------|--------|-----------|
| Poison | Deal X damage at end of target's next N turns | All bow damage cards |
| Slow | Target loses X SPD for N turns | All bow damage cards |
| Thunder | Deal +X bonus magic damage (ignores armor) | All bow damage cards |
| Explosive | Deal X damage to all enemies adjacent to target | All bow damage cards |

### Rules

- A quiver without a bow in the other slot does nothing
- A bow without a quiver works fine (unmodified bow cards)
- Only one quiver effect applies (one quiver per hand slot)
- 2H bows (Longbow, Composite Bow) cannot pair with quivers (both slots used)

---

## 9. Status Effects

All deterministic. Fixed numbers, fixed durations. No chance to resist.

| Effect | Mechanic | Duration | Stacks? |
|--------|----------|----------|---------|
| **Poison** | Deal X damage at end of target's turn | N turns (typically 2) | No — reapplying refreshes duration and uses higher X |
| **Burn** | Deal X damage at end of target's turn | N turns (typically 2) | Yes — multiple burn sources add together |
| **Slow** | Target loses X SPD (affects turn order) | N turns (typically 1) | No — reapplying refreshes |
| **Immobilize** | Target cannot move (MOV = 0) | N turns (typically 1) | No — reapplying refreshes |

### Burn vs Poison

Burn stacks (multiple fire sources = more damage per turn). Poison does not stack (reapplies at higher value). This makes burn the "ramp" DOT and poison the "consistent" DOT — thematic for Ashfall's aggressive style vs Thornwood's patient style.

---

## 10. Systems Removed

The following systems from `2026-03-22-mechanics-redesign.md` are **cut**:

| System | Reason |
|--------|--------|
| **Weapon sharpness** (Sharp/Normal/Dull) | Added complexity for +2/-2 damage. Not worth the maintenance tax. Gear rarity handles power scaling better. |
| **Quick slots** (2 per unit) | No mid-combat weapon swapping. Hand slot loadout is locked per battle. Pre-battle gear choice is more meaningful. |
| **Blacksmith** (town service) | No sharpness to repair. Shops handle gear sales. Best gear comes from quests/dungeons. |
| **Whetstone** (consumable item) | Only existed for sharpness system. |
| **Weapon triangle** (already removed in 7a) | +1/-1 was noise. Stays removed. |
| **Camp Sharpen action** | No sharpness system. Camp = Rest / Scout (stub) / Leave. |

### Code to Remove

- `ItemData`: `sharpness` enum, `is_honed`, `get_sharpness_bonus()`, `sharpen()`, `degrade_sharpness()`
- `UnitData`: `quick_slots` array, `get_quick_slot()`, `set_quick_slot()`
- `CardData`: `get_computed_damage()` sharpness bonus line
- `CardPlayController`: `use_quick_slot_item()`, `switch_weapon_from_slot()`, quick slot UI buttons
- `CardHandUI`: Quick slot button creation/display
- `CampPopup`: Sharpen action and unit selector
- `BlacksmithPanel`: Entire file
- `GameManager`: Quick slot references in save/load
- `Battlefield`: `_end_battle()` sharpness degradation
- Town JSONs: Remove blacksmith service entries

---

## 11. Town & Economy Changes

### Town Services (simplified)

| Service | Function |
|---------|----------|
| **Inn** | Heal all units (8g per unit) |
| **Shop** | Buy/sell gear and consumables. Inventory varies by region. |
| **Tavern** | Rumors, accept quests, bounty board, recruitment (Phase 4) |

### Economy Rebalance

Prices must be rebalanced for the new gear system:

| Rarity | Price Range | Sell Price |
|--------|-----------|------------|
| Common | 50-120g | 25-60g (50%) |
| Uncommon | 120-250g | 60-125g (50%) |
| Rare | 300-500g | 150-250g (50%) |
| Epic | Not sold | 300-500g (sell only) |
| Legendary | Not sold | 500-800g (sell only) |

**Battle rewards stay:** 10 + (enemy_level × 5) gold per enemy defeated.

**Loot drops:** After battle victory, chance to find 1 gear item. Rarity weighted by enemy level:
- Level 1-2: 80% Common, 20% Uncommon
- Level 3-4: 50% Common, 40% Uncommon, 10% Rare
- Level 5+: 30% Uncommon, 50% Rare, 20% Epic

---

## 12. Completability Features

### Tutorial Battle

Triggered on first game start (after prologue, before overworld):
- Scene: 5x5 grid, Roy (LORD) vs 1 Bandit
- Pre-scripted: highlights move tile ("click here"), highlights card to play, highlights enemy to target
- Teaches: movement, card play, AP cost, damage numbers
- Duration: ~60 seconds
- Ends: transition to overworld map

### Boss Encounter

At the EXIT node (The Iron Throne):
- Hand-crafted boss fight: Boss (unique enemy, high stats, Epic gear cards) + 2-3 guards
- Boss has unique AI behavior (targets weakest unit, uses AOE)
- Victory triggers win screen

### Win Screen

- Run stats: hops traveled, battles won, enemies captured, units lost, gold earned, gear found
- Time played
- "New Run" button

### Game Over Screen

- Triggered when all party members are dead
- Same stats display
- "New Run" button

### Difficulty Scaling

Enemies scale by map position (not a level system):
- Nodes near start (Pine Crossing area): Level 1-2 enemies
- Mid-map nodes: Level 3-4 enemies
- Nodes near EXIT: Level 5-6 enemies
- Dungeon boss: Level 7+

Higher level enemies have better stats AND drop better gear. Creates natural power curve.

---

## 13. Content Expansion

### Recruitment (Phase 4)

Two recruitment paths:
1. **Tavern recruitment:** Pay gold at a tavern to recruit from 2-3 random class options. Recruited unit starts at level 1 with class innates + Common gear.
2. **Event recruitment:** A travel event or quest rewards a specific unit joining the party.

Party cap: 6 units (start with 3, recruit up to 3 more). This means permadeath creates real openings for new builds — losing Roy means you need a new frontliner, maybe a Fighter or Cavalier with different gear preferences.

### 1 Dungeon (Phase 4)

Hand-crafted, 4 rooms:
1. **Combat room:** Fight enemy group (stronger than travel encounters)
2. **Event room:** Dialogue with choices (treasure or trap)
3. **Rest room:** Heal party (free, no food cost — reward for getting this far)
4. **Boss room:** Boss fight. Boss drops Epic or Legendary gear.

Accessed from DUNGEON node on overworld. Quest-locked (Blood Ties completion unlocks Smuggler's Cave).

### Additional Quests (Phase 4)

2 new quests, simpler than Blood Ties:
1. **The Missing Caravan:** Fetch quest — find supplies in a dungeon, return to a town for Rare gear reward.
2. **The Deserter:** Event quest — encounter a fleeing soldier during travel. Help or turn in. Branching outcome affects a later town's shop inventory.

### Additional Travel Events (Phase 4)

4-5 new dialogue encounters:
- Wandering blacksmith (buy 1 random Uncommon gear at discount)
- Ambush choice (fight for loot or pay toll)
- Injured knight (heal for recruitment chance or loot their gear)
- Ancient shrine (sacrifice HP for a card buff — temporary innate card for N battles)
- Thieves' crossroads (Thief class stat check for bonus gold/gear)

### Additional Enemy Groups (Phase 3-4)

Target: 8-10 total enemy groups (up from current 3):
- Bandit Ambush (existing) — 2 fighters + 1 archer
- Wolf Pack (existing) — 3 wolves (fast, fragile)
- Brigand Raiders (existing) — 2 fighters + 1 chief
- **Shield Wall** — 2 knights with tower shields + 1 archer. Demands armor-breaking cards.
- **Mage Circle** — 2 mages + 1 cleric. Glass cannons that hit hard, reward aggressive play.
- **Wolf Alpha Pack** — 4 wolves + 1 alpha (high HP, howl buffs pack SPD). Demands AOE.
- **Thornwood Ambush** — 2 bone dagger thieves + 1 darkwood archer. Fast, poison damage.
- **Ashfall Raiders** — 2 obsidian axe fighters + 1 ember mage. Burn DOT pressure.

---

## 14. Sound Design

Free assets, minimal effort, maximum impact.

### Music (3 tracks)

| Context | Mood | Source |
|---------|------|--------|
| Overworld | Atmospheric, travel, medieval | OpenGameArt / Kenney |
| Combat | Tense, tactical, drums | OpenGameArt / Kenney |
| Town | Calm, safe, tavern feel | OpenGameArt / Kenney |

### Sound Effects (12-15)

| Sound | Trigger |
|-------|---------|
| Card play | Any card played in combat |
| Physical hit | Attack card deals damage |
| Magic hit | Spell card deals damage |
| Heal | Heal card used |
| Unit death | Unit HP reaches 0 |
| Gold gain | Gold received |
| Button click | UI interaction |
| Footstep | Pawn movement on overworld |
| Encounter start | Travel encounter triggered |
| Victory fanfare | Battle won |
| Defeat stinger | Party wiped |
| Card draw | Cards drawn at turn start |
| Armor break | Armor reaches 0 |
| Level up | Unit gains a level (if leveling is in) |

---

## 15. Migration Strategy

### Data Changes

**UnitData:**
- `equipped_weapon: ItemData` → `hand_left: ItemData` + `hand_right: ItemData`
- Remove: `quick_slots: Array`
- Add: `innate_cards: Array[CardData]` (populated from class definition at creation)

**ItemData:**
- Add: `rarity: Rarity` enum (COMMON, UNCOMMON, RARE, EPIC, LEGENDARY)
- Add: `gear_cards: Array[Dictionary]` (card definitions this item contributes to deck)
- Add: `is_two_handed: bool`
- Add: `quiver_modifier: Dictionary` (effect_type, value, duration)
- Remove: `sharpness: Sharpness`, `is_honed: bool`
- Remove: `get_sharpness_bonus()`, `sharpen()`, `degrade_sharpness()`

**CardData:**
- Add: `source: String` ("innate", "hand_left", "hand_right") — set at deck build time, not persisted
- Add: `status_effects: Array[Dictionary]` — burn, poison, slow, immobilize with fixed values
- Remove: sharpness bonus from `get_computed_damage()`

**DeckManager:**
- `init_deck()` takes: `innate_cards + hand_left.gear_cards + hand_right.gear_cards`
- Quiver modifier applied at init time to bow-sourced cards

**item_catalog.json:**
- Every item gains: `rarity`, `gear_cards`, `is_two_handed`
- New items added for all regions/rarities
- Prices rebalanced

**Save version:** 0.4.0 → 0.5.0

**Migration path (0.4.0 → 0.5.0):**
- `equipped_weapon` → `hand_left`, `hand_right` = null
- Remove `quick_slots` from unit data
- Remove `sharpness`, `is_honed` from items
- Items without `rarity` → COMMON
- Items without `gear_cards` → look up from catalog by item name

### Files to Delete

- `scripts/ui/blacksmith_panel.gd` + `.uid`

### Files with Major Changes

- `scripts/resources/unit_data.gd` — hand slots, remove quick slots
- `scripts/resources/item_data.gd` — rarity, gear cards, remove sharpness
- `scripts/resources/card_data.gd` — source tracking, status effects
- `scripts/combat/deck_manager.gd` — gear-based deck building
- `scripts/combat/card_play_controller.gd` — remove quick slot logic, remove weapon compat filter
- `scripts/combat/card_effect_resolver.gd` — status effect application
- `scripts/ui/card_hand_ui.gd` — remove quick slot buttons, add card source indicator
- `scripts/ui/grid_inventory_ui.gd` — 2 hand slots per unit instead of weapon + quick slots
- `scripts/ui/camp_popup.gd` — remove Sharpen action
- `scripts/ui/shop_panel.gd` — rarity colors, regional inventory
- `autoload/game_manager.gd` — starter loadouts, save/load changes
- `autoload/save_manager.gd` — version 0.5.0, migration
- `data/items/item_catalog.json` — complete rewrite with new format
- `data/cards/class_decks.json` — split into innate-only definitions

---

## 16. TDD Test Targets

### Phase 1: Equipment-Card Foundation

| Test File | What It Verifies |
|-----------|-----------------|
| `test_hand_slots.gd` | Equip/unequip 1H items in both slots. 2H weapon blocks second slot. Swap returns old item to bag. Can't equip 1H in locked slot. |
| `test_deck_building.gd` | Deck = innate + left hand + right hand cards. Correct card count per loadout. 2H gives 6-8 cards. Empty hand slot contributes nothing. |
| `test_quiver_modifier.gd` | Quiver modifies bow cards. No effect without bow. Each modifier type applies correctly. 2H bow can't pair with quiver. |
| `test_damage_formula.gd` | Card damage = card's fixed damage value + unit stat (STR or MAG). No weapon_might — damage is baked into each gear card's base value. Armor reduces correctly. Magic pierces armor. |
| `test_rarity.gd` | Rarity enum on items. Round-trips through to_dict/from_dict. |
| `test_status_effects.gd` | Poison deals fixed dmg for N turns, doesn't stack. Burn deals fixed dmg, stacks. Slow reduces SPD. Immobilize sets MOV=0. All expire after duration. |

### Phase 2: Gear Content

| Test File | What It Verifies |
|-----------|-----------------|
| `test_gear_catalog.gd` | Every item in catalog has valid gear_cards with correct count. All cards have valid AP cost, targeting, damage values. |
| `test_shop_regional.gd` | Borderlands shops stock Common+Uncommon. Thornwood Uncommon+Rare. Ashfall Uncommon+Rare. No rarity leaks. |
| `test_loot_drops.gd` | Battle loot generates correct rarity distribution per enemy level. |

### Phase 3: Completability

| Test File | What It Verifies |
|-----------|-----------------|
| `test_tutorial.gd` | Tutorial scene loads, scripted events fire, exits to overworld. |
| `test_boss_battle.gd` | Boss encounter loads at EXIT node, correct enemies, victory triggers win screen. |
| `test_run_completion.gd` | Full run: new game → travel → battle → arrive → win/lose screen → can restart. |

### Phase 4: Content

| Test File | What It Verifies |
|-----------|-----------------|
| `test_recruitment.gd` | Recruit unit at tavern. Unit joins with class innates + Common gear. Party cap enforced. |
| `test_dungeon.gd` | Dungeon loads 4 rooms in sequence. Boss drops Epic/Legendary gear. Can return to overworld. |

---

## 17. Phased Roadmap

### Phase 1: Equipment-Card Foundation (2-3 weeks)

- Remove sharpness, quick slots, blacksmith from codebase
- Replace `equipped_weapon` with 2 hand slots on UnitData
- Define gear card data format in item_catalog.json
- Split class decks into innate (4-5 cards) + gear-contributed
- DeckManager builds deck from innate + hand_left.gear_cards + hand_right.gear_cards
- Quiver modifier system
- Status effects (poison, burn, slow, immobilize) in CardEffectResolver
- 5-tier rarity enum + UI colors
- Grid inventory UI updated for 2 hand slots per unit
- Card source indicator in combat hand UI
- Save version 0.5.0 + migration from 0.4.0
- **TDD:** All Phase 1 tests pass before moving on

### Phase 2: Gear Content (1-2 weeks)

- Design and implement all 39 gear items with card sets
- Update all town shop JSONs with regional inventory
- Battle loot drop system (rarity weighted by enemy level)
- Rebalance all item prices
- Update starter party loadouts (Roy: Iron Sword, Marcus: Iron Lance + Iron Buckler, Lilina: Fire Tome)
- **TDD:** Gear catalog and shop tests pass

### Phase 3: Completability (1-2 weeks)

- Tutorial battle scene (scripted 1v1)
- Boss encounter at EXIT node
- Win screen with run stats
- Game over screen
- Difficulty scaling (enemy level by map position)
- 5 more enemy groups (8 total)
- **TDD:** Tutorial, boss, and full-run tests pass

### Phase 4: Content Expansion (2-3 weeks)

- Recruitment system (tavern + event)
- 1 hand-crafted dungeon (4 rooms)
- 2 additional quests
- 4-5 additional travel events
- 2-3 region-specific enemy groups
- **TDD:** Recruitment and dungeon tests pass

### Phase 5: Polish & Sound (1-2 weeks)

- 3 music tracks + 12-15 SFX (free assets)
- Balance pass (10 full playtest runs)
- Bug fixes from Phase 1-4
- Inventory QoL (rarity color borders, hover highlights)
- Battle end notifications
- **TDD:** Integration test — full run with sound enabled, no crashes

### Phase 6: Ship (<1 week)

- External playtest (2-3 blind testers)
- Fix playtest issues
- Itch.io page, screenshots, description
- Export Windows build
- **Ship**

### Timeline

| Phase | Effort | Cumulative |
|-------|--------|------------|
| 1: Equipment-Card Foundation | 2-3 weeks | 2-3 weeks |
| 2: Gear Content | 1-2 weeks | 3-5 weeks |
| 3: Completability | 1-2 weeks | 4-7 weeks |
| 4: Content Expansion | 2-3 weeks | 6-10 weeks |
| 5: Polish & Sound | 1-2 weeks | 7-12 weeks |
| 6: Ship | <1 week | 8-12 weeks |
