import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Locate the time-picker input on the custom components page.
 * The page hosts two time-picker instances (datetime row and time row), so the ident prefix
 * `timeId_cc-timePicker` is what distinguishes this instance.
 * @param page Browser page.
 * @returns Locator for the time-picker input.
 */
function getTimePicker(page: Page): Locator {
  return page.getByTestId('timeId_cc-timePicker_input');
}

/**
 * Locate the clock panel of the time-picker.
 * @param page Browser page.
 * @returns Locator for the clock panel.
 */
function getPanel(page: Page): Locator {
  return page.getByTestId('timeId_cc-timePicker_panel');
}

/**
 * Locate the hour listbox column inside the clock panel (first of the two columns).
 * @param page Browser page.
 * @returns Locator for the hour listbox.
 */
function getHourColumn(page: Page): Locator {
  return getPanel(page).locator('.clock-column').nth(0);
}

/**
 * Locate the minute listbox column inside the clock panel (second of the two columns).
 * @param page Browser page.
 * @returns Locator for the minute listbox.
 */
function getMinuteColumn(page: Page): Locator {
  return getPanel(page).locator('.clock-column').nth(1);
}

/**
 * Locate a specific hour option inside the time-picker.
 * @param page Browser page.
 * @param hour Hour value (0-23).
 * @returns Locator for the hour option.
 */
function getHour(page: Page, hour: number): Locator {
  return page.getByTestId(`timeId_cc-timePicker_h${hour}`);
}

/**
 * Locate a specific minute option inside the time-picker.
 * @param page Browser page.
 * @param minute Minute value (0-59).
 * @returns Locator for the minute option.
 */
function getMinute(page: Page, minute: number): Locator {
  return page.getByTestId(`timeId_cc-timePicker_m${minute}`);
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
 * Locate the value display div next to the time-picker using data-testid.
 * @param page Browser page.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page): Locator {
  return page.getByTestId('cc-timePicker-value');
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
 * Install a page-level focusout counter, so tests can prove the component never blurred.
 * A blur is what makes the picker close itself and emit `touch`, so a zero count also proves
 * no spurious touch was reported.
 * @param page Browser page.
 */
async function installFocusoutCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { focusoutCount?: number };
    w.focusoutCount = 0;
    document.addEventListener('focusout', () => {
      w.focusoutCount = (w.focusoutCount ?? 0) + 1;
    }, true);
  });
}

/**
 * Read the focusout counter installed by {@link installFocusoutCounter}.
 * @param page Browser page.
 * @returns Number of focusout events recorded since installation.
 */
async function readFocusoutCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { focusoutCount?: number }).focusoutCount ?? 0);
}

/**
 * Select a deterministic time (14:30) through mouse interaction.
 * Uses fixed values so assertions do not depend on the current time.
 * Note: picking the minute closes the panel and leaves focus on the input.
 * @param page Browser page.
 */
async function selectTimeViaMouse(page: Page): Promise<void> {
  await getTimePicker(page).click();
  await getHour(page, 14).click();
  await getMinute(page, 30).click();
}

/**
 * E2e tests of time-picker component in form present in page-custom-components.
 * Covers interactions that are hard to unit test: real focus flows, signal form propagation
 * and real i18n assets.
 */
test.describe('TimePicker', () => {
  test.describe('clicking', () => {
    test('should open panel on click and select time', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);

      // Assert: Initial state is null and panel closed.
      await expect(getValueDisplay(page)).toContainText('❓');
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');

      // Act: Open the panel.
      await timePicker.click();

      // Assert: Panel is visible and expanded.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page)).toBeVisible();

      // Act: Pick hour 14 and minute 30.
      await getHour(page, 14).click();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true'); // Hour picking keeps the panel open for the minute.
      await getMinute(page, 30).click();

      // Assert: Input shows formatted time and raw value propagated to form display.
      await expect(timePicker).toHaveValue('🕜 14:30');
      await expect(getValueDisplay(page)).toContainText('T14:30:00');

      // Assert: Picking the minute completes the selection - panel closes, focus returns to input.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).toBeFocused();
    });

    test('should close panel on second click', async ({ page }) => {
      // Arrange: Navigate to the custom components page and open the panel.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);
      await timePicker.click();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');

      // Act: Click the time input again.
      await timePicker.click();

      // Assert: Panel is closed.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
    });

    test('should close panel when clicking outside and keep selected value', async ({ page }) => {
      // Arrange: Navigate and select a time (minute selection closes the panel on its own).
      await goToComponentsPage(page);
      await selectTimeViaMouse(page);
      await expect(getTimePicker(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getValueDisplay(page)).toContainText('T14:30:00');

      // Act: Reopen the panel, then click page heading (moves focus away from the picker).
      await getTimePicker(page).click();
      await expect(getTimePicker(page)).toHaveAttribute('aria-expanded', 'true');
      await page.locator('h1').click();

      // Assert: Panel closed via real focusout flow, selected value retained.
      await expect(getTimePicker(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getValueDisplay(page)).toContainText('T14:30:00');
    });

    test('should keep panel open and focus inside when clicking its padding or border', async ({ page }) => {
      // Arrange: Navigate and open the panel (focus lands in the hour column after opening).
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);
      await timePicker.click();
      await expect(getHourColumn(page)).toBeFocused();
      // Mouse open seeds focus state too, so the focused option is announced to AT.
      await expect(getHourColumn(page)).toHaveAttribute('aria-activedescendant', /timeId_cc-timePicker_opt_h\d+/);
      await installFocusoutCounter(page);

      // Act: Click the top-left chrome of the panel (1px border + 8px padding).
      await getPanel(page).click({ position: { x: 5, y: 5 } });

      // Assert: Panel stays open and focus stays in the column. No focusout at all means the
      // component never blurred, so no spurious touch was emitted either.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();
      expect(await readFocusoutCount(page), 'clicking panel padding must not blur the component').toBe(0);

      // Act: Click the left border in the middle of the panel height.
      const panelHeight = await getPanel(page).evaluate((el) => el.getBoundingClientRect().height);
      await getPanel(page).click({ position: { x: 0.5, y: panelHeight / 2 } });

      // Assert: Border behaves like padding - still open, still focused, still no blur.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();
      expect(await readFocusoutCount(page), 'clicking panel border must not blur the component').toBe(0);

      // Act: Keyboard navigation after the chrome clicks.
      await getHourColumn(page).press('ArrowDown');

      // Assert: Focus is still tracked on the column, so arrow keys keep working.
      await expect(getHourColumn(page)).toHaveAttribute('aria-activedescendant', /timeId_cc-timePicker_opt_h\d+/);
    });
  });

  test.describe('label', () => {
    test('should have accessible name from label', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Assert: aria-labelledby points to the label element's id.
      await expect(getTimePicker(page)).toHaveAttribute('aria-labelledby', 'cc-timePicker-label');
    });

    // Label activation lands on the wrapper's hidden button, whose focusRoot() redirects into the
    // sub-picker input; focusing that input auto-opens the clock panel and moves keyboard focus
    // into the hour listbox - the same end state as clicking the input or Tab-ing into it.
    test('should focus hour listbox and open panel when label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Click the label of the date-time-picker instance that renders only the time sub-picker.
      const label = page.locator('label#cc-timePicker-label');
      await label.click();

      // Assert: Time picker is expanded and focus sits in its hour listbox.
      await expect(getTimePicker(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();
    });
  });

  test.describe('keyboard', () => {
    test('should close panel and refocus input on Escape without reopening', async ({ page }) => {
      // Arrange: Navigate and open the panel (focus lands in the hour column after opening).
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);
      await timePicker.click();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');

      // Act: Press Escape while the hour listbox is focused.
      await getHourColumn(page).press('Escape');

      // Assert: Panel closed and focus returned to input. The programmatic refocus must not
      // trigger the auto-open (regression for the suppressFocusOpen fix).
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).toBeFocused();
    });

    test('should select time via keyboard and move focus to submit button', async ({ page }) => {
      // Arrange: Select a deterministic time with the mouse (minute selection closes the panel
      // and returns focus to the input, so no Escape is needed to get back to it).
      await goToComponentsPage(page);
      await selectTimeViaMouse(page);
      const timePicker = getTimePicker(page);
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).toBeFocused();

      // Act: Open the panel via keyboard (seeds keyboard focus state from the selected value).
      await timePicker.press('Enter');

      // Assert: Hour listbox focused with activedescendant pointing at the selected hour.
      await expect(getHourColumn(page)).toBeFocused();
      await expect(getHourColumn(page)).toHaveAttribute('aria-activedescendant', 'timeId_cc-timePicker_opt_h14');

      // Act: Move keyboard focus to hour 15.
      await getHourColumn(page).press('ArrowDown');

      // Assert: Activedescendant moved and option shows keyboard focus outline.
      await expect(getHourColumn(page)).toHaveAttribute('aria-activedescendant', 'timeId_cc-timePicker_opt_h15');
      await expect(getHour(page, 15)).toHaveClass(/focused/);
      await expect(getHour(page, 15)).toHaveCSS('outline-style', 'solid');

      // Act: Confirm hour 15 (moves focus to minute column, seeded with minute 30).
      await getHourColumn(page).press('Enter');

      // Assert: Focus switched to minute column with activedescendant at selected minute.
      await expect(getMinuteColumn(page)).toBeFocused();
      await expect(getMinuteColumn(page)).toHaveAttribute('aria-activedescendant', 'timeId_cc-timePicker_opt_m30');

      // Act: Confirm minute 30 (closes panel and moves focus to next focusable element).
      await getMinuteColumn(page).press('Enter');

      // Assert: Panel closed, focus on submit button, value propagated through the form.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();
      await expect(timePicker).toHaveValue('🕜 15:30');
      await expect(getValueDisplay(page)).toContainText('T15:30:00');
    });

    test('should navigate from previous picker to time-picker to submit on Tab presses', async ({ page }) => {
      // Arrange: Start keyboard modality on the previous picker (datetime row's time input).
      await goToComponentsPage(page);
      await page.getByTestId('timeId_cc-dateTimePicker_input').focus();

      // Act: Tab into the time-picker.
      await page.keyboard.press('Tab');

      // Assert: Panel opened and focus moved into the hour listbox.
      const timePicker = getTimePicker(page);
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page)).toBeVisible();
      await expect(getHourColumn(page)).toBeFocused();

      // Assert: Focus state is seeded on open, so the focused option is both announced
      // (aria-activedescendant) and visibly marked - regression guard: seeding used to run only
      // for keyboard-open, and with the listbox container's ring suppressed in CSS a user tabbing
      // in had no focus indication at all until the first arrow press.
      await expect(getHourColumn(page)).toHaveAttribute('aria-activedescendant', /timeId_cc-timePicker_opt_h\d+/);
      const activeHourId = await getHourColumn(page).getAttribute('aria-activedescendant');
      const focusedHourOption = page.locator(`[id="${activeHourId ?? ''}"]`);
      await expect(focusedHourOption, 'focused hour option should carry the focused class').toHaveClass(/focused/);
      await expect(focusedHourOption, 'focused hour option should show a solid focus ring').toHaveCSS('outline-style', 'solid');

      // Act: Tab again — one press must close panel AND move focus out.
      await page.keyboard.press('Tab');

      // Assert: Focus moved to submit button; panel closed.
      await expect(page.getByRole('button', { name: 'Submit' })).toBeFocused();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
    });

    test('should navigate backwards from submit to time-picker to previous picker on Shift+Tab presses', async ({ page }) => {
      // Arrange: Start keyboard modality on the submit button (the element after the time-picker).
      await goToComponentsPage(page);
      await page.getByRole('button', { name: 'Submit' }).focus();

      // Act: Shift+Tab into the time-picker.
      await page.keyboard.press('Shift+Tab');

      // Assert: Panel opened and focus moved into the hour listbox (picker properly selected).
      const timePicker = getTimePicker(page);
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page)).toBeVisible();
      await expect(getHourColumn(page)).toBeFocused();

      // Act: Shift+Tab again — one press must close panel AND move focus out backwards.
      await page.keyboard.press('Shift+Tab');

      // Assert: Focus moved to previous picker (datetime row's time input, which auto-opens on
      // focus); our panel closed and our input no longer holds focus.
      const previousPicker = page.getByTestId('timeId_cc-dateTimePicker_input');
      await expect(previousPicker).toHaveAttribute('aria-expanded', 'true');
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).not.toBeFocused();
    });
  });

  test.describe('display', () => {
    test('should render translated placeholder and column headers from real i18n assets', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);

      // Assert: Placeholder and aria-label come from the real translation files.
      await expect(timePicker).toHaveAttribute('placeholder', '🕜 hh:mm');
      await expect(timePicker).toHaveAttribute('aria-label', 'hh:mm');

      // Act: Open the panel.
      await timePicker.click();

      // Assert: Column headers show translated labels.
      await expect(getPanel(page).locator('.column-header').nth(0)).toHaveText('Hour');
      await expect(getPanel(page).locator('.column-header').nth(1)).toHaveText('Minute');
    });
  });

  test.describe('states', () => {
    test('should render disabled state and not open when mode is set to Disabled', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled" mode (index 1) on the mode radioBox.
      await getModeOption(page, 1).click();

      // Assert: Time input is natively disabled with matching ARIA/tabindex.
      const timePicker = getTimePicker(page);
      await expect(timePicker).toBeDisabled();
      await expect(timePicker).toHaveAttribute('aria-disabled', 'true');
      await expect(timePicker).toHaveAttribute('tabindex', '-1');

      // Act: Force a click at the input. Native disabled inputs do not dispatch mouse events,
      // so this only verifies the panel cannot open in disabled state.
      await timePicker.click({ force: true });

      // Assert: Panel does not open.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
    });

    test('should render invalid state but still open when mode is set to Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Error" mode (index 2) on the mode radioBox.
      await getModeOption(page, 2).click();

      // Assert: Time input has invalid class and aria-invalid.
      const timePicker = getTimePicker(page);
      await expect(timePicker).toHaveClass(/invalid/);
      await expect(timePicker).toHaveAttribute('aria-invalid', 'true');

      // Act: Invalid state is visual only — open the panel.
      await timePicker.click();

      // Assert: Panel opens normally.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page)).toBeVisible();
    });

    test('should render disabled state when mode is Disabled & Error', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Select "Disabled & Error" mode (index 3) on the mode radioBox.
      await getModeOption(page, 3).click();

      // Assert: Time input is disabled. Invalid markers are not present because Angular Signal
      // Forms skips validation on disabled fields.
      const timePicker = getTimePicker(page);
      await expect(timePicker).toBeDisabled();
      await expect(timePicker).toHaveAttribute('aria-disabled', 'true');
      await expect(timePicker).not.toHaveClass(/invalid/);
      await expect(timePicker).not.toHaveAttribute('aria-invalid');
    });
  });

  test.describe('accessibility', () => {
    test('is correct axe-wise with panel open', async ({ page }) => {
      // Arrange: Navigate and open the panel so its dialog/listbox markup is analyzed too.
      await goToComponentsPage(page);
      await getTimePicker(page).click();
      await expect(getPanel(page)).toBeVisible();

      // Act: Run axe against the page with the panel open. The scrollable-region-focusable
      // rule is disabled: the clock columns use tabindex=-1 (standard combobox popup pattern —
      // the input is the tab stop) and receive focus programmatically when the panel opens,
      // so they are keyboard-operable via arrow keys even though not in the tab order.
      // Making them tabindex=0 would insert them into tab order and break Tab-out behavior.
      const results = await new AxeBuilder({ page })
        .disableRules(['scrollable-region-focusable'])
        .analyze();

      // Assert: No accessibility violations.
      expect(results.violations).toEqual([]);
    });
  });
});
