/**
 * ui/combat/fieldArt.ts — which piece of the field's art lies on which tile.
 *
 * The ground is one picture of an empty clearing; a battle's own dirt patch and boulders are laid on it as tiles
 * (`tools/pxworld/src/px-combat/export_game.py` cuts them with the functions that paint the board's field). A dirt
 * tile is named by which of its eight neighbours are dirt too: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128, a corner
 * counting only when both edges beside it are dirt. Pure; the board asks, nothing here draws.
 */
import raw from './fieldArt.json'

interface FieldArt {
  readonly tile: number
  readonly dirt: { readonly codes: readonly number[]; readonly inner: number; readonly innerTakes: number }
  readonly rock: { readonly takes: number; readonly box: readonly [number, number, number, number] }
  readonly feet: number
  readonly acting: readonly [number, number]
}
export const fieldArt = raw as unknown as FieldArt

const ORTH: readonly (readonly [number, number, number])[] = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]
const DIAG: readonly (readonly [number, number, number, number, number])[] = [[16, 1, -1, 1, 2], [32, 1, 1, 4, 2], [64, -1, 1, 4, 8], [128, -1, -1, 1, 8]]

/** A stable pick per tile, so the same battle always lays the same takes. */
function pick(x: number, y: number, n: number): number {
  return (((x * 2654435761) ^ (y * 40503)) >>> 0) % n
}

/** The dirt piece for painted cell (x, y): its file name under `/art/field/`, without the extension. */
export function dirtPiece(painted: ReadonlySet<string>, x: number, y: number): string {
  let bits = 0
  for (const [bit, dx, dy] of ORTH) if (painted.has(`${x + dx},${y + dy}`)) bits |= bit
  for (const [bit, dx, dy, a, b] of DIAG) if ((bits & a) !== 0 && (bits & b) !== 0 && painted.has(`${x + dx},${y + dy}`)) bits |= bit
  return bits === fieldArt.dirt.inner ? `dirt_${bits}_${pick(x, y, fieldArt.dirt.innerTakes)}` : `dirt_${bits}`
}

/** The boulder for an impassable tile. */
export function rockPiece(x: number, y: number): string {
  return `rock_${pick(x, y, fieldArt.rock.takes)}`
}
