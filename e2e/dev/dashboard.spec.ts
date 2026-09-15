import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests for dev dashboard page.
 */
test.describe('Dashboard page', () => {
  test('dev section should navigate to the dashboard page', async ({ page }) => {
    // Arrange: Start on default dev page.
    await page.goto('/dev');

    // Assert: /dev leads to the dashboard page by default.
    await expect(page.locator('body')).toContainText('DASHBOARD PAGE PLACEHOLDER');
  });

  test('is correct axe-wise', async ({ page }) => {
    // Arrange: Start on default dev page.
    await page.goto('/dev');
    await expect(page.locator('main')).toBeVisible(); // wait until page stabilizes

    // Assert: AXE rules are observed.
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
