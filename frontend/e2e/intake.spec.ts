import { completeVitals } from './registration-helpers'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function accessible(page: import('@playwright/test').Page) {
  // Evaluate final colors after the requested fade, not a translucent animation frame.
  for (const panel of await page.locator('.flow-page').all())
    await expect(panel).toHaveCSS('opacity', '1')
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  )
}

test('Hindi details stay separate; ABHA hides manual fields and falls back without sending an ID', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url() + (r.postData() || '')))
  let payload: Record<string, unknown> = {}
  await page.route('**/api/v1/staff/encounters', async (route) => {
    payload = route.request().postDataJSON()
    await route.fulfill({
      json: { token: 999, urgent_alert: false, priority: 'SOON', ai_status: 'COMPLETE' },
    })
  })
  await page.goto('/intake')
  await page.getByRole('button', { name: 'हिन्दी हिन्दी में आगे बढ़ें' }).click()
  await expect(page.getByRole('heading', { name: 'आपके बारे में' })).toBeFocused()
  await expect(page.getByLabel('अपनी परेशानी लिखें')).toHaveCount(0)
  await expect(page.getByText('History & medicines')).toHaveCount(0)
  await page.getByLabel('काल्पनिक नाम').fill('डेमो मरीज')
  await page.getByLabel('उम्र (वर्ष)').fill('36')
  await page.getByRole('combobox', { name: 'पंजीकरण', exact: true }).selectOption('ABHA')
  await expect(page.getByLabel('काल्पनिक नाम')).toHaveCount(0)
  await expect(page.getByLabel('लिंग', { exact: true })).toHaveCount(0)
  await page.getByLabel('आभा आईडी (केवल डेमो)').fill('DEMO-NOT-A-REAL-ABHA')
  await expect(page.getByText('आभा से जानकारी लाने की सुविधा बन रही है')).toBeVisible()
  await accessible(page)
  await page.screenshot({ path: 'test-results/intake-abha.png', fullPage: true })
  await page.getByRole('button', { name: 'जानकारी खुद भरकर आगे बढ़ें' }).click()
  await expect(page.getByLabel('काल्पनिक नाम')).toHaveValue('डेमो मरीज')
  await expect(page.getByLabel('उम्र (वर्ष)')).toHaveValue('36')
  await page.getByRole('button', { name: 'आगे बढ़ें', exact: true }).click()
  await completeVitals(page, true)
  await expect(page.getByRole('button', { name: /Through text/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/आप अपनी परेशानी/)
  await page.getByRole('button', { name: 'लिखकर अपने शब्दों में बताएँ।' }).click()
  await page.getByLabel('अपनी परेशानी लिखें').fill('डेमो में सिर दर्द है')
  await page.getByRole('button', { name: 'जानकारी देखें' }).click()
  await page.getByRole('button', { name: 'पुष्टि करें और पंजीकरण करें' }).click()
  await expect(page.getByRole('heading', { name: 'आपका टोकन' })).toBeVisible()
  expect(payload.registration_type).toBe('MANUAL')
  expect(payload.vitals).toEqual({
    temperature_c: { value: 37, status: 'RECORDED' },
    spo2: { value: 98, status: 'RECORDED' },
    pr: { value: 82, status: 'RECORDED' },
  })
  expect(payload.language).toBe('hi-IN')
  expect(JSON.stringify(payload)).not.toContain('ABHA')
  expect(requests.join('\n')).not.toContain('DEMO-NOT-A-REAL-ABHA')
})

test('voice final words, edits and checkbox choices survive method changes and review', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Recognition {
      lang = ''
      onresult: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {}
      stop() {
        setTimeout(() => {
          this.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: 'Original spoken demo concern' } }],
          })
          this.onend?.()
        }, 60)
      }
      abort() {
        this.onend?.()
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: Recognition, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: Recognition,
      configurable: true,
    })
  })
  let payload: Record<string, unknown> = {}
  await page.route('**/api/v1/staff/encounters', async (route) => {
    payload = route.request().postDataJSON()
    await route.fulfill({
      json: { token: 998, urgent_alert: false, priority: 'SOON', ai_status: 'COMPLETE' },
    })
  })
  await page.goto('/intake')
  await page.getByRole('button', { name: 'English Continue in English' }).click()
  await page.getByLabel('Demo name').fill('Voice demo')
  await page.getByLabel('Age in years').fill('29')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await completeVitals(page)
  await page.getByRole('button', { name: /Through voice/ }).click()
  await page.getByRole('button', { name: 'Speak your symptoms' }).click()
  await expect(page.getByRole('button', { name: 'Review details' })).toBeDisabled()
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByLabel('Your words — check or edit')).toHaveValue(
    'Original spoken demo concern',
  )
  await page.getByLabel('Your words — check or edit').fill('Edited voice description')
  await page.getByRole('button', { name: 'Change input method' }).click()
  await page.getByRole('button', { name: /Through text/ }).click()
  await expect(page.getByLabel('Describe your symptoms')).toHaveValue('Edited voice description')
  await page.getByRole('button', { name: 'Change input method' }).click()
  await page.getByRole('button', { name: /Through checkboxes/ }).click()
  await page.getByRole('checkbox', { name: '1. Breathing, chest & allergy', exact: true }).check()
  await page
    .getByRole('checkbox', { name: 'New chest pain, pressure, tightness or heaviness.' })
    .check()
  await page.getByRole('button', { name: 'Review details' }).click()
  await expect(page.getByLabel('Confirm or correct your symptom description')).toHaveValue(
    'Edited voice description',
  )
  await page.getByLabel('Confirm or correct your symptom description').fill('Review correction')
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  await expect(page.getByRole('heading', { name: 'Your token' })).toBeVisible()
  expect(payload.input_methods).toEqual(['TEXT', 'VOICE', 'CHECKBOX'])
  expect(payload.original_text).toBe(
    'Original speech transcript:\nOriginal spoken demo concern\nTyped/edited intake:\nEdited voice description',
  )
  expect(payload.confirmed_text).toBe('Review correction')
  expect((payload.symptoms as string[]).length).toBe(1)
})

test('mobile and reduced-motion flow stays readable and can keep automatic audio off', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const NativeAudio = window.Audio
    window.Audio = function (src?: string) {
      const audio = new NativeAudio(src)
      audio.dataset.testid = 'instruction-audio'
      document.body.appendChild(audio)
      return audio
    } as typeof Audio
  })
  await page.goto('/intake')
  await page
    .getByRole('checkbox', { name: 'अपने आप आवाज़ न चलाएँ / Keep automatic voice off' })
    .check()
  for (const word of await page.locator('.prompt-word').all())
    await expect(word).toHaveCSS('opacity', '1')
  await accessible(page)
  await page.screenshot({ path: 'test-results/intake-language-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'English Continue in English' }).click()
  await page.getByLabel('Demo name').fill('Mobile demo')
  await page.getByLabel('Age in years').fill('31')
  await accessible(page)
  await page.screenshot({ path: 'test-results/intake-details-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await completeVitals(page)
  await expect(page.getByRole('checkbox', { name: 'Keep automatic voice off' })).toBeChecked()
  await expect(page.getByRole('status')).toContainText('replay')
  const audioCount = await page.getByTestId('instruction-audio').count()
  await accessible(page)
  expect(await page.getByTestId('instruction-audio').count()).toBe(audioCount)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: 'test-results/intake-method-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Change language' }).click()
  await page.getByRole('button', { name: 'हिन्दी हिन्दी में आगे बढ़ें' }).click()
  await expect(page.getByLabel('काल्पनिक नाम')).toHaveValue('Mobile demo')
})
