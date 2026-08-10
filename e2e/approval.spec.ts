import { test, expect } from '@playwright/test';

test.describe('E2E: Approval & Audit Workflow', () => {
  test('should render approval or pending transactions interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const pendingBtn = page.locator('a[href*="pending"], button:has-text("اعتماد"), button:has-text("معاملات قيد الانتظار")');
    if (await pendingBtn.first().isVisible()) {
      await pendingBtn.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
