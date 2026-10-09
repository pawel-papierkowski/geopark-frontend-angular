import { test, expect } from '@playwright/test';

/**
 * Tests about layout.
 */
test.describe('Layout', () => {
  test.describe('footer', () => {
    test('repository link keeps its URL as its accessible name and describes target and new tab', async ({ page }) => {
      await test.step('Arrange', async () => {
        await page.addInitScript(() => localStorage.setItem('app.language', 'en'));
      });

      await test.step('Act', async () => {
        await page.goto('/');
      });

      await test.step('Assert', async () => {
        const link = page.getByTestId('footer-repository-link');
        const url = 'https://github.com/pawel-papierkowski/geopark-frontend-angular';
        await expect(link).toBeVisible();
        await expect(link).toHaveText(url);
        await expect(link).toHaveAccessibleName(url);
        // Both aria-describedby entries are part of the description: what the link is
        // (repository) and what it does (opens a new tab).
        await expect(link).toHaveAccessibleDescription(
          'Repository for geopark-frontend-angular project on GitHub. Opens in a new tab.',
        );
        await expect(link).toHaveAttribute('target', '_blank');
      });
    });
  });
});
