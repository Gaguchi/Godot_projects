/**
 * Region identity = one palette swap (split-view spec 2026-06-12). Single
 * source for BOTH overworld surfaces:
 *   - the paper map (parchment tones + ink colors + route accent)
 *   - the travel band (sky tint, silhouette ink, fog, ground, embers)
 * Escalating dread: Borderlands warm sepia → Thornwood cold green-black →
 * Ashfall scorched char + ember red.
 */

export interface RegionPalette {
  /** Aged paper, light → deep (radial falloff). */
  parchment: { base: string; mid: string; deep: string }
  /** Primary cartographer's ink (roads, sigils, labels). */
  ink: string
  /** Lighter ink for fills / distant marks. */
  inkSoft: string
  /** Route/wax accent — planned legs, the active hop, the current-node seal. */
  accent: string
  /** Sea/water hatching ink. */
  sea: string

  /** Travel band: silhouette ink for mid-layer scenery + caravan surround. */
  silhouette: string
  /** Travel band: ground-strip soil tones, top → bottom. */
  ground: { top: string; bottom: string; track: string }
  /** Travel band: drifting fog tint (rgb triplet usable in rgba()). */
  fog: string
  /** Travel band: sky multiply tint laid over the far vista ('' = none). */
  skyTint: string
  /** Ember mote color ('' = no embers for this region). */
  ember: string
}

export const REGION_PALETTES: Record<string, RegionPalette> = {
  borderlands: {
    parchment: { base: '#efe2c0', mid: '#e6d6ac', deep: '#d8c08c' },
    ink: '#5b4126',
    inkSoft: '#8a6f4a',
    accent: '#9c3318',
    sea: '#6a5f48',
    silhouette: '#1a140c',
    ground: { top: '#241a10', bottom: '#120c07', track: '#3a2c1a' },
    fog: '201, 163, 106',
    skyTint: '',
    ember: '',
  },
  thornwood: {
    parchment: { base: '#e2dcc2', mid: '#d4cda9', deep: '#bfb389' },
    ink: '#3a4a33',
    inkSoft: '#6d7a5e',
    accent: '#7a2f1d',
    sea: '#5d6650',
    silhouette: '#0d1410',
    ground: { top: '#161e16', bottom: '#0a0f0a', track: '#28301f' },
    fog: '143, 165, 131',
    skyTint: 'rgba(12,22,18,0.34)',
    ember: '',
  },
  ashfall: {
    parchment: { base: '#e8d2ae', mid: '#d9bd92', deep: '#c0a072' },
    ink: '#4a241a',
    inkSoft: '#8a5a40',
    accent: '#b03020',
    sea: '#6e5440',
    silhouette: '#140a08',
    ground: { top: '#241108', bottom: '#120705', track: '#3c1f10' },
    fog: '168, 106, 74',
    skyTint: 'rgba(60,16,8,0.14)',
    ember: '#ff7a3c',
  },
}

export function regionPalette(regionId: string): RegionPalette {
  return REGION_PALETTES[regionId] ?? REGION_PALETTES['borderlands']!
}
