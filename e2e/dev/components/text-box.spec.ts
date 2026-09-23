import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the textBox input element on the custom components page.
 * @param page Browser page.
 * @returns Locator for the textBox input.
 */
function getTextBox(page: Page): Locator {
  return page.getByTestId('cc-textBox');
}

/**
 * Locate a specific option inside the mode radioBox by index.
 * @param page Browser page.
 * @param index Option index (0-based).
 * @returns Locator for the option element.
 */
function getModeOption(page: Page, index: number): Locator {
  return page.getByTestId(`cc-mode_${index}`);
}

/**
 * Locate the value display div next to the textBox using data-testid.
 * @param page Browser page.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page): Locator {
  return page.getByTestId('cc-textBox-value');
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
 * E2e tests of text-box component in form present in page-custom-components.
 * Note: TextBox is wrapper for text input, so we do not have to test as much as it would be needed for full custom component.
 */
test.describe('TextBox', () => {
  test.describe('typing', () => {
    test('should display typed text in value display', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const textBox = getTextBox(page);
      const display = getValueDisplay(page);

      // Assert: Initial state is null.
      await expect(display).toContainText('❓');

      // Act: Type text into the input.
      await textBox.fill('hello');

      // Assert: Value display shows the typed text.
      await expect(display).toContainText('hello');
    });

    test('should clear previous text and show new text', async ({ page }) => {
      // Arrange: Navigate to the custom components page and type initial text.
      await goToComponentsPage(page);
      const textBox = getTextBox(page);
      const display = getValueDisplay(page);
      await textBox.fill('first');
      await expect(display).toContainText('first');

      // Act: Clear and type new text.
      await textBox.fill('second');

      // Assert: Value display shows the new text.
      await expect(display).toContainText('second');
      await expect(display).not.toContainText('first');
    });
  });

  test.describe('label', () => {
    test('should focus input when label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const label = page.locator('label', { hasText: 'Normal input field' });

      // Act: Click the label.
      await label.click();

      // Assert: Input receives focus.
      await expect(getTextBox(page)).toBeFocused();
    });

    test('should have accessible name from label', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Assert: aria-labelledby points to the label element's id.
      await expect(getTextBox(page)).toHaveAttribute('aria-labelledby', 'cc-textBox-label');
    });
  });

  test.describe('keyboard', () => {
    test('should navigate properly from prev component to text-box to next component on Tab presses', async ({ page }) => {
      // Arrange: Navigate; start keyboard modality on the mode radioBox (prev component).
      await goToComponentsPage(page);
      await getModeOption(page, 0).focus();

      // Act: Tab into textBox.
      await page.keyboard.press('Tab');

      // Assert: Component textBox focused. Outline is intentionally hidden for standard inputs
      // (caret acts as the focus indicator), so we assert outline-style none instead of solid.
      const textBox = getTextBox(page);
      await expect(textBox).toBeFocused();
      await expect(textBox, 'textBox should not have focus outline').toHaveCSS('outline-style', 'none');

      // Act: Tab out of textBox.
      await page.keyboard.press('Tab');

      // Assert: Focus moved to next component (checkBox).
      await expect(page.getByTestId('cc-checkBox')).toBeFocused();
    });
  });

  test.describe('states', () => {
    test('should render disabled state when mode is set to Disabled', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled" mode (index 1) on the mode radioBox.
      await getModeOption(page, 1).click();

      // Assert: textBox is disabled and has aria-disabled.
      await expect(getTextBox(page)).toBeDisabled();
      await expect(getTextBox(page)).toHaveAttribute('aria-disabled', 'true');
    });

    test('should render invalid state when mode is set to Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Error" mode (index 2) on the mode radioBox.
      await getModeOption(page, 2).click();

      // Assert: textBox has invalid class and aria-invalid.
      await expect(getTextBox(page)).toHaveClass(/invalid/);
      await expect(getTextBox(page)).toHaveAttribute('aria-invalid', 'true');
    });

    test('should render disabled state when mode is Disabled & Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled & Error" mode (index 3) on the mode radioBox.
      await getModeOption(page, 3).click();

      // Assert: textBox is disabled and has aria-disabled. Invalid class is not present because
      // Angular Signal Forms skips validation on disabled fields.
      await expect(getTextBox(page)).toBeDisabled();
      await expect(getTextBox(page)).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
