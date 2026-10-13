import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('login offers accessible patient registration and fills the selected demo role without signing in', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Clinical urgency matters,not just parcha numbers.',
  )
  const patientEntry = page.getByRole('region', { name: 'Registering a demo patient?' })
  await expect(
    patientEntry.getByRole('button', { name: 'Open Hindi / English patient form' }),
  ).toBeVisible()
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true })

  const logins: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/auth/login')) {
      logins.push(request.postDataJSON())
    }
  })
  for (const role of ['nurse', 'doctor', 'intern', 'jr']) {
    await page.getByLabel('Demo staff role').selectOption(role)
    const loginCount = logins.length
    await page.getByRole('button', { name: 'Fill credentials', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('DemoOnly!2026')
    await expect(page.getByLabel('Demo staff role')).toHaveValue(role)
    await expect(page.getByRole('status')).toContainText('Credentials filled')
    await expect(page.getByRole('heading', { name: 'Welcome to your OPD.' })).toBeVisible()
    expect(logins).toHaveLength(loginCount)

    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Open staff workspace', exact: true }).click()
    expect((await (await response).json()).role).toBe(role.toUpperCase())
    await expect(page.getByRole('heading', { name: 'Original Queue' })).toBeVisible()
    expect(logins).toHaveLength(loginCount + 1)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Welcome to your OPD.' })).toBeVisible()
  }

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Fill credentials', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true })
  await patientEntry.getByRole('button', { name: 'Open Hindi / English patient form' }).click()
  await expect(page.getByRole('button', { name: 'English Continue in English' })).toBeVisible()
})
