import { test, expect } from '@playwright/test';

/**
 * Language tests.
 */
test.describe('Language', () => {
  test('from English to Polish', async ({ page }) => {
    // Arrange: Start on default public page.
    await page.goto('/');

    // Assert: We have English language.
    await expect(page.getByTestId('lang-switcher.pl')).toHaveAttribute('title', 'Polish');

    // Act: Click on Polish language button.
    await page.getByTestId('lang-switcher.pl').click();

    // Assert: We have Polish language.
    await expect(page.getByTestId('lang-switcher.pl')).toHaveAttribute('title', 'Polski');
  });
});
