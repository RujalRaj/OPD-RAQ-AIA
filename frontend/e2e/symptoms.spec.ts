import { completeVitals } from './registration-helpers'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  )
}
async function start(page: Page, hi = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/intake')
  await page.getByRole('checkbox', { name: /Keep automatic voice off/ }).check()
  await page
    .getByRole('button', {
      name: hi ? 'हिन्दी हिन्दी में आगे बढ़ें' : 'English Continue in English',
    })
    .click()
  const name = 'Checkbox demo ' + crypto.randomUUID()
  await page.getByLabel(hi ? 'काल्पनिक नाम' : 'Demo name').fill(name)
  await page.getByLabel(hi ? 'उम्र (वर्ष)' : 'Age in years').fill('38')
  await page.getByRole('button', { name: hi ? 'आगे बढ़ें' : 'Next', exact: true }).click()
  await completeVitals(page, hi)
  await page.getByRole('button', { name: hi ? /विकल्प चुनकर/ : /Through checkboxes/ }).click()
  return name
}

test('eight expandable sections submit only selected reports and preserve them through closing and method changes', async ({
  page,
}) => {
  const name = await start(page)
  const picker = page.locator('.symptom-picker')
  await expect(picker.getByRole('checkbox')).toHaveCount(8)
  await expect(picker.getByRole('button', { name: 'More problems' })).toHaveCount(0)
  await expect(picker.getByRole('checkbox', { name: 'Fever', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review details' })).toBeDisabled()
  await accessible(page)
  await page.screenshot({
    path: 'test-results/checkbox-eight-sections-desktop.png',
    fullPage: true,
  })
  const chest = picker.getByRole('checkbox', { name: '1. Breathing, chest & allergy', exact: true })
  await chest.focus()
  await page.keyboard.press('Space')
  await expect(picker.getByRole('checkbox')).toHaveCount(14)
  await expect(picker.getByRole('status')).toHaveText('Selected symptoms · 0')
  await expect(page.getByRole('button', { name: 'Review details' })).toBeDisabled()
  const chestLabel = 'New chest pain, pressure, tightness or heaviness.'
  await picker.getByRole('checkbox', { name: chestLabel, exact: true }).check()
  await chest.uncheck()
  await expect(picker.getByRole('checkbox')).toHaveCount(8)
  await expect(picker.getByRole('status')).toHaveText('Selected symptoms · 1')
  await expect(page.locator('.symptom-section').first()).toContainText('1 selected')
  await chest.check()
  await expect(picker.getByRole('checkbox', { name: chestLabel, exact: true })).toBeChecked()
  await chest.uncheck()
  await picker.getByRole('checkbox', { name: '7. Pregnancy & after delivery', exact: true }).check()
  const movement = 'The baby moving less than usual or stopping moving in the womb.'
  await picker.getByRole('checkbox', { name: movement, exact: true }).check()
  await accessible(page)
  await page.getByRole('button', { name: 'Change input method' }).click()
  await page.getByRole('button', { name: /Through text/ }).click()
  await page.getByLabel('Describe your symptoms').fill('Original synthetic wording')
  await page.getByRole('button', { name: 'Change input method' }).click()
  await page.getByRole('button', { name: /Through checkboxes/ }).click()
  await expect(picker.getByRole('status')).toHaveText('Selected symptoms · 2')
  await expect(picker.getByRole('checkbox')).toHaveCount(8)
  await page.getByRole('button', { name: 'Review details', exact: true }).click()
  await expect(page.getByText(chestLabel, { exact: false }).last()).toBeVisible()
  await expect(page.locator('.intake-form')).toContainText('Pregnancy & after delivery')
  expect(
    await page.locator('.intake-form').evaluate((form) => {
      const choices = form.querySelector('ul')!
      const text = form.querySelector('textarea')!
      return Boolean(choices.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING)
    }),
  ).toBe(true)
  const sent = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/staff/encounters') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Confirm & register' }).click()
  const response = await sent
  expect(response.status()).toBe(201)
  expect(response.request().postDataJSON().symptoms).toEqual(['report_v3_03', 'report_v3_56'])
  expect(response.request().postDataJSON().original_text).toBe('Original synthetic wording')
  await expect(page.getByRole('alert')).toContainText('immediately')
  await page.getByRole('button', { name: 'Staff area' }).click()
  await page.getByLabel('Search patients').fill(name)
  const card = page.getByRole('button', { name: new RegExp(`Open token .*${name}`) }).first()
  await card.click()
  await expect(page.locator('.reported-selections')).toContainText(chestLabel)
  await expect(page.locator('.reported-selections')).toContainText('Pregnancy & after delivery')
  await expect(page.locator('.reported-selections')).toContainText(movement)
  await expect(page.locator('.detail-heading')).toContainText('Immediate')
})

test('Hindi sections preserve all 63 supplied labels, private guidance and no obsolete help shortcut', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const posts: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/encounters')) posts.push(r.url())
  })
  await start(page, true)
  const picker = page.locator('.symptom-picker')
  const catalog = await (await page.request.get('/api/v1/catalog')).json()
  const options = catalog.patient_options.filter((o: { hidden?: boolean }) => !o.hidden)
  await expect(picker.getByRole('checkbox')).toHaveCount(8)
  await accessible(page)
  await page.screenshot({
    path: 'test-results/checkbox-eight-sections-hindi-mobile.png',
    fullPage: true,
  })
  for (const [index, group] of catalog.patient_groups.entries()) {
    const toggle = picker.getByRole('checkbox', { name: `${index + 1}. ${group.hi}`, exact: true })
    await toggle.check()
    const children = options.filter((o: { group: string }) => o.group === group.id)
    await expect(picker.getByRole('checkbox')).toHaveCount(8 + children.length)
    for (const option of children) {
      await expect(picker.getByRole('checkbox', { name: option.hi, exact: true })).toBeVisible()
      await expect(picker.getByRole('checkbox', { name: option.en, exact: true })).toHaveCount(0)
    }
    if (index === 0) {
      await picker.getByRole('checkbox', { name: children[2].hi, exact: true }).check()
      await page.screenshot({
        path: 'test-results/checkbox-expanded-hindi-mobile.png',
        fullPage: true,
      })
    }
    if (index === 7) {
      await expect(picker.locator('.private-question-note')).toHaveText(
        'इन सवालों को जरूरत पड़ने पर अलग, निजी जगह में पूछें।',
      )
      await accessible(page)
      await page.screenshot({
        path: 'test-results/checkbox-private-hindi-mobile.png',
        fullPage: true,
      })
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy()
    await toggle.uncheck()
  }
  await expect(picker.getByRole('status')).toHaveText('चुने हुए लक्षण · 1')
  await expect(
    page.getByRole('button', { name: 'मदद चाहिए / परेशानी नहीं मिली?', exact: true }),
  ).toHaveCount(0)
  expect(posts).toEqual([])
  const chest = options.find((o: { id: string }) => o.id === 'report_v3_03')
  await picker.getByRole('button', { name: `${chest.hi} हटाएँ`, exact: true }).click()
  await expect(picker.getByRole('status')).toHaveText('चुने हुए लक्षण · 0')
  await expect(page.getByRole('button', { name: 'जानकारी देखें', exact: true })).toBeDisabled()
  expect(posts).toEqual([])
})
