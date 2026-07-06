# Equipment-Cards TS Implementation Plan (2026-07-06)

**Source spec:** `../specs/2026-03-29-ship-plan-design.md` (§2-8, §11) — authoritative.
**Atlas:** phase "Equipment & Gear" (43), epics 98-101, stories 448-460.
**Gate per story:** `npm run verify` green; TDD — tests written with/before code.

## Design decisions (TS port of the ship plan)

1. **Single card registry.** Gear cards are authored in `cards.json` alongside innates;
   gear items reference them via `gearCardIds: string[]`. Reuses load/validation/CLI paths.
2. **Item extensions** (`domain/item.ts` + `data/schemas/item.ts`):
   `ItemKind += 'weapon' | 'shield' | 'quiver' | 'tome' | 'staff'`;
   `weaponClass?: 'sword'|'lance'|'axe'|'bow'|'crossbow'|'dagger'|'greatsword'|'tome'|'staff'|'shield'`
   (drives quiver pairing + UI grouping); `twoHanded?: boolean`; `gearCardIds?: string[]`;
   `quiverModifier?: { kind: 'poison'|'slow'|'thunder'|'explosive'; value: number; turns: number }`.
3. **Hand slots on Unit** (`domain/unit.ts`): `handLeft?: ItemId | null`, `handRight?: ItemId | null`.
   Owned at run level (party units); combat unit copies carry them read-only.
4. **Deck builder** (`systems/deckBuilder.ts`, pure): innate + left + right cards;
   `DeckState` gains optional `sources: Record<CardId, CardSource>` and
   `cardMods: Record<CardId, QuiverModifier>`. A quiver in one hand modifies all
   *damage* cards sourced from a bow (`weaponClass === 'bow'`) in the other hand.
   2H bows occupy both slots → never pair with quivers. Same-card-in-both-hands is
   impossible per catalog (each item's card ids are item-unique by convention `<item>_<card>`).
5. **Mod application at resolution:** combat reducer's playCard path reads
   `decks[src].cardMods?.[cardId]` and appends: poison/slow → `ApplyStatus`;
   thunder → armor-piercing bonus magic damage; explosive → splash damage to tiles
   adjacent to the target. Deterministic, serializable, replay-safe.
6. **runStore actions:** `equipItem { unitId, itemId, slot }` / `unequipItem { unitId, slot }`.
   Atomic bag round-trip; 2H equips into left and locks right (previous items must
   fit back into the bag or the action is a no-op); equip-over-existing swaps.
7. **Save v0.7.0-gear:** hand slots serialized with party units; pre-alpha nuke
   policy on version mismatch (loud warning), no migration ladder yet.
8. **Battle seeding:** party decks via deckBuilder (seedStubBattle + seedDungeonBattle);
   enemies keep class-innate decks until enemy-gear content lands (Phase 45).
9. **Starter loadouts** (ship plan §17-P2): Roy Iron Sword; Marcus Iron Lance +
   Iron Buckler; Lilina Fire Tome. Fire Tome moves from "class flavor" to gear item.

## Order of work

1. **448** domain + schemas + load (gear item fields, validation)
2. **449** hand slots + equip/unequip runStore actions + save bump
3. **450** deckBuilder + seeding integration + source tags
4. **451** quiver mods (build-time map + resolution-time effects)
5. **453** Borderlands gear content (14 items + cards) + starter loadouts
6. **452** CLI/sim loadout support
7. **454/455/456** Thornwood, Ashfall, Epic/Legendary content
8. **457/458** shops + loot economy
9. **459/460** loadout UI + rarity/deck-preview/source indicators

## Test targets (TDD)

- `deckBuilder.test.ts` — composition per loadout archetype (§2 table), source tags,
  empty slots, 2H card counts (6-8), no shared array refs.
- `quiverModifier.test.ts` — 4 mod types map correctly; no bow → no mods; bow
  without quiver → no mods; mods only on damage cards.
- `runStore.equip.test.ts` — equip/unequip/swap/2H lock/locked-slot no-op/bag-full
  no-op/bag round-trip; save round-trip preserves slots.
- `combatReducer.quiver.test.ts` — playCard with modded card emits status/splash.
- Content: schema boot validation + lint:content gear refs; catalog counts (§7).
