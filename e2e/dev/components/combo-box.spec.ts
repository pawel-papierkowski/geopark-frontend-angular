import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the comboBox element on the custom components page.
 * @param page Browser page.
 * @returns Locator for the comboBox.
 */
function getComboBox(page: Page): Locator {
  return page.getByTestId('cc-comboBox');
}

/**
 * Locate a specific option inside the comboBox by index.
 * @param page Browser page.
 * @param index Option index (0-based).
 * @returns Locator for the option element.
 */
function getOption(page: Page, index: number): Locator {
  return page.getByTestId(`cc-comboBox_${index}`);
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
 * Locate the value display div next to the comboBox using data-testid.
 * @param page Browser page.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page): Locator {
  return page.getByTestId('cc-comboBox-value');
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
 * E2e tests of combo-box component in form present in page-custom-components.
 */
test.describe('ComboBox', () => {
  test.describe('clicking', () => {
    test('should open list on click and select option', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const comboBox = getComboBox(page);
      const display = getValueDisplay(page);

      // Assert: Initial state is null, list closed.
      await expect(display).toContainText('❓');
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');

      // Act: Open the list.
      await comboBox.click();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');

      // Act: Click option 1 ("First option").
      await getOption(page, 1).click();

      // Assert: List closed, translated text shown, raw value propagated to form display.
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');
      await expect(comboBox.locator('.combobox-selected-text')).toContainText('First option');
      await expect(display).toContainText('OPT1');
    });

    test('should close list on second click', async ({ page }) => {
      // Arrange: Navigate to the custom components page and open the list.
      await goToComponentsPage(page);
      const comboBox = getComboBox(page);
      await comboBox.click();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');

      // Act: Click the combobox again.
      await comboBox.click();

      // Assert: List is closed.
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');
    });

    test('should close list when clicking outside', async ({ page }) => {
      // Arrange: Navigate to the custom components page and open the list.
      await goToComponentsPage(page);
      const comboBox = getComboBox(page);
      await comboBox.click();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');

      // Act: Click page heading (moves focus away, blurring the combobox).
      await page.locator('h1').click();

      // Assert: List is closed via real blur flow.
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');
      await expect(getValueDisplay(page)).toContainText('❓');
    });
  });

  test.describe('label', () => {
    test('should open list when label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const label = page.locator('label', { hasText: 'Combobox' });

      // Assert: Initial state is list closed.
      await expect(getComboBox(page)).toHaveAttribute('aria-expanded', 'false');

      // Act: Click the label (activation forwards to hidden button, click bubbles to combobox).
      await label.click();

      // Assert: List is open.
      await expect(getComboBox(page)).toHaveAttribute('aria-expanded', 'true');
    });

    test('should have accessible name from label', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Assert: aria-labelledby points to the label element's id.
      await expect(getComboBox(page)).toHaveAttribute('aria-labelledby', 'cc-comboBox-label');
    });
  });

  test.describe('keyboard', () => {
    test('should select option via focus, arrow and Enter flow', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus the combobox.
      await goToComponentsPage(page);
      const comboBox = getComboBox(page);
      await comboBox.focus();

      // Assert: Focus opened the list and highlighted current value (null option).
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');
      await expect(comboBox).toHaveAttribute('aria-activedescendant', 'cc-comboBox_option_0');

      // Act: Move highlight to option 1.
      await comboBox.press('ArrowDown');
      await expect(comboBox).toHaveAttribute('aria-activedescendant', 'cc-comboBox_option_1');

      // Act: Select highlighted option.
      await comboBox.press('Enter');

      // Assert: List closed, translated text shown, raw value propagated to form display.
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');
      await expect(comboBox.locator('.combobox-selected-text')).toContainText('First option');
      await expect(getValueDisplay(page)).toContainText('OPT1');
    });

    test('should close list on Escape', async ({ page }) => {
      // Arrange: Navigate to the custom components page and open the list via focus.
      await goToComponentsPage(page);
      const comboBox = getComboBox(page);
      await comboBox.focus();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');

      // Act: Press Escape.
      await comboBox.press('Escape');

      // Assert: List is closed.
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');
    });

    test('should navigate properly from prev component to combo-box to next component on Tab presses', async ({ page }) => {
      // Arrange: Navigate; start keyboard modality via textBox and tab to checkBox.
      await goToComponentsPage(page);
      await page.getByTestId('cc-textBox').focus();
      await page.keyboard.press('Tab');

      // Assert: Component checkBox is focused.
      const checkBox = page.getByTestId('cc-checkBox');
      await expect(checkBox).toBeFocused();

      // Act: Tab into comboBox.
      await page.keyboard.press('Tab');

      // Assert: Component checkBox focused with visible focus outline, list opened.
      const comboBox = getComboBox(page);
      await expect(comboBox).toBeFocused();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');
      await expect(comboBox).toHaveCSS('outline-style', 'solid');
      await expect(comboBox).toHaveCSS('outline-color', 'rgb(37, 99, 235)');

      // Act: Tab again — one press must close list AND move focus out.
      await page.keyboard.press('Tab');

      // Assert: Focus moved to next component; list closed; comboBox blurred.
      await expect(page.getByTestId('cc-radioBox_0')).toBeFocused();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'false');
    });
  });

  test.describe('display', () => {
    test('should render translated option texts', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const comboBox = getComboBox(page);

      // Assert: Selected text shows translated null option from real i18n assets.
      await expect(comboBox.locator('.combobox-selected-text')).toContainText('Null');

      // Act: Open the list.
      await comboBox.click();
      await expect(comboBox).toHaveAttribute('aria-expanded', 'true');

      // Assert: Option entries show translated texts.
      await expect(getOption(page, 0)).toContainText('Null');
      await expect(getOption(page, 1)).toContainText('First option');
      await expect(getOption(page, 2)).toContainText('Second option');
    });
  });

  test.describe('states', () => {
    test('should render disabled state and not open when mode is set to Disabled', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled" mode (index 1) on the mode radioBox.
      await getModeOption(page, 1).click();

      // Assert: Component comboBox has disabled class and aria-disabled.
      await expect(getComboBox(page)).toHaveClass(/disabled/);
      await expect(getComboBox(page)).toHaveAttribute('aria-disabled', 'true');

      // Act: Try to click the disabled combobox. Force is needed because Playwright treats
      // aria-disabled as not enabled, while real browsers still dispatch clicks (aria-disabled
      // is advisory only) and the component guard must swallow them.
      await getComboBox(page).click({ force: true });

      // Assert: List does not open.
      await expect(getComboBox(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('should render invalid state when mode is set to Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Error" mode (index 2) on the mode radioBox.
      await getModeOption(page, 2).click();

      // Assert: Component comboBox has invalid class and aria-invalid.
      await expect(getComboBox(page)).toHaveClass(/invalid/);
      await expect(getComboBox(page)).toHaveAttribute('aria-invalid', 'true');
    });

    test('should render disabled state when mode is Disabled & Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled & Error" mode (index 3) on the mode radioBox.
      await getModeOption(page, 3).click();

      // Assert: Component comboBox has disabled class. Invalid class is not present because
      // Angular Signal Forms skips validation on disabled fields.
      await expect(getComboBox(page)).toHaveClass(/disabled/);
      await expect(getComboBox(page)).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
