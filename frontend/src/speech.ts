import welcomeUrl from './assets/voice/welcome.mp3'
import hindiUrl from './assets/voice/method_hi.mp3'
import englishUrl from './assets/voice/method_en.mp3'
import manifest from './assets/voice/manifest.json'

export const PROMPTS = manifest
export type PromptId = keyof typeof manifest
export type Playback = { state: 'loading' | 'playing' | 'ended' | 'unavailable'; time: number }
const sources: Record<PromptId, string> = {
  welcome: welcomeUrl,
  method_hi: hindiUrl,
  method_en: englishUrl,
}
type RecognitionResult = { isFinal: boolean; [key: number]: { transcript: string } }
export type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { resultIndex: number; results: RecognitionResult[] }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
export function recognitionConstructor() {
  const w = window as SpeechWindow
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

let activeSpeech: (() => void) | undefined
export function stopSpeaking() {
  activeSpeech?.()
}

// All fixed prompts use bundled neural-voice clips: no OS voice, network,
// patient information, or speechSynthesis fallback is involved in playback.
export function playPrompt(id: PromptId, onProgress: (value: Playback) => void) {
  stopSpeaking()
  let audio: HTMLAudioElement
  try {
    audio = new Audio(sources[id])
  } catch {
    onProgress({ state: 'unavailable', time: 0 })
    return () => {}
  }
  audio.volume = 0.8
  let cancelled = false
  let frame: number | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  function cancel() {
    cancelled = true
    clearTimeout(timeout)
    if (frame !== undefined) cancelAnimationFrame(frame)
    audio.onplaying = audio.onended = audio.onerror = audio.onwaiting = audio.ontimeupdate = null
    audio.pause()
    if (activeSpeech === cancel) activeSpeech = undefined
  }
  function finish(state: 'ended' | 'unavailable') {
    if (cancelled) return
    onProgress({ state, time: audio.currentTime || 0 })
    cancel()
  }
  function tick() {
    if (cancelled) return
    onProgress({ state: 'playing', time: audio.currentTime || 0 })
    frame = requestAnimationFrame(tick)
  }
  function watchdog() {
    clearTimeout(timeout)
    timeout = setTimeout(() => finish('unavailable'), 10000)
  }
  audio.onplaying = () => {
    if (cancelled) return
    clearTimeout(timeout)
    if (frame !== undefined) cancelAnimationFrame(frame)
    tick()
  }
  audio.ontimeupdate = () => {
    if (!cancelled && !audio.paused) watchdog()
  }
  audio.onwaiting = watchdog
  audio.onended = () => finish('ended')
  audio.onerror = () => finish('unavailable')
  activeSpeech = cancel
  onProgress({ state: 'loading', time: 0 })
  watchdog()
  try {
    void audio.play().catch(() => finish('unavailable'))
  } catch {
    finish('unavailable')
  }
  return cancel
}
