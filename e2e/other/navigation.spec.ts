import { test, expect } from '@playwright/test';

/**
 * Other navigation tests.
 */
test.describe('Navigation', () => {
  test.describe('between sections', () => {
    test('from public to dev', async ({ page }) => {
      // Arrange: Start on default public page.
      await page.goto('/');

      // Act: Click on dev section button.
      await page.getByTestId('section-switcher.dev').click();

      // Assert: We are on default dev page.
      await expect(page).toHaveURL('/dev');
    });

    test('from dev to admin', async ({ page }) => {
      // Arrange: Start on default dev page.
      await page.goto('/dev');

      // Act: Click on admin section button.
      await page.getByTestId('section-switcher.admin').click();

      // Assert: We are on default admin page.
      await expect(page).toHaveURL('/admin');
    });

    test('from admin to public', async ({ page }) => {
      // Arrange: Start on default admin page.
      await page.goto('/admin');

      // Act: Click on public section button.
      await page.getByTestId('section-switcher.public').click();

      // Assert: We are on default public page.
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('unknown page', () => {
    test('should show 404 in public section', async ({ page }) => {
      // Arrange: Start on nonexistent public page.
      await page.goto('/nonexistent');

      // Assert: Not found page is shown for public section.
      await expect(page.locator('h1')).toHaveText('404 Page Not Found');
      // Assert: Public section is not present in section selector.
      await expect(page.getByTestId('section-switcher.public')).toHaveCount(0);
    });

    test('should show 404 in dev section', async ({ page }) => {
      // Arrange: Start on nonexistent dev page.
      await page.goto('/dev/nonexistent');

      // Assert: Not found page is shown for dev section.
      await expect(page.locator('h1')).toHaveText('404 Page Not Found');
      // Assert: Dev section is not present in section selector.
      await expect(page.getByTestId('section-switcher.dev')).toHaveCount(0);
    });

    test('should show 404 in admin section', async ({ page }) => {
      // Arrange: Start on nonexistent admin page.
      await page.goto('/admin/nonexistent');

      // Assert: Not found page is shown for admin section.
      await expect(page.locator('h1')).toHaveText('404 Page Not Found');
      // Assert: Admin section is not present in section selector.
      await expect(page.getByTestId('section-switcher.admin')).toHaveCount(0);
    });
  });
});
