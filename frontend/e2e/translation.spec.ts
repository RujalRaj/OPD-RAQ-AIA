import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const language of ['hi-IN', 'en-IN']) {
  test(`doctor sees original and opposite-language translation: ${language}`, async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Demo staff role').selectOption('doctor')
    await page.getByRole('button', { name: 'Fill credentials' }).click()
    await page.getByRole('button', { name: 'Open staff workspace' }).click()
    await expect(page.getByLabel('Show priority')).toBeVisible()
    const name = 'Synthetic bilingual ' + crypto.randomUUID()
    const text = language === 'hi-IN' ? 'तेज़ दर्द' : 'Severe pain'
    const receipt = await (
      await page.request.post('/api/v1/encounters', {
        data: {
          request_id: crypto.randomUUID(),
          name,
          age_years: 35,
          language,
          original_text: text,
          confirmed_text: text,
          symptoms: ['rule_11'],
        },
      })
    ).json()
    await page.reload()
    await page.getByLabel('Search patients').fill(name)
    await page.getByRole('button', { name: `Open token ${receipt.token}, ${name}` }).click()
    const original = page.getByRole('region', { name: 'Original symptoms', exact: true })
    const translated = page.getByRole('region', { name: 'Translated symptoms', exact: true })
    await expect(original.getByRole('heading', { name: 'Original', exact: true })).toBeVisible()
    await expect(original.locator('blockquote')).toHaveText(text)
    await expect(translated.getByRole('heading')).toHaveText(
      `Translated in ${language === 'hi-IN' ? 'English' : 'Hindi'}`,
    )
    await expect(translated.locator('blockquote')).toHaveText(
      language === 'hi-IN' ? 'Severe pain' : 'तेज़ दर्द',
    )
    await expect(original.locator('li')).toHaveCount(1)
    await expect(translated.locator('li')).toHaveCount(1)
    await expect(page.locator('.detail-heading')).toContainText('Immediate')
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([])
    await page.screenshot({ path: `test-results/translation-${language}.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy()
  })
}
