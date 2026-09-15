import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests for admin overview page.
 */
test.describe('Overview page', () => {
  test('admin section should navigate to the overview page', async ({ page }) => {
    // Arrange: Start on default admin page.
    await page.goto('/admin');

    // Assert: /admin leads to the overview page by default.
    await expect(page.locator('body')).toContainText('OVERVIEW PAGE PLACEHOLDER');
  });

  test('is correct axe-wise', async ({ page }) => {
    // Arrange: Start on default admin page.
    await page.goto('/admin');
    await expect(page.locator('main')).toBeVisible(); // wait until page stabilizes

    // Assert: AXE rules are observed.
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
