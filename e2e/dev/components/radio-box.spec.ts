import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the radioBox element on the custom components page.
 * @param page Browser page.
 * @returns Locator for the radioBox radiogroup.
 */
function getRadioBox(page: Page): Locator {
  return page.getByTestId('cc-radioBox');
}

/**
 * Locate a specific option inside the radioBox by index.
 * @param page Browser page.
 * @param index Option index (0-based).
 * @returns Locator for the option element.
 */
function getOption(page: Page, index: number): Locator {
  return page.getByTestId(`cc-radioBox_${index}`);
}

/**
 * Locate the value display div next to the radioBox.
 * The radioBox row is a `.form-subform-triple` containing a <label>, <radio-box>, and a display <div>.
 * @param page Browser page.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page): Locator {
  return page
    .locator('.form-subform-triple')
    .filter({ hasText: 'Radiobox' })
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
 * E2e tests of radio-box component in form present in page-custom-components.
 */
test.describe('RadioBox', () => {
  test.describe('clicking', () => {
    test('should select option via click', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const option = getOption(page, 1);
      const display = getValueDisplay(page);

      // Assert: Initial state is null (option 0 selected).
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'true');
      await expect(display).toContainText('❓');

      // Act: Click option 1 ("First option").
      await option.click();

      // Assert: Option 1 is selected, display shows "a".
      await expect(option).toHaveAttribute('aria-checked', 'true');
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'false');
      await expect(display).toContainText('a');
    });

    test('should change selection on click', async ({ page }) => {
      // Arrange: Navigate to the custom components page and select option 1.
      await goToComponentsPage(page);
      await getOption(page, 1).click();
      await expect(getOption(page, 1)).toHaveAttribute('aria-checked', 'true');

      // Act: Click option 2 ("Second option").
      await getOption(page, 2).click();

      // Assert: Selection moved to option 2, display shows "b".
      await expect(getOption(page, 2)).toHaveAttribute('aria-checked', 'true');
      await expect(getOption(page, 1)).toHaveAttribute('aria-checked', 'false');
      await expect(getValueDisplay(page)).toContainText('b');
    });

    test('should select null option via click', async ({ page }) => {
      // Arrange: Navigate and select option 1 first.
      await goToComponentsPage(page);
      await getOption(page, 1).click();
      await expect(getValueDisplay(page)).toContainText('a');

      // Act: Click option 0 ("Null").
      await getOption(page, 0).click();

      // Assert: Value is null, display shows "?".
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('❓');
    });
  });

  test.describe('label', () => {
    test('should select first option when label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const label = page.locator('label', { hasText: 'Radiobox' });

      // Assert: Initial state is null.
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'true');

      // Act: Click the label.
      await label.click();

      // Assert: First option remains selected (label targets the hidden button which doesn't toggle).
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'true');
    });

    test('should have accessible name from label', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Assert: aria-labelledby points to the label element's id.
      await expect(getRadioBox(page)).toHaveAttribute('aria-labelledby', 'cc-radioBox-label');
    });
  });

  test.describe('keyboard', () => {
    test('should select next option on ArrowDown', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus first option.
      await goToComponentsPage(page);
      await getOption(page, 0).focus();

      // Act: Press ArrowDown.
      await getOption(page, 0).press('ArrowDown');

      // Assert: Option 1 is now selected.
      await expect(getOption(page, 1)).toHaveAttribute('aria-checked', 'true');
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'false');
      await expect(getValueDisplay(page)).toContainText('a');
    });

    test('should select next option on ArrowRight', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus first option.
      await goToComponentsPage(page);
      await getOption(page, 0).focus();

      // Act: Press ArrowRight.
      await getOption(page, 0).press('ArrowRight');

      // Assert: Option 1 is now selected.
      await expect(getOption(page, 1)).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('a');
    });

    test('should select previous option on ArrowUp', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus second option.
      await goToComponentsPage(page);
      await getOption(page, 1).click();
      await getOption(page, 1).focus();

      // Act: Press ArrowUp.
      await getOption(page, 1).press('ArrowUp');

      // Assert: Option 0 is now selected.
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('❓');
    });

    test('should wrap around to first option on ArrowDown from last', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus last option.
      await goToComponentsPage(page);
      await getOption(page, 2).click();
      await getOption(page, 2).focus();

      // Act: Press ArrowDown.
      await getOption(page, 2).press('ArrowDown');

      // Assert: Wrapped to option 0.
      await expect(getOption(page, 0)).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('❓');
    });

    test('should wrap around to last option on ArrowUp from first', async ({ page }) => {
      // Arrange: Navigate to the custom components page and focus first option.
      await goToComponentsPage(page);
      await getOption(page, 0).focus();

      // Act: Press ArrowUp.
      await getOption(page, 0).press('ArrowUp');

      // Assert: Wrapped to option 2.
      await expect(getOption(page, 2)).toHaveAttribute('aria-checked', 'true');
      await expect(getValueDisplay(page)).toContainText('b');
    });
  });
});
