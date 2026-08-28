/**
 * ASCII renderer for a CombatState — the "view" layer of the headless CLI.
 * Pure: takes a CombatState, returns strings. No Phaser, no React, no I/O.
 *
 * Glyphs: allies get lowercase a,b,c…; enemies uppercase A,B,C…; the active
 * unit's glyph is wrapped in [brackets]. A legend maps glyph → name/HP/AP.
 */
import type { CombatState } from '../../src/domain/combatState'
import type { Unit } from '../../src/domain/unit'
import cardsJson from '../../src/data/content/cards.json'

const cardsById = new Map(cardsJson.map((c) => [c.id, c]))

// Re-exported from the single source of truth rather than reimplemented. The
// local copy that used to live here predated `Unit.team` and listed only
// bandit/brigand/wolf, so the Warlord in `--scenario boss` rendered as an ALLY
// in the ASCII board and in --json output.
export { isEnemyUnit } from '../../src/systems/team'
import { isEnemyUnit } from '../../src/systems/team'

export function tileXY(tileId: string): [number, number] {
  const [x, y] = tileId.split(',')
  return [Number(x), Number(y)]
}

/** Stable glyph assignment: party = a.. , enemies = A.. (sorted by id). */
export function assignGlyphs(state: CombatState): Map<string, string> {
  const units = Object.values(state.units)
  const party = units.filter((u) => !isEnemyUnit(u)).sort(byId)
  const enemies = units.filter(isEnemyUnit).sort(byId)
  const map = new Map<string, string>()
  party.forEach((u, i) => map.set(u.id as unknown as string, String.fromCharCode(97 + i)))
  enemies.forEach((u, i) => map.set(u.id as unknown as string, String.fromCharCode(65 + i)))
  return map
}
function byId(a: Unit, b: Unit): number {
  return (a.id as unknown as string).localeCompare(b.id as unknown as string)
}

function hpBar(cur: number, max: number, width = 8): string {
  const pct = Math.max(0, Math.min(1, cur / Math.max(1, max)))
  const filled = Math.round(pct * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function cardMagnitude(card: typeof cardsJson[number]): string {
  for (const e of card.effects) {
    const p = e.params as { base?: number; amount?: number }
    const n = p.base ?? p.amount
    if (e.kind === 'Damage' && typeof n === 'number') return `dmg${n}`
    if (e.kind === 'Heal' && typeof n === 'number') return `heal${n}`
    if (e.kind === 'GrantArmor' && typeof n === 'number') return `armor${n}`
  }
  return card.effects.map((e) => e.kind).join('+')
}

/** The full board + roster + hand + status, as a single string. */
export function renderCombat(state: CombatState): string {
  const glyphs = assignGlyphs(state)
  const { width, height } = state.grid
  const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)

  // tile -> glyph
  const occupied = new Map<string, { glyph: string; dead: boolean; active: boolean }>()
  for (const u of Object.values(state.units)) {
    if (!u.position) continue
    const id = u.id as unknown as string
    occupied.set(u.position as unknown as string, {
      glyph: glyphs.get(id) ?? '?',
      dead: u.hp.current <= 0,
      active: id === activeId,
    })
  }

  const lines: string[] = []
  // column header
  lines.push('    ' + Array.from({ length: width }, (_, x) => String(x).padStart(2, ' ')).join(' '))
  for (let y = 0; y < height; y++) {
    const cells: string[] = []
    for (let x = 0; x < width; x++) {
      const o = occupied.get(`${x},${y}`)
      if (!o) { cells.push(' · '); continue }
      const g = o.dead ? '✝' : o.glyph
      cells.push(o.active ? `[${g}]` : ` ${g} `)
    }
    lines.push(String(y).padStart(2, ' ') + ' ' + cells.join(''))
  }

  // roster
  const rosterLine = (u: Unit): string => {
    const id = u.id as unknown as string
    const g = glyphs.get(id) ?? '?'
    const act = id === activeId ? '*' : ' '
    const pos = u.position ? (u.position as unknown as string) : '—'
    const st = u.statuses.length
      ? ' {' + u.statuses.map((s) => `${(s.effectId as unknown as string)}:${s.turnsRemaining}t`).join(',') + '}'
      : ''
    const armor = u.armor > 0 ? ` armor${u.armor}` : ''
    const dead = u.hp.current <= 0 ? ' DEAD' : ''
    return `  ${g}${act} ${u.name.padEnd(8)} L${u.level} ${hpBar(u.hp.current, u.hp.max)} ${String(u.hp.current).padStart(3)}/${String(u.hp.max).padEnd(3)} AP${u.ap}${armor} @${pos}${st}${dead}`
  }
  const party = Object.values(state.units).filter((u) => !isEnemyUnit(u)).sort(byId)
  const enemies = Object.values(state.units).filter(isEnemyUnit).sort(byId)

  lines.push('')
  lines.push('PARTY')
  party.forEach((u) => lines.push(rosterLine(u)))
  lines.push('ENEMY')
  enemies.forEach((u) => lines.push(rosterLine(u)))

  // hand (active party unit only)
  if (activeId && state.turn.team === 'party') {
    const deck = state.decks[activeId]
    const unit = state.units[activeId]
    if (deck && unit) {
      lines.push('')
      lines.push(`HAND (${unit.name}, ${unit.ap} AP):`)
      deck.hand.slice(0, 6).forEach((cid, i) => {
        const card = cardsById.get(cid as unknown as string)
        if (!card) { lines.push(`  [${i}] ${cid} (unknown)`); return }
        const afford = card.apCost <= unit.ap ? '' : '  (can\'t afford)'
        lines.push(`  [${i}] ${card.name.padEnd(16)} ${card.apCost}AP  ${card.targetKind.padEnd(11)} r${card.range.min}-${card.range.max}  ${cardMagnitude(card)}${afford}`)
      })
    }
  }

  // status
  const who = activeId ? (state.units[activeId]?.name ?? activeId) : '—'
  const banner = state.phase === 'VICTORY' ? '★ VICTORY ★'
    : state.phase === 'DEFEAT' ? '✗ DEFEAT ✗'
      : `${state.turn.team === 'party' ? 'YOUR TURN' : 'ENEMY TURN'}`
  lines.unshift(`Turn ${state.turn.number} · ${banner} · active: ${who} · phase=${state.phase}/${state.subPhase}`)
  lines.unshift('')

  return lines.join('\n')
}
