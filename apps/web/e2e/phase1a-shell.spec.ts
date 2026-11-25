import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const shots = resolve(process.cwd(), '../../artifacts/phase-1a-shell')

async function connect(page: import('@playwright/test').Page) {
  await page.goto('/#/overview')
  await page.getByLabel('本地启动令牌').fill('e2e-token')
  await page.getByRole('button', { name: '连接审核空间' }).click()
  await expect(page.getByRole('heading', { name: '你的本地优先个人智能空间', level: 1 })).toBeVisible()
}

test.beforeAll(() => mkdirSync(shots, { recursive: true }))

test('workspace information architecture preserves every primary destination', async ({ page }) => {
  await connect(page)
  const navigation = page.getByRole('navigation', { name: '工作空间功能' })
  await expect(navigation.getByText('工作空间', { exact: true })).toBeVisible()
  await expect(navigation.getByText('系统', { exact: true })).toBeVisible()

  for (const label of ['概览', '记忆', '个人档案', '复盘', '成长', '隐私与审计', '备份', 'AI 连接']) {
    await expect(navigation.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  await expect(page.locator('.sidebar-footer').getByRole('button', { name: '设置', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: '数据', exact: true })).toHaveCount(0)
})

for (const viewport of [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet-1024', width: 1024, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  test(`${viewport.name} shell has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await connect(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (viewport.width < 840) {
      await page.getByRole('button', { name: '打开导航' }).click()
      await expect(page.getByRole('complementary', { name: '主导航' })).toHaveClass(/open/)
      await page.waitForTimeout(300)
    }
    await page.screenshot({ path: resolve(shots, `${viewport.name}-overview.png`), fullPage: true })
  })
}
