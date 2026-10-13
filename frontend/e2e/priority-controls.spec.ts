import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function login(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Fill credentials' }).click()
  await page.getByRole('button', { name: 'Open staff workspace' }).click()
  await expect(page.getByLabel('Show priority')).toHaveValue('IMMEDIATE')
}

test('dashboard displays one selected priority and keeps the original queue', async ({ page }) => {
  await login(page)
  await expect(page.locator('.priority-column')).toHaveCount(1)
  await expect(page.locator('.priority-column')).toHaveClass(/immediate/)
  const counts = (await (await page.request.get('/api/v1/dashboard')).json()).counts
  for (const priority of ['SOON', 'ROUTINE', 'IMMEDIATE']) {
    await page.getByLabel('Show priority').selectOption(priority)
    await expect(page.locator('.priority-column')).toHaveClass(new RegExp(priority.toLowerCase()))
    await expect(page.locator('.patient-card')).toHaveCount(counts[priority])
    await expect(page.getByRole('heading', { name: 'Original Queue' })).toBeVisible()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('reason and one or multiple measurements in the priority box enable an audited override', async ({
  page,
}) => {
  await login(page)
  const name = 'Synthetic override controls ' + crypto.randomUUID()
  const receipt = await (
    await page.request.post('/api/v1/encounters', {
      data: {
        request_id: crypto.randomUUID(),
        name,
        age_years: 38,
        original_text: 'New chest pain',
        confirmed_text: 'New chest pain',
      },
    })
  ).json()
  await page.reload()
  await page.getByLabel('Search patients').fill(name)
  await page.getByRole('button', { name: `Open token ${receipt.token}, ${name}` }).click()
  const box = page.locator('.override-panel')
  const apply = box.getByRole('button', { name: 'Apply staff override' })
  await box.getByLabel('New priority').selectOption('ROUTINE')
  await box
    .getByLabel('Reason for changing priority')
    .fill('Scripted intake error clarified by staff')
  await expect(apply).toBeDisabled()
  await box.getByLabel('Type of measurement 1').selectOption('pr')
  await expect(apply).toBeDisabled()
  await box.getByLabel('Value of measurement 1').selectOption('82')
  await expect(apply).toBeEnabled()
  await box.getByRole('button', { name: 'Add measurement' }).click()
  await box.getByLabel('Type of measurement 2').selectOption('temperature_c')
  await expect(apply).toBeDisabled()
  await box.getByLabel('Value of measurement 2').selectOption('CUSTOM')
  await box.getByLabel('Numeric reading 2').fill('36.8')
  await expect(apply).toBeEnabled()
  await box.getByLabel('Reason for changing priority').fill('   ')
  await expect(apply).toBeDisabled()
  await box
    .getByLabel('Reason for changing priority')
    .fill('Scripted intake error clarified by staff; new readings documented')
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([])
  await page.screenshot({ path: 'test-results/priority-override-controls.png', fullPage: true })
  await apply.click()
  await expect(page.getByRole('status', { name: 'Staff action result' })).toContainText(
    'Staff priority applied',
  )
  await expect(page.locator('.detail-heading')).toContainText('Routine')
  await expect(page.locator('.detail-heading')).toContainText(`#${receipt.token}`)
  const patient = (await (await page.request.get('/api/v1/dashboard')).json()).original_queue.find(
    (p: any) => p.token === receipt.token,
  )
  expect(patient.vitals.pr.value).toBe(82)
  expect(patient.vitals.temperature_c.value).toBe(36.8)
  expect(patient.original_text).toBe('New chest pain')
  expect(patient.assessment.red_flags.length).toBeGreaterThan(0)
  const audit = await (await page.request.get(`/api/v1/encounters/${patient.id}/audit`)).json()
  expect(
    audit.some((e: any) => e.type === 'OVERRIDE' && e.actor === 'nurse' && e.payload.vital_id),
  ).toBeTruthy()
  await expect(apply).toBeDisabled()
  await page.getByRole('button', { name: 'Back to dashboard' }).click()
  await expect(page.locator('.patient-card').filter({ hasText: name })).toHaveCount(0)
  await page.getByLabel('Show priority').selectOption('ROUTINE')
  await expect(page.locator('.patient-card').filter({ hasText: name })).toBeVisible()
})
