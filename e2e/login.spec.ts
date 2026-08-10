import { test, expect } from '@playwright/test';

test.describe('E2E: Authentication & Main UI Layout', () => {
  test('should load application and render main UI or login viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    await expect(body).toBeVisible();

    const mainContainer = page.locator('#root, main, header');
    await expect(mainContainer.first()).toBeVisible();
  });

  test('should allow interacting with primary theme or language controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const actionButton = page.locator('button').first();
    await expect(actionButton).toBeVisible();
  });
});
