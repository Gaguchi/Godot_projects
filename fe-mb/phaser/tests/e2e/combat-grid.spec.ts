import { test, expect } from '@playwright/test';

test('combat scene renders 14x10 grid', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('combat-grid.png', {
    maxDiffPixels: 200,
  });
});
