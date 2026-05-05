import { test, expect } from '@playwright/test';

test('hover, select, target preview, cancel', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Click first card (Iron Strike)
  await page.mouse.click(540, 670);
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot('hand-card-selected.png', { maxDiffPixels: 400 });

  // Hover a valid tile near Roy
  await page.mouse.move(240, 320);
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot('hand-aoe-preview.png', { maxDiffPixels: 400 });

  // Cancel via ESC
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot('hand-after-cancel.png', { maxDiffPixels: 400 });
});
