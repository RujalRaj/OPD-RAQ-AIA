import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { playPrompt } from './speech'
import { VitalEditor } from './components'
import Intake from './Intake'
import type { Catalog } from './types'

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal(
    'Audio',
    class {
      play = vi.fn(() => Promise.resolve())
      pause = vi.fn()
    },
  )
})
afterEach(() => vi.unstubAllGlobals())
describe('accessible input fallbacks', () => {
  it('starts at language selection and keeps the form available without audio', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    render(
      <Intake
        catalog={{ patient_options: [], facts: [], rules: [], version: 'test' } as Catalog}
        onExit={() => {}}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('अपनी भाषा चुनें।')
    expect(screen.queryByLabelText('अपनी परेशानी लिखें')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'English Continue in English' }))
    expect(await screen.findByLabelText('Demo name')).toBeEnabled()
    expect(screen.queryByLabelText('Describe your symptoms')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Registration'), { target: { value: 'ABHA' } })
    expect(await screen.findByLabelText('ABHA ID (demo only)')).toBeEnabled()
    expect(screen.queryByLabelText('Demo name')).not.toBeInTheDocument()
    expect(screen.getByText('ABHA lookup is in development')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Continue with manual registration' }))
    expect(await screen.findByLabelText('Demo name')).toBeEnabled()
  })
  it('reports unavailable TTS instead of requiring audio', () => {
    const notify = vi.fn()
    vi.stubGlobal('Audio', undefined)
    playPrompt('method_hi', notify)
    expect(notify).toHaveBeenCalled()
  })
  it('keeps zero as an entered value rather than a missing measurement', () => {
    const changed = vi.fn()
    render(<VitalEditor value={{}} onChange={changed} />)
    fireEvent.change(screen.getByLabelText('Pulse beats/min'), { target: { value: '0' } })
    expect(changed).toHaveBeenCalledWith({ pr: { value: 0, status: 'RECORDED' } })
  })
  it('can explicitly mark a measurement unavailable without inventing a value', () => {
    const changed = vi.fn()
    render(<VitalEditor value={{}} onChange={changed} />)
    fireEvent.change(screen.getByLabelText('Random blood sugar measurement status'), {
      target: { value: 'UNABLE_TO_OBTAIN' },
    })
    expect(changed).toHaveBeenCalledWith({ rbs: { value: null, status: 'UNABLE_TO_OBTAIN' } })
  })
})
