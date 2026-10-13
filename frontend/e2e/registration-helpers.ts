import { expect, type Page } from '@playwright/test'

export async function signInAtVitals(page: Page, hi = false) {
  await expect(page.locator('.registration-vitals-step')).toBeVisible()
  if (await page.locator('#intake-staff-role').isVisible()) {
    await page
      .getByRole('button', { name: hi ? 'डेमो पासवर्ड भरें' : 'Fill credentials', exact: true })
      .click()
    await page
      .getByRole('button', { name: hi ? 'यहीं लॉगिन करें' : 'Sign in here', exact: true })
      .click()
  }
  await expect(page.locator('#registration-vital-temperature_c')).toBeVisible()
}

export async function enterRequiredVitals(page: Page, hi = false) {
  await signInAtVitals(page, hi)
  await page.locator('#registration-vital-temperature_c').fill('37')
  await page.locator('#registration-vital-spo2').fill('98')
  await page.locator('#registration-vital-pr').fill('82')
}

export async function completeVitals(page: Page, hi = false) {
  await enterRequiredVitals(page, hi)
  await page
    .getByRole('button', {
      name: hi ? 'लक्षणों के लिए आगे बढ़ें' : 'Continue to symptoms',
      exact: true,
    })
    .click()
}
