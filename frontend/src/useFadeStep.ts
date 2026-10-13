import { useEffect, useRef, useState } from 'react'

export function useFadeStep<T>(initial: T) {
  const [value, setValue] = useState(initial)
  const [leaving, setLeaving] = useState(false)
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(pending.current), [])
  function change(next: T) {
    clearTimeout(pending.current)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(next)
      setLeaving(false)
    } else {
      setLeaving(true)
      pending.current = setTimeout(() => {
        setValue(next)
        setLeaving(false)
      }, 180)
    }
  }
  return [value, change, leaving] as const
}
