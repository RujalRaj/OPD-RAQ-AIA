import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playPrompt, stopSpeaking } from './speech'

class FakeAudio {
  currentTime = 0
  volume = 1
  paused = false
  onplaying: (() => void) | null = null
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onwaiting: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  constructor(public src: string) {
    players.push(this)
  }
}
let players: FakeAudio[] = []
beforeEach(() => {
  vi.useFakeTimers()
  players = []
  vi.stubGlobal('Audio', FakeAudio)
})
afterEach(() => {
  stopSpeaking()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('local neural instructions', () => {
  it('uses the bilingual welcome and a gentler volume without any browser voice', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    const update = vi.fn()
    playPrompt('welcome', update)
    expect(players[0].src).toContain('welcome.mp3')
    expect(players[0].volume).toBe(0.8)
    players[0].currentTime = 1.25
    players[0].onplaying?.()
    expect(update).toHaveBeenLastCalledWith({ state: 'playing', time: 1.25 })
    players[0].onended?.()
    expect(update).toHaveBeenLastCalledWith({ state: 'ended', time: 1.25 })
  })
  it('selects only the chosen language and cancels previous audio and late callbacks', () => {
    const first = vi.fn()
    playPrompt('method_hi', first)
    expect(players[0].src).toContain('method_hi.mp3')
    const lateEnd = players[0].onended
    playPrompt('method_en', vi.fn())
    expect(players[1].src).toContain('method_en.mp3')
    expect(players[0].pause).toHaveBeenCalledOnce()
    lateEnd?.()
    expect(first).toHaveBeenCalledTimes(1)
    stopSpeaking()
    expect(players[1].pause).toHaveBeenCalledOnce()
    expect(players[1].onplaying).toBeNull()
  })
  it('uses actual media time so words do not advance while playback is buffering', () => {
    const update = vi.fn()
    playPrompt('method_hi', update)
    players[0].currentTime = 2
    players[0].onplaying?.()
    vi.advanceTimersByTime(500)
    expect(update).toHaveBeenLastCalledWith({ state: 'playing', time: 2 })
    players[0].currentTime = 2.8
    vi.advanceTimersByTime(20)
    expect(update).toHaveBeenLastCalledWith({ state: 'playing', time: 2.8 })
  })
  it('reports blocked autoplay and allows an explicit replay', async () => {
    const update = vi.fn()
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        play = vi.fn(() => Promise.reject(new DOMException('blocked', 'NotAllowedError')))
      },
    )
    playPrompt('welcome', update)
    await Promise.resolve()
    expect(update).toHaveBeenLastCalledWith({ state: 'unavailable', time: 0 })
    vi.stubGlobal('Audio', FakeAudio)
    playPrompt('welcome', update)
    expect(players[1].play).toHaveBeenCalledOnce()
  })
  it('cleans up failed, missing and stalled media without a broken synthesis fallback', () => {
    const update = vi.fn()
    playPrompt('method_hi', update)
    players[0].onerror?.()
    expect(update).toHaveBeenLastCalledWith({ state: 'unavailable', time: 0 })
    playPrompt('method_hi', update)
    vi.advanceTimersByTime(10000)
    expect(players[1].pause).toHaveBeenCalledOnce()
    expect(update).toHaveBeenLastCalledWith({ state: 'unavailable', time: 0 })
    vi.stubGlobal('Audio', undefined)
    playPrompt('welcome', update)
    expect(update).toHaveBeenLastCalledWith({ state: 'unavailable', time: 0 })
  })
})
