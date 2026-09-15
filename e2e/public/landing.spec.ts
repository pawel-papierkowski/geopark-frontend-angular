import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests for public landing page.
 */
test.describe('Landing page', () => {
  test('public section should navigate to the landing page', async ({ page }) => {
    // Arrange: Start on default public page.
    await page.goto('/');

    // Assert: / leads to the landing page by default.
    await expect(page).toHaveTitle(/GeoPark/);
    await expect(page.locator('body')).toContainText('LANDING PAGE PLACEHOLDER');
  });

  test('is correct axe-wise', async ({ page }) => {
    // Arrange: Start on default public page.
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible(); // wait until page stabilizes

    // Assert: AXE rules are observed.
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
