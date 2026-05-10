import { useEffect, useRef, useState } from 'react'

/**
 * Phoenix-Wright-style text reveal:
 * - Reveals `text` char-by-char at `cps` chars/sec.
 * - Reveal restarts whenever `text` changes (e.g., advancing to next dialogue node).
 * - Returns `{ visibleText, isDone, complete() }`. `complete()` immediately
 *   shows the full text (called on click-to-skip, or whenever the player
 *   wants to bypass the animation).
 *
 * Honors `prefers-reduced-motion`: when reduced-motion is on, the full text
 * is shown immediately on mount + reset.
 */
export function useTypewriter(text: string, cps = 30): {
  visibleText: string
  isDone: boolean
  complete: () => void
} {
  const [visible, setVisible] = useState(text)
  const [isDone, setIsDone] = useState(true)
  const rafRef = useRef<number | null>(null)
  const startedAt = useRef<number>(0)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || cps <= 0 || text.length === 0) {
      setVisible(text)
      setIsDone(true)
      return
    }

    setVisible('')
    setIsDone(false)
    startedAt.current = performance.now()

    const tick = (now: number): void => {
      if (cancelled.current) return
      const elapsedMs = now - startedAt.current
      const charsToShow = Math.min(text.length, Math.floor((elapsedMs / 1000) * cps))
      setVisible(text.slice(0, charsToShow))
      if (charsToShow >= text.length) {
        setIsDone(true)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled.current = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [text, cps])

  const complete = (): void => {
    cancelled.current = true
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    setVisible(text)
    setIsDone(true)
  }

  return { visibleText: visible, isDone, complete }
}
