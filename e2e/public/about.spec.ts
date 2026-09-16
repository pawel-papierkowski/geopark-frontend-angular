import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests for public about page.
 */
test.describe('About page', () => {
  test('should navigate to the about page', async ({ page }) => {
    // Arrange: Start on about page.
    await page.goto('/about');

    // Assert: About page content is visible.
    await expect(page.locator('body')).toContainText('ABOUT PAGE PLACEHOLDER');
  });

  test('is correct axe-wise', async ({ page }) => {
    // Arrange: Start on about page.
    await page.goto('/about');
    await expect(page.locator('main')).toBeVisible(); // wait until page stabilizes

    // Assert: AXE rules are observed.
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
