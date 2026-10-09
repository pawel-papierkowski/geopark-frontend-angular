import { test, expect } from '@playwright/test';

/**
 * Document title tests (WCAG 2.4.2 Page Titled).
 */
test.describe('Page title', () => {
  test.use({ locale: 'en-GB' });

  test('should describe the page after navigating', async ({ page }) => {
    // Arrange: Start on the landing page with an English browser.
    await page.goto('/');

    // Assert: Landing page uses the bare project name.
    await expect(page).toHaveTitle('GeoPark');

    // Act: Navigate to the about page without a full reload.
    await page.getByTestId('public-nav.about').click();

    // Assert: Title describes the newly opened page.
    await expect(page).toHaveTitle('About - GeoPark');
  });

  test('should follow the selected language', async ({ page }) => {
    // Arrange: Start on the English about page.
    await page.goto('/about');
    await expect(page).toHaveTitle('About - GeoPark');

    // Act: Switch the application language to Polish.
    await page.getByTestId('lang-switcher.pl').click();

    // Assert: Title is rebuilt with Polish translations.
    await expect(page).toHaveTitle('O nas - GeoPark');
  });

  test('should describe unknown pages', async ({ page }) => {
    // Arrange: Start on a nonexistent page.
    await page.goto('/nonexistent');

    // Assert: The 404 page title is used.
    await expect(page).toHaveTitle('404 Page Not Found - GeoPark');
  });
});
