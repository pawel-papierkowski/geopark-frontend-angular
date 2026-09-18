import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the checkbox role element on the custom components page.
 * @param page Browser page.
 * @returns Locator for the checkbox.
 */
function getCheckbox(page: Page): Locator {
  return page.getByTestId('checkBox');
}

/**
 * Locate the value display div next to the checkbox.
 * The checkbox row is a `.form-subform-triple` containing a <label>, <check-box>, and a display <div>.
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

test.describe('CheckBox', () => {
  test.describe('clicking', () => {
    test('should cycle through null → true → false → null on click', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkbox = getCheckbox(page);
      const display = getValueDisplay(page);

      // Assert: Initial state is null (mixed).
      await expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
      await expect(display).toContainText('❓');

      // Act & Assert: null → true.
      await checkbox.click();
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
      await expect(display).toContainText('✅');

      // Act & Assert: true → false.
      await checkbox.click();
      await expect(checkbox).toHaveAttribute('aria-checked', 'false');
      await expect(display).toContainText('❌');

      // Act & Assert: false → null.
      await checkbox.click();
      await expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
      await expect(display).toContainText('❓');
    });
  });

  test.describe('label', () => {
    test('should toggle checkbox when label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkbox = getCheckbox(page);
      const label = page.locator('label', { hasText: 'CheckBox' });

      // Assert: Initial state is null.
      await expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Click the label.
      await label.click();

      // Assert: Checkbox toggled from null to true.
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('✅');
    });
  });

  test.describe('keyboard', () => {
    test('should toggle checkbox on Enter key', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus the checkbox.
      await goToComponentsPage(page);
      const checkbox = getCheckbox(page);
      await checkbox.focus();

      // Assert: Initial state is null.
      await expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Press Enter.
      await checkbox.press('Enter');

      // Assert: Checkbox toggled from null to true.
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('✅');
    });

    test('should toggle checkbox on Space key', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus the checkbox.
      await goToComponentsPage(page);
      const checkbox = getCheckbox(page);
      await checkbox.focus();

      // Assert: Initial state is null.
      await expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Press Space.
      await checkbox.press('Space');

      // Assert: Checkbox toggled from null to true.
      await expect(checkbox).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('✅');
    });
  });
});
