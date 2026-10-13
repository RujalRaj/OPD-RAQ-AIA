import { enterRequiredVitals, signInAtVitals } from './registration-helpers'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function login(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Fill credentials' }).click()
  await page.getByRole('button', { name: 'Open staff workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Original Queue' })).toBeVisible()
}

async function findPatient(page: Page, token: number) {
  const result = await page.request.get('/api/v1/dashboard')
  expect(result.ok()).toBeTruthy()
  return (await result.json()).original_queue.find((p: { token: number }) => p.token === token)
}

async function createPatient(page: Page) {
  const name = 'Synthetic quick vitals ' + crypto.randomUUID()
  const response = await page.request.post('/api/v1/encounters', {
    data: {
      request_id: crypto.randomUUID(),
      name,
      age_years: 40,
      original_text: 'New chest pain',
      confirmed_text: 'New chest pain',
    },
  })
  expect(response.ok()).toBeTruthy()
  const receipt = await response.json()
  return findPatient(page, receipt.token)
}

async function reachVitals(page: Page, hi = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/intake')
  await page
    .getByRole('button', {
      name: hi ? 'हिन्दी हिन्दी में आगे बढ़ें' : 'English Continue in English',
    })
    .click()
  const name = 'Synthetic registration vitals ' + crypto.randomUUID()
  await page.getByLabel(hi ? 'काल्पनिक नाम' : 'Demo name').fill(name)
  await page.getByLabel(hi ? 'उम्र (वर्ष)' : 'Age in years').fill('40')
  await page.getByRole('button', { name: hi ? 'आगे बढ़ें' : 'Next', exact: true }).click()
  await expect(page.locator('.registration-vitals-step')).toBeVisible()
  return name
}

async function symptomsAndReview(page: Page, hi = false) {
  await page
    .getByRole('button', { name: hi ? 'लक्षणों के लिए आगे बढ़ें' : 'Continue to symptoms' })
    .click()
  await page.getByRole('button', { name: hi ? /लिखकर अपने शब्दों/ : /Through text/ }).click()
  await page.getByLabel(hi ? 'अपनी परेशानी लिखें' : 'Describe your symptoms').fill('New chest pain')
  await page.getByRole('button', { name: hi ? 'जानकारी देखें' : 'Review details' }).click()
}

for (const hi of [false, true]) {
  test(`staff registration: details → mandatory vitals → symptoms → review → token (${hi ? 'Hindi' : 'English'})`, async ({
    page,
  }) => {
    if (hi) await login(page)
    const registrations: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/encounters')) registrations.push(r.url())
    })
    const name = await reachVitals(page, hi)
    expect(registrations).toHaveLength(0)
    await expect(page.locator('.receipt-token')).toHaveCount(0)
    const next = page.getByRole('button', {
      name: hi ? 'लक्षणों के लिए आगे बढ़ें' : 'Continue to symptoms',
    })
    await expect(next).toBeDisabled()
    await enterRequiredVitals(page, hi)
    await page.locator('#registration-vital-status-rbs').selectOption('UNABLE_TO_OBTAIN')
    await page
      .getByRole('checkbox', {
        name: hi ? 'डॉक्टर की समीक्षा का अनुरोध करें' : 'Request doctor review',
      })
      .check()
    await expect(next).toBeDisabled()
    await page
      .getByLabel(hi ? 'डॉक्टर की समीक्षा का कारण' : 'Reason for doctor review')
      .fill('Need doctor assessment of this synthetic case')
    await page.getByRole('button', { name: hi ? 'वापस' : 'Back', exact: true }).click()
    await expect(page.getByLabel(hi ? 'काल्पनिक नाम' : 'Demo name')).toHaveValue(name)
    await page.getByRole('button', { name: hi ? 'आगे बढ़ें' : 'Next', exact: true }).click()
    await expect(page.locator('#registration-vital-pr')).toHaveValue('82')
    const ids = await page.locator('.vital-entry input').evaluateAll((els) => els.map((e) => e.id))
    expect(ids.slice(0, 3)).toEqual([
      'registration-vital-temperature_c',
      'registration-vital-spo2',
      'registration-vital-pr',
    ])
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([])
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy()
    await page.screenshot({
      path: `test-results/staff-vitals-${hi ? 'hi' : 'en'}.png`,
      fullPage: true,
    })
    await symptomsAndReview(page, hi)
    expect(registrations).toHaveLength(0)
    await page
      .getByRole('button', { name: hi ? 'पुष्टि करें और पंजीकरण करें' : 'Confirm & register' })
      .click()
    await expect(page.locator('.receipt-token')).toBeVisible()
    await expect(page.locator('.receipt')).toHaveClass(/receipt-immediate/)
    expect(registrations).toHaveLength(1)
    const token = Number(await page.locator('.receipt-token').innerText())
    const saved = await findPatient(page, token)
    expect(saved.name).toBe(name)
    expect(saved.original_text).toBe('New chest pain')
    expect(saved.priority).toBe('IMMEDIATE')
    expect(saved.unresolved).toBe(true)
    expect(saved.override_active).toBe(false)
    expect(saved.vitals.pr).toMatchObject({ status: 'RECORDED', value: 82, recorded_by: 'nurse' })
    expect(saved.vitals.rbs).toMatchObject({ status: 'UNABLE_TO_OBTAIN', value: null })
    await page.goto('/')
    await page.getByLabel('Search patients').fill(name)
    await page.getByRole('button', { name: `Open doctor review for token ${token}` }).click()
    await expect(page.getByLabel('Reason for doctor review')).toBeFocused()
    await page.getByLabel('Reason for changing priority').fill('Synthetic workflow test')
    await expect(page.getByRole('button', { name: 'Apply staff override' })).toBeDisabled()
  })

  test(`staff emergency accepts qualitative Temperature/Pulse and numeric SpO₂ (${hi ? 'Hindi' : 'English'})`, async ({
    page,
  }) => {
    await reachVitals(page, hi)
    const emergency = page.locator('[data-emergency="true"]')
    await expect(emergency).toBeDisabled()
    await signInAtVitals(page, hi)
    await page.locator('#registration-vital-status-temperature_c').selectOption('HIGH')
    await page.locator('#registration-vital-status-pr').selectOption('LOW')
    await expect(page.locator('#registration-vital-temperature_c')).toBeDisabled()
    await expect(page.locator('#registration-vital-pr')).toBeDisabled()
    await expect(emergency).toBeDisabled()
    await page.locator('#registration-vital-spo2').fill('98')
    await expect(emergency).toBeEnabled()
    await emergency.click()
    await expect(page.locator('.receipt')).toHaveClass(/receipt-immediate/)
    await expect(page.locator('.receipt-priority')).toHaveText(
      hi ? 'प्राथमिकता: तुरंत' : 'Priority: Immediate',
    )
    await expect(page.locator('.receipt-token')).toHaveCSS('color', 'rgb(162, 50, 50)')
    const token = Number(await page.locator('.receipt-token').innerText())
    const p = await findPatient(page, token)
    expect(p.priority).toBe('IMMEDIATE')
    expect(p.override_active).toBe(true)
    expect(p.original_text).toBe('')
    expect(p.input.input_methods).toEqual([])
    expect(p.vitals.temperature_c).toMatchObject({ status: 'HIGH', value: null })
    expect(p.vitals.pr).toMatchObject({ status: 'LOW', value: null })
    expect(p.assessment.ai_status).toBe('SKIPPED_OVERRIDE')
    const log = await (await page.request.get(`/api/v1/encounters/${p.id}/audit`)).json()
    expect(
      log.some(
        (e: { type: string; actor: string }) =>
          e.type === 'STAFF_ASSESSED_EMERGENCY' && e.actor === 'nurse',
      ),
    ).toBeTruthy()
    await page.screenshot({
      path: `test-results/staff-emergency-${hi ? 'hi' : 'en'}.png`,
      fullPage: true,
    })
    await page.goto('/')
    await page.getByLabel('Search patients').fill(p.name)
    await expect(page.locator('.patient-card').filter({ hasText: p.name })).toContainText(
      'Staff assessed emergency at registration',
    )
    await page.getByRole('button', { name: `Open token ${token}, ${p.name}` }).click()
    await expect(page.getByText('High — staff observation', { exact: true })).toBeVisible()
    await expect(page.getByText('Low — staff observation', { exact: true })).toBeVisible()
  })
}

test('mandatory vital menus exclude missing statuses; changing an observation to numeric requires a reading', async ({
  page,
}) => {
  await reachVitals(page)
  await signInAtVitals(page)
  const next = page.getByRole('button', { name: 'Continue to symptoms' })
  for (const key of ['temperature_c', 'spo2', 'pr']) {
    const select = page.locator(`#registration-vital-status-${key}`)
    const options = await select
      .locator('option')
      .evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value))
    expect(options).toEqual(key === 'spo2' ? ['RECORDED'] : ['RECORDED', 'HIGH', 'LOW'])
  }
  await expect(
    page.locator('#registration-vital-status-sbp option[value="UNABLE_TO_OBTAIN"]'),
  ).toHaveCount(1)
  await page.locator('#registration-vital-status-temperature_c').selectOption('LOW')
  await page.locator('#registration-vital-status-pr').selectOption('HIGH')
  await page.locator('#registration-vital-spo2').fill('101')
  await expect(next).toBeDisabled()
  await page.locator('#registration-vital-spo2').fill('98')
  await expect(next).toBeEnabled()
  await page.locator('#registration-vital-status-pr').selectOption('RECORDED')
  await expect(next).toBeDisabled()
  await expect(page.locator('#registration-vital-pr')).toHaveValue('')
  await page.locator('#registration-vital-pr').fill('82')
  await expect(next).toBeEnabled()
  await next.click()
  await page.getByRole('button', { name: /Through text/ }).click()
  await page.getByLabel('Describe your symptoms').fill('Synthetic concern')
  await page.getByRole('button', { name: 'Review details' }).click()
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  await expect(page.locator('.receipt')).toHaveClass(/receipt-standard/)
  await expect(page.locator('.receipt-priority')).toHaveText('Priority: Soon')
  await expect(page.locator('.receipt-token')).toHaveCSS('color', 'rgb(33, 98, 65)')
})

test('dashboard doctor review shortcut requires a reason but no measurement', async ({ page }) => {
  await login(page)
  const p = await createPatient(page)
  await page.reload()
  await page.getByLabel('Search patients').fill(p.name)
  await page.getByRole('button', { name: `Request doctor review for token ${p.token}` }).click()
  const reason = page.getByLabel('Reason for doctor review')
  await expect(reason).toBeFocused()
  await expect(
    page.getByRole('button', { name: 'Request doctor review', exact: true }),
  ).toBeDisabled()
  await reason.fill('Cannot assess this synthetic concern')
  await page.getByRole('button', { name: 'Request doctor review', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Staff action result' })).toContainText(
    'Doctor review requested',
  )
  const saved = await findPatient(page, p.token)
  expect(saved.unresolved).toBe(true)
  expect(saved.priority).toBe(p.priority)
  expect(saved.vitals).toEqual(p.vitals)
})

test('dashboard quick entry preserves staff override and handles stale records without losing drafts', async ({
  page,
}) => {
  await login(page)
  let p = await createPatient(page)
  const endpoint = `/api/v1/encounters/${p.id}`
  const override = await page.request.post(endpoint + '/override', {
    data: {
      version: p.version,
      priority: 'ROUTINE',
      reason: 'Invented workflow demonstration only',
      vitals: { pr: { value: 82 } },
    },
  })
  expect(override.ok()).toBeTruthy()
  p = await override.json()
  await page.reload()
  await page.getByLabel('Show priority').selectOption('ROUTINE')
  await page.getByLabel('Search patients').fill(p.name)
  const shortcut = page.getByRole('button', {
    name: `Record available vitals for token ${p.token}`,
  })
  await shortcut.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Saving measurements preserves that decision')
  await expect(dialog.getByLabel('Pulse beats/min')).toHaveValue('')
  await expect(dialog).toContainText('Saved: 82 beats/min')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(shortcut).toBeFocused()
  await shortcut.click()
  await dialog.getByLabel('Temperature °C').fill('36.7')
  const concurrent = await page.request.post(endpoint + '/vitals', {
    data: {
      version: p.version,
      vitals: { rr: { value: 17 } },
    },
  })
  expect(concurrent.ok()).toBeTruthy()
  await dialog.getByRole('button', { name: 'Save & reassess' }).click()
  await expect(dialog.locator('.error')).toBeVisible()
  await expect(dialog.getByLabel('Temperature °C')).toHaveValue('36.7')
  await dialog.getByRole('button', { name: 'Reload saved readings' }).click()
  await expect(dialog.getByRole('status')).toContainText('unsaved entries remain')
  await expect(dialog).toContainText('Saved: 17 breaths/min')
  await dialog.getByRole('button', { name: 'Save & reassess' }).click()
  await expect(dialog).toHaveCount(0)
  p = await (await page.request.get(endpoint)).json()
  expect(p.priority).toBe('ROUTINE')
  expect(p.override_active).toBe(true)
  expect(p.vitals.rr.value).toBe(17)
  expect(p.vitals.pr.value).toBe(82)
  expect(p.vitals.temperature_c.value).toBe(36.7)
  await expect(page.locator('.patient-card').filter({ hasText: p.name })).toContainText(
    'Safety alert retained',
  )
  await page.screenshot({ path: 'test-results/vitals-dashboard.png', fullPage: true })
})

test('complete readings clear the reminder and missing filter; queue view offers the same shortcut', async ({
  page,
}) => {
  await login(page)
  let p = await createPatient(page)
  const values = { temperature_c: 36.7, pr: 82, sbp: 120, dbp: 80, spo2: 98, rr: 17, rbs: 100 }
  const saved = await page.request.post(`/api/v1/encounters/${p.id}/vitals`, {
    data: {
      version: p.version,
      vitals: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, { value, status: 'RECORDED' }]),
      ),
    },
  })
  expect(saved.ok()).toBeTruthy()
  p = await saved.json()
  await page.reload()
  await page.getByLabel('Search patients').fill(p.name)
  const card = page.locator('.patient-card').filter({ hasText: p.name })
  await expect(card).toContainText('All measurement fields have recorded values')
  await expect(card.locator('.missing-vitals')).toHaveCount(0)
  await page.getByLabel('Filter patients').selectOption('MISSING')
  await expect(card).toHaveCount(0)
  await page.getByRole('button', { name: 'Queue', exact: true }).click()
  await page.getByLabel('Search patients').fill(p.name)
  await page.getByRole('button', { name: `Record available vitals for token ${p.token}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('All measurement fields have recorded values')
  await expect(dialog.getByRole('button', { name: 'Save & reassess' })).toBeDisabled()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: 'test-results/quick-vitals-desktop.png', fullPage: true })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await (await page.request.get(`/api/v1/encounters/${p.id}`)).json()).version).toBe(
    p.version,
  )
})

for (const emergency of [false, true]) {
  test(`interrupted ${emergency ? 'emergency' : 'regular'} registration recovers the same token`, async ({
    page,
  }) => {
    const name = await reachVitals(page)
    await enterRequiredVitals(page)
    if (!emergency) await symptomsAndReview(page)
    let first = true
    let savedToken = 0
    await page.route('**/api/v1/staff/encounters', async (route) => {
      if (!first) return route.continue()
      first = false
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      savedToken = (await response.json()).token
      await route.abort('failed')
    })
    if (emergency) await page.locator('[data-emergency="true"]').click()
    else await page.getByRole('button', { name: 'Confirm & register' }).click()
    const retry = page.getByRole('button', {
      name: emergency ? 'Retry emergency registration' : 'Retry registration',
    })
    await expect(retry).toBeVisible()
    if (emergency) await expect(page.locator('#registration-vital-pr')).toBeDisabled()
    else await expect(page.getByLabel('Confirm or correct your symptom description')).toBeDisabled()
    await retry.click()
    await expect(page.locator('.receipt-token')).toHaveText(String(savedToken))
    const rows = (await (await page.request.get('/api/v1/dashboard')).json()).original_queue
    expect(rows.filter((p: { name: string }) => p.name === name)).toHaveLength(1)
  })
}

test('a mocked completed Routine receipt uses green token and priority text', async ({ page }) => {
  await reachVitals(page)
  await enterRequiredVitals(page)
  await page.getByRole('button', { name: 'Continue to symptoms' }).click()
  await page.getByRole('button', { name: /Through text/ }).click()
  await page.getByLabel('Describe your symptoms').fill('Synthetic scheduled follow-up')
  await page.getByRole('button', { name: 'Review details' }).click()
  await page.route('**/api/v1/staff/encounters', (route) =>
    route.fulfill({
      json: {
        token: 98764,
        priority: 'ROUTINE',
        ai_status: 'COMPLETE',
        urgent_alert: false,
        needs_staff_review: false,
      },
    }),
  )
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  await expect(page.locator('.receipt-priority')).toHaveText('Priority: Routine')
  await expect(page.locator('.receipt-priority')).toHaveCSS('color', 'rgb(33, 98, 65)')
  await expect(page.locator('.receipt-token')).toHaveCSS('color', 'rgb(33, 98, 65)')
})

test('expired sign-in returns to vitals and preserves corrections on Review', async ({ page }) => {
  await reachVitals(page)
  await enterRequiredVitals(page)
  await symptomsAndReview(page)
  await page
    .getByLabel('Confirm or correct your symptom description')
    .fill('Staff confirmed synthetic wording')
  let expired = true
  await page.route('**/api/v1/staff/encounters', async (route) => {
    if (!expired) return route.continue()
    expired = false
    await route.fulfill({ status: 401, json: { detail: 'Staff sign-in expired' } })
  })
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  await expect(page.locator('#intake-staff-role')).toBeVisible()
  await signInAtVitals(page)
  await expect(page.locator('#registration-vital-pr')).toHaveValue('82')
  await page.getByRole('button', { name: 'Continue to symptoms' }).click()
  await expect(page.getByLabel('Confirm or correct your symptom description')).toHaveValue(
    'Staff confirmed synthetic wording',
  )
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  await expect(page.locator('.receipt-token')).toBeVisible()
  const token = Number(await page.locator('.receipt-token').innerText())
  const p = await findPatient(page, token)
  expect(p.original_text).toBe('New chest pain')
  expect(p.confirmed_text).toBe('Staff confirmed synthetic wording')
})
