/**
 * ui/overworld/palette.ts — region identity is ONE palette swap. Borderlands warm sepia → Thornwood cold
 * green-black → Ashfall scorched char + ember red. Every ink on the sheet (roads, marks, labels, terrain
 * symbols, the "you are here" seal) reads from here, so a region never has a colour of its own anywhere else.
 */
export interface RegionPalette {
  /**
   * Aged paper. `base`/`mid`/`deep` are the sheet's own radial falloff; `disc`/`discFaded` are the lighter stock a
   * location MARK is cut from (`NodeMark`), near and far. They live here rather than in the component because a
   * region's paper is region identity — and because `ui/overworld/palette.ts` is the one file the tokens rule
   * exempts (`tests/unit/ui/materials.test.ts`), so a hex anywhere else is a fork of this table.
   */
  readonly parchment: { readonly base: string; readonly mid: string; readonly deep: string; readonly disc: string; readonly discFaded: string }
  /** Primary cartographer's ink (roads, sigils, labels). */
  readonly ink: string
  /** Lighter ink for fills / distant marks. */
  readonly inkSoft: string
  /** Route / wax accent — planned legs, the active hop, the current-node seal. */
  readonly accent: string
  /** Ember mote colour for the active hop's comet. Always a real hue: the comet is drawn on every region. */
  readonly ember: string
}

const PALETTES: Readonly<Record<string, RegionPalette>> = {
  borderlands: { parchment: { base: '#efe2c0', mid: '#e6d6ac', deep: '#d8c08c', disc: '#f7efd8', discFaded: '#e6ddc4' }, ink: '#5b4126', inkSoft: '#8a6f4a', accent: '#9c3318', ember: '#d9a93f' },
  thornwood: { parchment: { base: '#e2dcc2', mid: '#d4cda9', deep: '#bfb389', disc: '#f2eeda', discFaded: '#dcd7bf' }, ink: '#3a4a33', inkSoft: '#6d7a5e', accent: '#7a2f1d', ember: '#d9a93f' },
  ashfall: { parchment: { base: '#e8d2ae', mid: '#d9bd92', deep: '#c0a072', disc: '#f7e7c9', discFaded: '#e2cfae' }, ink: '#4a241a', inkSoft: '#8a5a40', accent: '#b03020', ember: '#ff7a3c' },
}

export function regionPalette(regionId: string): RegionPalette {
  return PALETTES[regionId] ?? PALETTES['borderlands']!
}
