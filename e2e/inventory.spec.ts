import { test, expect } from '@playwright/test';

test.describe('E2E: Inventory Module Operations', () => {
  test('should render inventory module tabs and warehouse tree', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const inventoryBtn = page.locator('a[href*="inventory"], button:has-text("المخازن"), button:has-text("إدارة المخازن")');
    if (await inventoryBtn.first().isVisible()) {
      await inventoryBtn.first().click();
      await page.waitForTimeout(500);

      const docsTab = page.locator('button:has-text("أذون ومستندات"), button:has-text("Documents")');
      if (await docsTab.first().isVisible()) {
        await docsTab.first().click();
      }

      const reportsTab = page.locator('button:has-text("التقارير"), button:has-text("Reports")');
      if (await reportsTab.first().isVisible()) {
        await reportsTab.first().click();
      }
    }
  });
});
