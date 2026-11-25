import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const shots = resolve(process.cwd(), '../../artifacts/memory-space')

async function openMemory(page: import('@playwright/test').Page) {
  await page.goto('/#/memory-graph')
  await page.getByLabel('本地启动令牌').fill('e2e-token')
  await page.getByRole('button', { name: '连接审核空间' }).click()
  await expect(page.locator('.relationship-proof')).toContainText('明确 tags 关系')
}

test.beforeAll(() => mkdirSync(shots, { recursive: true }))

for (const viewport of [{ name: 'desktop-1440', width: 1440, height: 1000 }, { name: 'mobile-390', width: 390, height: 844 }]) {
  test(`${viewport.name} graph is responsive and evidence-labelled`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openMemory(page)
    await expect(page.locator('.relationship-proof')).toContainText('明确 tags 关系')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: resolve(shots, `${viewport.name}-graph.png`), fullPage: true })
  })
}

test('timeline and review remain reachable', async ({ page }) => {
  await openMemory(page)
  await page.getByRole('button', { name: '记忆时间线' }).click()
  await expect(page.getByRole('heading', { name: '你的记忆如何演变' })).toBeVisible()
  await page.getByRole('button', { name: '记忆审核' }).click()
  await expect(page.getByRole('complementary', { name: '候选记忆列表' })).toBeVisible()
})

test('Memory Space follows the English language resource', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nexora.language', 'en'))
  await page.goto('/#/memory-graph')
  await page.getByLabel('Local startup token').fill('e2e-token')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByPlaceholder('Search memories or topics')).toBeVisible()
  await expect(page.locator('.relationship-proof')).toContainText('explicit tags only')
  await page.getByRole('button', { name: 'Memory Timeline' }).click()
  await expect(page.getByRole('heading', { name: 'How your memory evolved' })).toBeVisible()
})

