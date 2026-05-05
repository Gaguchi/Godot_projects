import { test, expect } from '@playwright/test';

test('boot scene renders Phaser ready text', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // let Phaser scene boot
  await expect(page).toHaveScreenshot('boot.png', {
    maxDiffPixels: 200,
  });
});
