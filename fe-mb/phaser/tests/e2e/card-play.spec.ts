import { test, expect } from '@playwright/test';

test('initial battle state renders', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('battle-initial.png', { maxDiffPixels: 400 });
});

test('selecting first card highlights valid tiles', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Click first card in hand
  await page.mouse.click(540, 670);
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot('battle-card-selected.png', { maxDiffPixels: 400 });
});
