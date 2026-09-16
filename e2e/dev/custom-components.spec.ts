import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Tests for dev custom components page.
 */
test.describe('Custom components page', () => {
  test('should navigate to the custom components page', async ({ page }) => {
    // Arrange: Start on custom components page.
    await page.goto('/dev/components');

    // Assert: Custom components page content is visible.
    await expect(page.locator('body')).toContainText('CUSTOM COMPONENTS PLACEHOLDER');
  });

  test('is correct axe-wise', async ({ page }) => {
    // Arrange: Start on custom components page.
    await page.goto('/dev/components');
    await expect(page.locator('main')).toBeVisible(); // wait until page stabilizes

    // Assert: AXE rules are observed.
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
