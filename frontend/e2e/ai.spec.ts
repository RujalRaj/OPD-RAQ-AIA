import { completeVitals } from './registration-helpers'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const hi of [false, true]) {
  test(`registration receives a delayed AI Immediate alert (${hi ? 'Hindi' : 'English'})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let requestId = ''
    let polls = 0
    const receipt = {
      token: 98765,
      demo_id: 'DEMO-98765',
      registered: true,
      urgent_alert: false,
      ai_status: 'PENDING',
      priority: 'SOON',
      needs_staff_review: true,
    }
    await page.route('**/api/v1/staff/encounters', async (route) => {
      requestId = route.request().postDataJSON().request_id
      await route.fulfill({ json: receipt })
    })
    await page.route('**/api/v1/registration-status', async (route) => {
      expect(route.request().postDataJSON()).toEqual({ request_id: requestId })
      polls++
      await route.fulfill({
        json:
          polls < 2
            ? receipt
            : { ...receipt, ai_status: 'COMPLETE', urgent_alert: true, priority: 'IMMEDIATE' },
      })
    })
    await page.goto('/intake')
    await page
      .getByRole('button', {
        name: hi ? 'हिन्दी हिन्दी में आगे बढ़ें' : 'English Continue in English',
      })
      .click()
    await page
      .getByLabel(hi ? 'काल्पनिक नाम' : 'Demo name')
      .fill(hi ? 'काल्पनिक उदाहरण' : 'Synthetic example')
    await page.getByLabel(hi ? 'उम्र (वर्ष)' : 'Age in years').fill('40')
    await page.getByRole('button', { name: hi ? 'आगे बढ़ें' : 'Next', exact: true }).click()
    await completeVitals(page, hi)
    await page
      .getByRole('button', { name: hi ? 'लिखकर अपने शब्दों में बताएँ।' : /Through text/ })
      .click()
    await page
      .getByLabel(hi ? 'अपनी परेशानी लिखें' : 'Describe your symptoms')
      .fill(hi ? 'काल्पनिक परेशानी' : 'Synthetic complaint')
    await page.getByRole('button', { name: hi ? 'जानकारी देखें' : 'Review details' }).click()
    await page
      .getByRole('button', { name: hi ? 'पुष्टि करें और पंजीकरण करें' : 'Confirm & register' })
      .click()
    await expect(page.locator('.receipt-token')).toHaveText('98765')
    await expect(page.getByRole('status')).toContainText(
      hi ? 'समीक्षा हो रही है' : 'being prepared',
    )
    await expect(page.locator('.receipt')).toHaveClass(/receipt-pending/)
    await expect(page.getByRole('alert')).toContainText(hi ? 'तुरंत नर्स' : 'immediately')
    await expect(page.locator('.receipt-token')).toHaveText('98765')
    await expect(page.locator('.receipt')).toHaveClass(/receipt-immediate/)
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([])
    await page.screenshot({
      path: `test-results/ai-receipt-${hi ? 'hi' : 'en'}.png`,
      fullPage: true,
    })
  })
}

test('staff detail updates a pending model result and retains override controls', async ({
  page,
}) => {
  let detailCalls = 0
  await page.route('**/api/v1/dashboard', async (route) => {
    const real = await route.fetch()
    const data = await real.json()
    const p = data.original_queue[0]
    p.priority = 'SOON'
    p.assessment = {
      ...p.assessment,
      ai_status: 'PENDING',
      red_flags: [],
      suggested_priority: 'SOON',
    }
    await route.fulfill({
      json: {
        original_queue: [p],
        priority_order: [p.id],
        counts: { TOTAL: 1, SOON: 1, IMMEDIATE: 0, ROUTINE: 0, UNRESOLVED: 0 },
      },
    })
  })
  await page.route(/\/api\/v1\/encounters\/[^/]+$/, async (route) => {
    const real = await route.fetch()
    const p = await real.json()
    detailCalls++
    p.priority = detailCalls > 1 ? 'IMMEDIATE' : 'SOON'
    p.assessment = {
      ...p.assessment,
      red_flags: [],
      suggested_priority: p.priority,
      ai_status: detailCalls > 1 ? 'COMPLETE' : 'PENDING',
      ai_immediate: detailCalls > 1,
      ai_provider: 'groq',
      model_version: 'openai/gpt-oss-120b',
      source: 'AI_WITH_SAFETY_GATE',
      reason: 'AI suggests Immediate based on reported symptoms.',
      ai_proposal: { priority: 'IMMEDIATE', applied: true },
    }
    await route.fulfill({ json: p })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Fill credentials' }).click()
  await page.getByRole('button', { name: 'Open staff workspace' }).click()
  await page.getByLabel('Show priority').selectOption('SOON')
  await expect(
    page.getByText('AI assessment pending · provisional priority', { exact: true }),
  ).toBeVisible()
  await page.locator('.patient-card').first().click()
  await expect(page.locator('.detail-heading')).toContainText('Immediate')
  await expect(page.getByText('AI assessment complete', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Immediate staff assessment requested', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply staff override' })).toBeDisabled()
  await page.screenshot({ path: 'test-results/ai-staff-detail.png', fullPage: true })
})
