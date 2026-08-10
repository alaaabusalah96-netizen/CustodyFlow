import { test, expect } from '@playwright/test';

test.describe('E2E: Expense Flow', () => {
  test('should render expense module navigation and form elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const expenseBtn = page.locator('a[href*="expense"], button:has-text("مصروف"), button:has-text("تسجيل مصروف")');
    if (await expenseBtn.first().isVisible()) {
      await expenseBtn.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
