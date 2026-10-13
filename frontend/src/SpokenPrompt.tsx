import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { playPrompt, PROMPTS } from './speech'
import type { Playback, PromptId } from './speech'

export default function SpokenPrompt({
  id,
  muted,
  onMute,
  active = true,
}: {
  id: PromptId
  active?: boolean
  muted: boolean
  onMute: (value: boolean) => void
}) {
  const [playback, setPlayback] = useState<Playback>({ state: 'loading', time: 0 })
  const cancel = useRef<(() => void) | undefined>(undefined)
  const autoStart = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const welcome = id === 'welcome'
  const hi = id !== 'method_en'
  const t = (en: string, hindi: string) => (welcome ? `${hindi} / ${en}` : hi ? hindi : en)
  function play() {
    clearTimeout(autoStart.current)
    cancel.current?.()
    cancel.current = playPrompt(id, setPlayback)
  }
  function stop() {
    clearTimeout(autoStart.current)
    cancel.current?.()
    setPlayback({ state: 'ended', time: 0 })
  }
  useEffect(() => {
    // The entrance has time to settle; blocked autoplay leaves text and Replay.
    if (!active) return
    if (!muted)
      autoStart.current = setTimeout(() => {
        cancel.current = playPrompt(id, setPlayback)
      }, 550)
    else setPlayback({ state: 'ended', time: 0 })
    return () => {
      clearTimeout(autoStart.current)
      cancel.current?.()
    }
  }, [id, muted, active])
  const allVisible = playback.state === 'ended' || playback.state === 'unavailable'
  return (
    <div className={`spoken-prompt ${welcome ? 'welcome-prompt' : ''}`}>
      <h1 tabIndex={-1} data-step-heading>
        {PROMPTS[id].lines.map((line) => (
          <span className="prompt-line" lang={line.language} key={line.language}>
            <span className="sr-only">{line.text}</span>
            <span aria-hidden="true">
              {line.words.map((word, index) => (
                <span
                  key={index}
                  className={`prompt-word ${allVisible || (playback.state === 'playing' && playback.time >= word.at) ? 'revealed' : ''}`}
                  style={{ '--word-index': index } as CSSProperties}
                >
                  {word.text}{' '}
                </span>
              ))}
            </span>
          </span>
        ))}
      </h1>
      <div className="audio-actions">
        <button type="button" className="listen" onClick={play}>
          <Volume2 size={19} aria-hidden="true" />
          {t('Listen', 'सुनें')}
        </button>
        <button type="button" className="text-button" onClick={stop}>
          <Square size={15} aria-hidden="true" />
          {t('Stop audio', 'आवाज़ रोकें')}
        </button>
      </div>
      <p className="speech-status" role="status">
        {playback.state === 'unavailable'
          ? t('Tap Listen or continue by reading.', 'सुनें दबाएँ या निर्देश पढ़कर आगे बढ़ें।')
          : playback.state === 'playing'
            ? t('Playing instructions…', 'निर्देश सुनें…')
            : playback.state === 'ended'
              ? t('You can replay whenever you like.', 'जब चाहें, दोबारा सुन सकते हैं।')
              : ''}
      </p>
      <label className="quiet-choice">
        <input
          type="checkbox"
          checked={muted}
          onChange={(event) => {
            stop()
            onMute(event.target.checked)
          }}
        />
        {t('Keep automatic voice off', 'अपने आप आवाज़ न चलाएँ')}
      </label>
    </div>
  )
}
