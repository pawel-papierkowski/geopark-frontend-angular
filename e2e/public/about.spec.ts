import { test, expect } from '@playwright/test';

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
});
