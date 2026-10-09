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

  test.describe('section switcher feedback', () => {
    test('should highlight and press a section link on hover and mouse down', async ({ page }) => {
      // Arrange: Start on default public page. Hover gradient matches --button-hover-background.
      await page.goto('/');
      const devLink = page.getByTestId('section-switcher.dev');
      const hoverGradient = 'linear-gradient(rgb(255, 226, 122) 0%, rgb(255, 207, 86) 100%)';

      // Assert: Resting link has no highlight.
      await expect(devLink, 'resting link must not show the hover background').not.toHaveCSS('background-image', hoverGradient);

      // Act: Hover the link.
      await devLink.hover();

      // Assert: Hover shows the same yellow highlight the language flag buttons get.
      await expect(devLink, 'hovered link should show the button hover background').toHaveCSS('background-image', hoverGradient);

      // Act: Press and hold the mouse button over the link.
      const box = await devLink.boundingBox();

      expect(box, 'hovered link should be laid out').not.toBeNull();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();

      // Assert: Press pushes the link down by 1px (translateY(1px) serializes as this matrix).
      await expect(devLink, 'pressed link should translate down by 1px').toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 1)');

      // Act: Release the mouse away from the link so no navigation is triggered.
      await page.mouse.move(0, 0);
      await page.mouse.up();
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
