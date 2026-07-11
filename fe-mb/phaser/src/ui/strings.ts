/**
 * Player-facing branding strings + display-name formatters.
 *
 * The display-name layer: raw ids, codenames, and machine strings must never
 * reach the player. Anything the player reads comes from here (or from the
 * content pipeline), formatted at the display boundary.
 */

/** Working title — replaces the repo codename on every player surface. */
export const GAME_TITLE = 'Embermarch'

/** In-voice tagline under the title plate. */
export const GAME_TAGLINE = 'a tactical roguelite'

/**
 * Save summaries store location as a raw path like
 * "borderlands · pine_crossing". Surface only the node, humanized:
 * "Pine Crossing". Never show snake_case to the player.
 */
export function formatLocationName(raw: string): string {
  const segment = raw.includes('·') ? (raw.split('·').pop() ?? raw) : raw
  const words = segment.trim().replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'Unmarked Road'
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Short game-menu date: "Jul 10, 5:23 PM" — never toLocaleString() dumps. */
const SAVE_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatSaveDate(ts: number): string {
  if (ts === 0) return ''
  return SAVE_DATE_FORMAT.format(new Date(ts))
}
