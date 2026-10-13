import { completeVitals } from './registration-helpers'
import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(
  readFileSync(new URL('../src/assets/voice/manifest.json', import.meta.url), 'utf8'),
)

const evidence = JSON.parse(
  readFileSync(new URL('../../docs/instruction-audio-verification.json', import.meta.url), 'utf8'),
)

for (const id of ['welcome', 'method_hi', 'method_en']) {
  // A regenerated file must be independently rechecked before acceptance.
  expect(manifest[id].sha256).toBe(evidence.clips[id].sha256)
  expect(manifest[id].lines.map((line: { text: string }) => line.text)).toEqual(
    evidence.clips[id].lines.map((line: { text: string }) => line.text),
  )

  test(`${id}: plays the complete local neural recording and reveals words with media time`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
      const NativeAudio = window.Audio
      window.Audio = function (src?: string) {
        const audio = new NativeAudio(src)
        audio.dataset.testid = 'instruction-audio'
        document.body.appendChild(audio)
        return audio
      } as typeof Audio
    })
    const response = page.waitForResponse(
      (r) => new URL(r.url()).pathname.endsWith(`/${id}.mp3`) && new URL(r.url()).search === '',
    )
    await page.goto('/intake')
    if (id !== 'welcome') {
      const hi = id === 'method_hi'
      await page
        .getByRole('button', {
          name: hi ? 'हिन्दी हिन्दी में आगे बढ़ें' : 'English Continue in English',
        })
        .click()
      await page.getByLabel(hi ? 'काल्पनिक नाम' : 'Demo name').fill('Audio demo')
      await page.getByLabel(hi ? 'उम्र (वर्ष)' : 'Age in years').fill('27')
      await page.getByRole('button', { name: hi ? 'आगे बढ़ें' : 'Next', exact: true }).click()
      await completeVitals(page, hi)
    }
    await page
      .getByRole('button', {
        name: id === 'welcome' ? 'सुनें / Listen' : id === 'method_hi' ? 'सुनें' : 'Listen',
        exact: true,
      })
      .click()
    expect(
      createHash('sha256')
        .update(await (await response).body())
        .digest('hex'),
    ).toBe(manifest[id].sha256)
    const media = page.getByTestId('instruction-audio').last()
    await expect(page.getByRole('status')).toContainText(
      id === 'method_en' ? 'Playing instructions' : 'निर्देश सुनें',
    )
    // Genuine media is playing. Later words must not all appear at startup.
    const wordCount = manifest[id].lines.flatMap((line: { words: unknown[] }) => line.words).length
    await expect.poll(() => page.locator('.prompt-word.revealed').count()).toBeGreaterThan(0)
    expect(await page.locator('.prompt-word.revealed').count()).toBeLessThan(wordCount)
    await expect(page.getByRole('status')).toContainText(id === 'method_en' ? 'replay' : 'दोबारा', {
      timeout: 15000,
    })
    await expect(page.locator('.prompt-word.revealed')).toHaveCount(wordCount)
    const result = await media.evaluate((a: HTMLAudioElement) => ({
      ended: a.ended,
      time: a.currentTime,
      duration: a.duration,
      volume: a.volume,
      error: a.error,
    }))
    expect(result.ended).toBe(true)
    expect(result.time).toBeCloseTo(result.duration, 1)
    expect(result.duration).toBeCloseTo(manifest[id].duration, 1)
    expect(result.volume).toBe(0.8)
    expect(result.error).toBeNull()
    await page.screenshot({ path: `test-results/${id}.png`, fullPage: true })
  })
}

test('blocked or missing audio leaves all words readable; Replay and Stop remain available', async ({
  page,
}) => {
  await page.route('**/src/assets/voice/welcome.mp3', (route) => route.abort())
  await page.goto('/intake')
  await page.getByRole('button', { name: 'सुनें / Listen', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Tap Listen')
  await expect(page.locator('.prompt-word.revealed')).toHaveCount(7)
  await expect(page.getByRole('button', { name: 'English Continue in English' })).toBeEnabled()
  await page.getByRole('button', { name: 'आवाज़ रोकें / Stop audio' }).click()
  await page.getByRole('button', { name: 'English Continue in English' }).click()
  await expect(page.getByLabel('Demo name')).toBeVisible()
})
