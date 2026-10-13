import { completeVitals } from './registration-helpers'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('patient intake → nurse override → unresolved → doctor resolution', async ({
  page,
  browser,
}) => {
  await page.goto('/intake')
  await page.getByRole('button', { name: 'English Continue in English' }).click()
  const name = 'E2E Demo ' + Date.now()
  await page.getByRole('textbox', { name: 'Demo name' }).fill(name)
  await page.getByRole('spinbutton', { name: 'Age in years' }).fill('42')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await completeVitals(page)
  await page.getByRole('button', { name: /Through text/ }).click()
  await page
    .getByRole('textbox', { name: 'Describe your symptoms' })
    .fill('Original patient wording')
  await page.getByRole('button', { name: 'Change input method' }).click()
  await page.getByRole('button', { name: /Through checkboxes/ }).click()
  await page.getByRole('checkbox', { name: '1. Breathing, chest & allergy', exact: true }).check()
  await page
    .getByRole('checkbox', { name: 'New chest pain, pressure, tightness or heaviness.' })
    .check()
  await page.getByRole('button', { name: 'Review details' }).click()
  await page
    .getByRole('textbox', { name: 'Confirm or correct your symptom description' })
    .fill('Corrected patient wording')
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  await expect(page.getByRole('heading', { name: 'Your token' })).toBeVisible()
  const token = await page.locator('.receipt-token').innerText()
  await expect(page.getByRole('alert')).toContainText('immediately')
  await page.getByRole('button', { name: 'Staff area' }).click()
  await page.getByRole('textbox', { name: 'Search patients' }).fill(name)
  await page.getByRole('button', { name: `Open token ${token}, ${name}` }).click()
  await expect(page.getByText('Original patient wording', { exact: true })).toBeVisible()
  const detailAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    detailAccessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
  await expect(page.getByRole('button', { name: 'Apply staff override' })).toBeDisabled()
  await page
    .getByRole('textbox', { name: 'Reason for changing priority' })
    .fill('Synthetic staff observation supports different priority')
  await expect(page.getByRole('button', { name: 'Apply staff override' })).toBeDisabled()
  await page.getByLabel('Type of measurement 1').selectOption('pr')
  await page.getByLabel('Value of measurement 1').selectOption('82')
  await page.getByLabel('New priority', { exact: true }).selectOption('ROUTINE')
  await page.getByRole('button', { name: 'Apply staff override' }).click()
  await expect(page.getByRole('status', { name: 'Staff action result' })).toContainText(
    'Staff priority applied',
  )
  await expect(page.locator('.detail-heading')).toContainText('Routine')
  await expect(page.locator('.detail-heading')).toContainText(`#${token}`)
  await page
    .getByRole('textbox', { name: 'Reason for doctor review' })
    .fill('Need confirmation of this demonstration case')
  await page.getByRole('button', { name: 'Request doctor review' }).click()
  await expect(
    page.getByText('Unresolved · Doctor review requested', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resolve review' })).toHaveCount(0)
  const doctor = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await doctor.goto('http://127.0.0.1:5174/')
  await doctor.getByLabel('Demo staff role').selectOption('doctor')
  await doctor.getByLabel('Password', { exact: true }).fill('DemoOnly!2026')
  await doctor.getByRole('button', { name: 'Open staff workspace' }).click()
  await doctor.getByLabel('Show priority').selectOption('ROUTINE')
  await doctor.getByRole('textbox', { name: 'Search patients' }).fill(name)
  await doctor.getByRole('button', { name: `Open token ${token}, ${name}` }).click()
  await doctor
    .getByRole('textbox', { name: 'Doctor’s review note' })
    .fill('Doctor reviewed the synthetic case')
  await doctor.getByRole('button', { name: 'Resolve review' }).click()
  await expect(doctor.getByRole('status', { name: 'Staff action result' })).toContainText(
    'Doctor review resolved',
  )
  await expect(
    doctor.getByText('Unresolved · Doctor review requested', { exact: true }),
  ).toHaveCount(0)
  await doctor.close()
})

test('staff dashboard is accessible and priorities share fixed tokens', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Password', { exact: true }).fill('DemoOnly!2026')
  await page.getByRole('button', { name: 'Open staff workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Original Queue' })).toBeVisible()
  await expect(page.locator('.priority-column')).toHaveCount(1)
  await expect(page.getByLabel('Show priority')).toHaveValue('IMMEDIATE')
  await expect(page.locator('.patient-card').first()).toBeVisible()
  const card = page.locator('.patient-card').first()
  const cardBounds = await card.boundingBox()
  const reasonBounds = await card.locator('.card-reason').boundingBox()
  expect(
    cardBounds &&
      reasonBounds &&
      reasonBounds.y + reasonBounds.height <= cardBounds.y + cardBounds.height,
  ).toBeTruthy()
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true })
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
})

test('patient form works with unsupported microphone and keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true })
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      configurable: true,
    })
  })
  await page.goto('/intake')
  await page.getByRole('button', { name: 'English Continue in English' }).click()
  await page.getByLabel('Demo name').focus()
  await page.keyboard.type('Keyboard demo')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('spinbutton', { name: 'Age in years' })).toBeFocused()
  await page.getByLabel('Age in years').fill('38')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await completeVitals(page)
  await page.getByRole('button', { name: /Through voice/ }).click()
  await page.getByRole('button', { name: 'Speak your symptoms' }).click()
  await expect(page.getByRole('status')).toContainText('unavailable')
  await page.getByLabel('Your words — check or edit').fill('Typed fallback')
  await page.screenshot({ path: 'test-results/patient-form.png', fullPage: true })
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
})
