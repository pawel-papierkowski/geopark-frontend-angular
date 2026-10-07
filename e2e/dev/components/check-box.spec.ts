import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the checkBox role element on the custom components page.
 * @param page Browser page.
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the checkBox.
 */
function getCheckBox(page: Page, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId('cc-checkBoxNull');
  return page.getByTestId('cc-checkBox');
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
 * Locate the value display div next to the checkBox using data-testid.
 * @param page Browser page.
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId('cc-checkBoxNull-value');
  return page.getByTestId('cc-checkBox-value');
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
    test('should cycle through null → true → false → true on click', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page, false);
      const display = getValueDisplay(page, false);

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

      // Act & Assert: false → true (no null when canNull is false).
      await checkBox.click();
      await expect(checkBox).toHaveAttribute('aria-checked', 'true');
      await expect(display).toContainText('✅');
    });

    test('should cycle through null → true → false → null on click', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page, true);
      const display = getValueDisplay(page, true);

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
      const label = page.getByTestId('cc-checkBox-label');

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

    test('should navigate properly from prev component to check-box to next component on Tab presses', async ({ page }) => {
      // Arrange: Navigate; start keyboard modality via textBox (prev component).
      await goToComponentsPage(page);
      await page.getByTestId('cc-textBox').focus();

      // Act: Tab into checkBox.
      await page.keyboard.press('Tab');

      // Assert: Component checkBox focused with visible focus outline; Tab must not toggle it.
      const checkBox = getCheckBox(page);
      await expect(checkBox).toBeFocused();
      await expect(checkBox).toHaveCSS('outline-style', 'solid');
      await expect(checkBox).toHaveCSS('outline-color', 'rgb(37, 99, 235)');
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Tab out of checkBox.
      await page.keyboard.press('Tab');

      // Assert: Focus moved to next component (comboBox).
      await expect(page.getByTestId('cc-comboBox')).toBeFocused();
    });

    test('should navigate backwards from comboBox to checkBox to textBox on Shift+Tab presses', async ({ page }) => {
      // Arrange: Navigate; start keyboard modality on comboBox (next component).
      await goToComponentsPage(page);
      await page.getByTestId('cc-comboBox').focus();

      // Act: Shift+Tab backwards into checkBox.
      await page.keyboard.press('Shift+Tab');

      // Assert: Component checkBox focused with visible focus outline; Shift+Tab must not toggle it.
      const checkBox = getCheckBox(page);
      await expect(checkBox).toBeFocused();
      await expect(checkBox).toHaveCSS('outline-style', 'solid');
      await expect(checkBox).toHaveCSS('outline-color', 'rgb(37, 99, 235)');
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');

      // Act: Shift+Tab out of checkBox.
      await page.keyboard.press('Shift+Tab');

      // Assert: Focus moved to previous component (textBox).
      await expect(page.getByTestId('cc-textBox')).toBeFocused();
    });
  });

  test.describe('states', () => {
    test('should render disabled visual state when mode is set to Disabled', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled" mode (index 1) on the mode radioBox.
      await getModeOption(page, 1).click();

      // Assert: Component checkBox has disabled class and aria-disabled.
      await expect(getCheckBox(page)).toHaveClass(/disabled/);
      await expect(getCheckBox(page)).toHaveAttribute('aria-disabled', 'true');
    });

    test('should render invalid visual state when mode is set to Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Error" mode (index 2) on the mode radioBox.
      await getModeOption(page, 2).click();

      // Assert: Component checkBox has invalid class.
      await expect(getCheckBox(page)).toHaveClass(/invalid/);
    });

    test('should keep invalid colors while hovered when mode is set to Error', async ({ page }) => {
      // Arrange: Navigate and put the checkBox into the Error mode.
      await goToComponentsPage(page);
      await getModeOption(page, 2).click();
      const checkBox = getCheckBox(page);
      await expect(checkBox).toHaveClass(/invalid/);

      // Act: Hover the invalid checkBox.
      await checkBox.hover();

      // Assert: The generic hover rule must not swap the error color/background for hover ones
      // (--input-err-background #ffe8e8, --input-err-color #660000; hover would be #f8f8f8/#111827).
      await expect(checkBox, 'invalid background must survive hover').toHaveCSS('background-color', 'rgb(255, 232, 232)');
      await expect(checkBox, 'invalid color must survive hover').toHaveCSS('color', 'rgb(102, 0, 0)');
    });

    test('should hover with the shared input hover background token', async ({ page }) => {
      // Arrange: Navigate to the custom components page (Standard mode, no invalid state).
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);

      // Act: Hover the enabled checkBox.
      await checkBox.hover();

      // Assert: Hover background comes from --input-hover-background (#f8f8f8), not a hardcoded hex.
      await expect(checkBox, 'hover background should use the shared input token').toHaveCSS('background-color', 'rgb(248, 248, 248)');
    });

    test('should render disabled state when mode is Disabled & Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled & Error" mode (index 3) on the mode radioBox.
      await getModeOption(page, 3).click();

      // Assert: Component checkBox has disabled class. Invalid class is not present because
      // Angular Signal Forms skips validation on disabled fields.
      await expect(getCheckBox(page)).toHaveClass(/disabled/);
      await expect(getCheckBox(page)).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('target size', () => {
    test('should toggle from 3px outside the drawn box (WCAG 2.2 SC 2.5.8 hit area)', async ({ page }) => {
      // Arrange: Navigate; the drawn box is 16x16, but the pointer hit area must reach 24x24.
      await goToComponentsPage(page);
      const checkBox = getCheckBox(page);
      await expect(checkBox).toHaveAttribute('aria-checked', 'mixed');
      const box = await checkBox.boundingBox();
      if (!box) throw new Error('checkBox should have a bounding box');

      // Act: Click 3px left of the drawn box - inside the invisible 4px hit ring, in the 4.8px
      // grid gap between the label column and the control column (so the click cannot land on
      // the label, which would toggle the checkBox through label activation even without the ring).
      await page.mouse.click(box.x - 3, box.y + box.height / 2);

      // Assert: The ring belongs to the checkBox, so the outside click toggled it.
      await expect(checkBox, 'click inside the expanded hit ring should toggle the checkBox').toHaveAttribute('aria-checked', 'true');
    });
  });
});
