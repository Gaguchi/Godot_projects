import { describe, it, expect } from 'vitest'
import { sfx, setMusicContext, setMuted, setVolume, isMuted, unlockAudio } from '../../../src/audio/engine'
import { useMetaStore } from '../../../src/state/metaStore'

describe('audio engine (jsdom has no AudioContext — everything must no-op safely)', () => {
  it('all entry points are safe without an AudioContext', () => {
    expect(() => {
      unlockAudio()
      sfx('cardPlay'); sfx('victory'); sfx('hitPhysical')
      setMusicContext('combat'); setMusicContext('overworld'); setMusicContext('none')
      setVolume(0.5)
      setMuted(true)
    }).not.toThrow()
    expect(isMuted()).toBe(true)
    setMuted(false)
  })
})

describe('metaStore audio prefs', () => {
  it('setAudioMuted toggles through dispatch', () => {
    useMetaStore.getState().__reset()
    useMetaStore.getState().dispatch({ type: 'setAudioMuted', payload: { muted: true } })
    expect(useMetaStore.getState().audioMuted).toBe(true)
    useMetaStore.getState().dispatch({ type: 'setAudioMuted', payload: { muted: false } })
    expect(useMetaStore.getState().audioMuted).toBe(false)
  })
})
