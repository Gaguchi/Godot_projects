import { buildUnit } from './buildUnit'
import { getItemDef } from '../data/itemRegistry'
import type { Unit } from '../domain/unit'
import type { ItemId } from '../domain/ids'

/**
 * Ship-plan §17-P2 starter party with equipped loadouts:
 *   Roy (LORD)     — Iron Sword
 *   Marcus (KNIGHT)— Iron Lance + Iron Buckler
 *   Lilina (MAGE)  — Fire Tome
 *
 * Gear starts EQUIPPED (hand slots), not in the bag. Slots are only set when
 * the item id resolves in the catalog, so a missing content entry degrades to
 * an innate-only deck instead of crashing.
 */
const STARTERS: Array<{ classId: string; name: string; id: string; left: string | null; right: string | null }> = [
  { classId: 'lord', name: 'Roy', id: 'roy', left: 'iron_sword', right: null },
  { classId: 'knight', name: 'Marcus', id: 'marcus', left: 'iron_lance', right: 'iron_buckler' },
  { classId: 'mage', name: 'Lilina', id: 'lilina', left: 'fire_tome', right: null },
]

function slotOf(id: string | null): ItemId | null {
  if (!id) return null
  return getItemDef(id) ? (id as unknown as ItemId) : null
}

export function buildStarterParty(): Unit[] {
  const out: Unit[] = []
  for (const s of STARTERS) {
    const u = buildUnit(s.classId, 1, s.name, s.id)
    if (!u) continue
    out.push({ ...u, handLeft: slotOf(s.left), handRight: slotOf(s.right) })
  }
  return out
}
