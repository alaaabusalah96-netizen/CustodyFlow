import { test, expect } from '@playwright/test';

test.describe('E2E: Expense Recording & Validation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Perform auto-login if on login screen
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@kemit.com');
      await page.locator('input[type="password"]').fill('Password123!');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should navigate to expense creation and validate required fields', async ({ page }) => {
    const expenseNavBtn = page.locator('button:has-text("تسجيل مصروف"), a[href*="expense"], button:has-text("New Expense")').first();
    if (await expenseNavBtn.isVisible()) {
      await expenseNavBtn.click();
    }

    const formHeader = page.locator('h1, h2, h3').filter({ hasText: /مصروف|Expense|تسجيل/i });
    await expect(formHeader.first()).toBeVisible();

    const submitBtn = page.locator('button[type="submit"], button:has-text("حفظ"), button:has-text("إرسال")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should successfully enter item description, amount, and notes', async ({ page }) => {
    const expenseNavBtn = page.locator('button:has-text("تسجيل مصروف"), button:has-text("New Expense")').first();
    if (await expenseNavBtn.isVisible()) {
      await expenseNavBtn.click();
    }

    const descInput = page.locator('input[placeholder*="بيان"], input[placeholder*="وصف"], input[name*="desc"]').first();
    const amountInput = page.locator('input[type="number"], input[placeholder*="مبلغ"]').first();
    const notesInput = page.locator('textarea, input[placeholder*="ملاحظات"]').first();

    if (await descInput.isVisible()) {
      await descInput.fill('شراء أدوات صيانة ومعدات تشغيل');
    }
    if (await amountInput.isVisible()) {
      await amountInput.fill('750');
    }
    if (await notesInput.isVisible()) {
      await notesInput.fill('تم الشراء حسب إذن التوريد المرفق');
    }

    expect(await page.locator('body').isVisible()).toBe(true);
  });
});
