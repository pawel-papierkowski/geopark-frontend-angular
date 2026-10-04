import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Locate the date input of the datetime-mode DateTimePicker row. The page hosts several
 * picker instances, so the ident prefix `dateId_cc-dateTimePicker` distinguishes this one.
 * @param page Browser page.
 * @returns Locator for the date sub-picker input.
 */
function getDateInput(page: Page): Locator {
  return page.getByTestId('dateId_cc-dateTimePicker_input');
}

/**
 * Locate the time input of the datetime-mode DateTimePicker row.
 * @param page Browser page.
 * @returns Locator for the time sub-picker input.
 */
function getTimeInput(page: Page): Locator {
  return page.getByTestId('timeId_cc-dateTimePicker_input');
}

/**
 * Locate the calendar panel of the datetime row's date sub-picker.
 * @param page Browser page.
 * @returns Locator for the calendar panel.
 */
function getPanel(page: Page): Locator {
  return page.getByTestId('dateId_cc-dateTimePicker_panel');
}

/**
 * Locate the calendar grid - the focus container of the open panel (tabindex=0 while visible).
 * @param page Browser page.
 * @returns Locator for the calendar grid.
 */
function getGrid(page: Page): Locator {
  return getPanel(page).locator('.calendar-grid');
}

/**
 * Locate the label of the datetime row. Its `<label for>` points at the wrapper's hidden
 * button (id = the wrapper's ident), so clicking it runs the wrapper's label activation -
 * in the REAL order the browser under test uses (Chromium/Firefox focus the hidden button
 * first and forward the click second, WebKit does the reverse).
 * @param page Browser page.
 * @returns Locator for the label element.
 */
function getLabel(page: Page): Locator {
  return page.getByTestId('cc-dateTimePicker-label');
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
 * E2e tests of the DateTimePicker label activation in mode="datetime" on the dev page.
 * This mode renders BOTH sub-pickers, so the wrapper's "was the panel closed before this
 * activation" computation weighs two visibility signals - the single-mode rows never reach
 * that branch. The tests reproduce the real label activation order of each browser project
 * (focus-then-click on Chromium/Firefox, click-then-focus on WebKit), which is exactly what
 * unit tests can only simulate.
 */
test.describe('DateTimePicker', () => {
  test.describe('label', () => {
    test('should open the calendar and focus its grid when the label is clicked', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Act: Click the label of the datetime row (first activation opens through the focus
      // redirect; the forwarded click must be swallowed so it does not toggle shut again).
      await getLabel(page).click();

      // Assert: Calendar is expanded with keyboard focus in its grid, clock stays closed.
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getGrid(page)).toBeFocused();
      await expect(getTimeInput(page), 'the clock must stay closed in datetime mode').toHaveAttribute('aria-expanded', 'false');
    });

    test('should close the calendar and park focus on the date input on second label click', async ({ page }) => {
      // Arrange: Navigate and open the calendar through the first label click.
      await goToComponentsPage(page);
      await getLabel(page).click();
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getGrid(page)).toBeFocused();

      // Act: Click the label a second time - with the calendar OPEN the activation must not
      // arm the focus-open swallow, so the forwarded click toggles the panel shut. Regression
      // guard: a "at least one panel closed" reading of the state was trivially true in this
      // mode, swallowed every click and left the calendar open on Chromium.
      await getLabel(page).click();

      // Assert: The calendar closed and focus parked on the date input - the same end state
      // as clicking the input twice. The clock never opened along the way.
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getDateInput(page)).toBeFocused();
      await expect(getTimeInput(page), 'the clock must stay closed throughout').toHaveAttribute('aria-expanded', 'false');
    });
  });
});
