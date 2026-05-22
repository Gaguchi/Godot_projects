import type { Unit, UnitStats } from '../domain/unit'
import classesJson from '../data/content/classes.json'
import { asUnitId, asClassId } from '../domain/ids'

interface ClassDef {
  id: string
  name: string
  baseStats: UnitStats
  startingMov: number
  startingHp: number
}

const classMap = new Map<string, ClassDef>(
  (classesJson as ClassDef[]).map((c) => [c.id, c]),
)

/**
 * Construct a Unit from a class id + level. Used at recruitment time so the
 * tavern can offer specific classes without authoring full Unit JSON.
 *
 * Stats use class.baseStats with a simple `+1 per level above 1` linear lift
 * across all positive stats. This is intentionally simple — proper growth-
 * rate rolls (per classes.json growthRates) are a future refinement, but
 * deterministic linear progression keeps recruits predictable for now.
 *
 * `nameHint` overrides the unit's display name; falls back to class name.
 */
export function buildUnit(
  classId: string,
  level: number,
  nameHint?: string,
  uniqueIdSuffix?: string,
): Unit | null {
  const cls = classMap.get(classId)
  if (!cls) return null
  const lvlBonus = Math.max(0, level - 1)
  const lift = (n: number): number => (n > 0 ? n + lvlBonus : n)
  const stats: UnitStats = {
    str: lift(cls.baseStats.str),
    mag: lift(cls.baseStats.mag),
    skl: lift(cls.baseStats.skl),
    spd: lift(cls.baseStats.spd),
    def: lift(cls.baseStats.def),
    res: lift(cls.baseStats.res),
    lck: lift(cls.baseStats.lck),
  }
  const hpMax = cls.startingHp + lvlBonus * 3
  const idCore = uniqueIdSuffix ?? `${classId}_${Date.now().toString(36)}`
  return {
    id: asUnitId(idCore),
    name: nameHint ?? cls.name,
    classId: asClassId(classId),
    level,
    hp: { current: hpMax, max: hpMax },
    stats,
    position: null,
    ap: 3,
    armor: 0,
    statuses: [],
  }
}
