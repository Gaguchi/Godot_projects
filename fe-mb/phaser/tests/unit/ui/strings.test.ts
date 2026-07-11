import { describe, it, expect } from 'vitest'
import { GAME_TITLE, GAME_TAGLINE, formatLocationName, formatSaveDate } from '../../../src/ui/strings'

describe('ui/strings — display-name layer', () => {
  it('GAME_TITLE is a player-facing name, not the repo codename', () => {
    expect(GAME_TITLE.length).toBeGreaterThan(0)
    expect(GAME_TITLE).not.toMatch(/FE_MB/i)
    expect(GAME_TITLE).not.toContain('_')
  })

  it('GAME_TAGLINE exists and carries no dev strings', () => {
    expect(GAME_TAGLINE.length).toBeGreaterThan(0)
    expect(GAME_TAGLINE).not.toContain('_')
  })

  describe('formatLocationName', () => {
    it('surfaces only the node segment of a region path, humanized', () => {
      expect(formatLocationName('borderlands · pine_crossing')).toBe('Pine Crossing')
    })
    it('humanizes bare snake_case ids', () => {
      expect(formatLocationName('riverside_market')).toBe('Riverside Market')
    })
    it('passes through already-clean names', () => {
      expect(formatLocationName('Frontier Camp')).toBe('Frontier Camp')
    })
    it('never renders an empty string to the player', () => {
      expect(formatLocationName('')).toBe('Unmarked Road')
      expect(formatLocationName('   ')).toBe('Unmarked Road')
    })
  })

  describe('formatSaveDate', () => {
    it('renders a short date without seconds', () => {
      const out = formatSaveDate(new Date(2026, 6, 10, 17, 23, 41).getTime())
      expect(out).toMatch(/\d{1,2}:\d{2}/) // hour:minute present
      expect(out).not.toMatch(/\d{1,2}:\d{2}:\d{2}/) // no seconds
      expect(out).toMatch(/10/) // day of month
    })
    it('renders nothing for the zero timestamp (blank slot)', () => {
      expect(formatSaveDate(0)).toBe('')
    })
  })
})
