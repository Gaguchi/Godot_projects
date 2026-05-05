import { test, expect } from '@playwright/test';

test.describe('Full sandbox visual coverage', () => {
  test('initial battle state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('full-initial.png', { maxDiffPixels: 400 });
  });

  test('card hovered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.mouse.move(540, 670);
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('full-hover.png', { maxDiffPixels: 400 });
  });

  test('card selected, valid tiles shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.mouse.click(540, 670);
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('full-selected.png', { maxDiffPixels: 400 });
  });
});
