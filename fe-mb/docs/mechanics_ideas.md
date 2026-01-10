# Mechanics & Skill Ideas

This document tracks ideas for unique unit mechanics, personal skills, and tactical interactions based on Fire Emblem and other tactical RPGs.

## 1. Unit Concept: "Danger Mage" (The Wounded Glass Cannon)
*Concept*: A mage who becomes significantly more powerful as their HP drops.
*   **Passive Skill: Desperation / Vengeance**
    *   **Effect**: Gain +1 Damage for every 5% HP missing.
    *   **Effect**: If HP < 50%, follow-up attacks occur immediately (before enemy can counter).
*   **Active Ability: Life Swap** (Cooldown: Once per battle?)
    *   **Effect**: Swap current HP percentage with a target enemy (or ally).
    *   **Tactical Use**: Get reduced to 1 HP by an enemy, then swap with a full HP boss to instantly cripple them and heal yourself. Risky but powerful.
*   **Weapon Synergy**: "Nosferatu" (Drains HP) or "Fury Tome" (Deals damage to self on use to safely lower HP).

## 2. Personal Skills (Innate Unique Abilities)
*Design Goal*: Each unit feels unique, not just a bundle of stats.

| Archetype | Skill Name | Effect |
|-----------|------------|--------|
| **Cowardly Archer** | *Get Behind Me!* | +3 STR/SPD if an ally is directly between them and the enemy. |
| **Protective Knight** | *Guardian* | Taking damage for an adjacent ally reduces damage by 50%. |
| **Glutton** | *Leftovers* | Using a consumable item heals adjacent allies for 50% of the amount. |
| **Lone Wolf** | *Solitary* | +10 Hit/Avoid when no allies are within 2 tiles. |
| **Gambler** | *All In* | Crit rate +20, but receive +20% damage from all sources. |
| **Merchant** | *Penny Pincher* | 10% chance to find Gold after defeating an enemy. |
| **Dancer/Bard** | *Encore* | (Active) Grant an ally another action. (Standard FE mechanic). |

## 3. Support Mechanics
*Concept*: Units build relationships by fighting together, unlocking stat buffs.
*   **Bond Levels**: C -> B -> A rank.
*   **Proximity**: While within 2 tiles of a support partner:
    *   **Offensive Pair**: +10 Hit, +2 Dmg.
    *   **Defensive Pair**: +10 Avoid, +1 Def/Res.
    *   **Crit Pair**: +10 Crit.

## 4. Rest Site Mechanics (No Durability Repair)
Since weapons don't break, Rest Sites offer a choice between **Recovery** and **Temporary Power**.

*   **Option A: Triage (Heal)**
    *   Heal party for 30-50% HP.
    *   Restore Morale.
*   **Option B: War Preparation (Buff)**
    *   *Tactical Buffs for the NEXT battle only:*
    *   **"Adrenaline"**: The first attack each unit makes deals double damage.
    *   **"Iron Will"**: Each unit survives a fatal blow with 1 HP once.
    *   **"Vantage"**: All units always attack first, even on enemy phase.
    *   **"Ambush"**: First enemy turn is skipped (Player gets 2 turns).

## 5. Fog of War (Boss Only)
Implemented as a "Lair Action" or Boss Phase mechanic.
*   **Darkness**: Boss shrouds the map in darkness every 3 turns.
*   **Minions**: "Shadows" spawn in the fog. They are weak (1 HP) but block movement and deal high chip damage.
*   **Counterplay**: Killing specific minions or lighting torches (interactables) clears the fog.

## 6. Class System (Main Character vs Party)
*   **Main Character (Lord)**: Standard RPG skill tree. Branching promotions (e.g., Lord -> Great Lord (Tank) OR Swordmaster (DPS)).
*   **Party Members**:
    *   Single linear class progression (e.g., Mage -> Sage).
    *   **Quest Evolution**: To promote, they must complete a personal quest (e.g., "Defeat 5 enemies with magic", "Find the lost tome in a dungeon").
    *   This unlocks their "Awakened" personal skill.
