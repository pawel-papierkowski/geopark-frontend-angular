import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the checkBox role element on the custom components page.
 * @param page Browser page.
 * @returns Locator for the checkBox.
 */
function getCheckBox(page: Page): Locator {
  return page.getByTestId('cc-checkBox');
}

/**
 * Locate the value display div next to the checkBox.
 * The checkBox row is a `.form-subform-triple` containing a <label>, <check-box>, and a display <div>.
 * @param page Browser page.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page): Locator {
  return page
    .locator('.form-subform-triple')
    .filter({ hasText: 'CheckBox' })
    .locator(':scope > div')
    .last();
}

/**
 * Navigate to the custom components page and wait for it to stabilize.
 * @param page Browser page.
 */
async function goToComponentsPage(page: Page): Promise<void> {
  await page.goto('/dev/components');
  await expect(page.locator('main')).toBeVisible();
}

/**
 * E2e tests of check-box component in form present in page-custom-components.
 */
test.describe('CheckBox', () => {
  test.describe('clicking', () => {
    test('should cycle through null → true → false → null on click', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);
      const display = getValueDisplay(page);

      // Assert: Initial state is null (mixed).
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');
      await expect(display).toContainText('❓');

      // Act & Assert: null → true.
      await checkBox.click();
      await expect(checkBox).toHaveAttribute('aria-checked', 'true');
      await expect(display).toContainText('✅');

      // Act & Assert: true → false.
      await checkBox.click();
      await expect(checkBox).toHaveAttribute('aria-checked', 'false');
      await expect(display).toContainText('❌');

      // Act & Assert: false → null.
      await checkBox.click();
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');
      await expect(display).toContainText('❓');
    });
  });

  test.describe('label', () => {
    test('should toggle checkBox when label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);
      const label = page.locator('label', { hasText: 'CheckBox' });

      // Assert: Initial state is null.
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Click the label.
      await label.click();

      // Assert: Checkbox toggled from null to true.
      await expect(checkBox).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('✅');
    });

    test('should have accessible name from label', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);

      // Assert: aria-labelledby points to the label element's id.
      await expect(checkBox).toHaveAttribute('aria-labelledby', 'cc-checkBox-label');
    });
  });

  test.describe('keyboard', () => {
    test('should toggle checkBox on Enter key', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus the checkBox.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);
      await checkBox.focus();

      // Assert: Initial state is null.
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Press Enter.
      await checkBox.press('Enter');

      // Assert: Checkbox toggled from null to true.
      await expect(checkBox).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('✅');
    });

    test('should toggle checkBox on Space key', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus the checkBox.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);
      await checkBox.focus();

      // Assert: Initial state is null.
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Press Space.
      await checkBox.press('Space');

      // Assert: Checkbox toggled from null to true.
      await expect(checkBox).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('✅');
    });
  });
});
