import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** English month names, used to derive expected dates from the calendar header (real i18n output). */
const ENGLISH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
 * Locate the clock panel of the datetime row's time sub-picker.
 * @param page Browser page.
 * @returns Locator for the clock panel.
 */
function getClockPanel(page: Page): Locator {
  return page.getByTestId('timeId_cc-dateTimePicker_panel');
}

/**
 * Locate the hour listbox column of the datetime row's clock panel (first of the two columns).
 * Landing focus on the time input auto-opens the clock and moves keyboard focus into this
 * column, so the column (not the input) is the observable end state of "focus arrived at the
 * time sub-picker".
 * @param page Browser page.
 * @returns Locator for the hour column.
 */
function getHourColumn(page: Page): Locator {
  return getClockPanel(page).locator('.clock-column').nth(0);
}

/**
 * Locate a specific hour option of the datetime row's clock.
 * @param page Browser page.
 * @param hour Hour value (0-23).
 * @returns Locator for the hour option.
 */
function getHour(page: Page, hour: number): Locator {
  return page.getByTestId(`timeId_cc-dateTimePicker_h${hour}`);
}

/**
 * Locate a specific minute option of the datetime row's clock.
 * @param page Browser page.
 * @param minute Minute value (0-59).
 * @returns Locator for the minute option.
 */
function getMinute(page: Page, minute: number): Locator {
  return page.getByTestId(`timeId_cc-dateTimePicker_m${minute}`);
}

/**
 * Locate the value display div next to the datetime row - it renders the SHARED form value
 * both sub-pickers write into through the wrapper's `[(value)]` model.
 * @param page Browser page.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page): Locator {
  return page.getByTestId('cc-dateTimePicker-value');
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
 * Read the current calendar header text (e.g. `2026 October`) from an open panel.
 * @param page Browser page.
 * @returns Trimmed header text.
 */
async function readHeader(page: Page): Promise<string> {
  const text = await getPanel(page).locator('.header-title').textContent();
  return (text ?? '').trim();
}

/**
 * Parse a calendar header into its numeric year and month index. Fails loudly when the month name
 * is not one of the English names, which doubles as an assertion that the header is translated
 * from the real i18n assets instead of showing a raw translation key.
 * @param header Header text in the `YYYY MonthName` format.
 * @returns Parsed year and zero-based month index.
 */
function parseHeader(header: string): { year: number; monthIndex: number } {
  const [yearPart, ...monthParts] = header.split(' ');
  const monthName = monthParts.join(' ');
  const monthIndex = ENGLISH_MONTHS.indexOf(monthName);
  if (!/^\d{4}$/.test(yearPart ?? '') || monthIndex < 0) {
    throw new Error(`Unexpected calendar header "${header}" - expected "YYYY ${ENGLISH_MONTHS.join('|')}"`);
  }
  return { year: Number(yearPart), monthIndex };
}

/**
 * Format the date a header plus day number refers to, mirroring the component's UTC-carried value.
 * @param header Header text in the `YYYY MonthName` format.
 * @param day Day of that month (1-31).
 * @returns Date as `YYYY-MM-DD`.
 */
function formatDay(header: string, day: number): string {
  const { year, monthIndex } = parseHeader(header);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Locate a specific day cell of the currently viewed month. Day cells carry an accessible name of
 * `year translatedMonth day`, which is unique per day: padding cells of adjacent months announce
 * their own month name, so they never match the header-derived name.
 * @param page Browser page.
 * @param header Header text of the open panel (`YYYY MonthName`).
 * @param day Day of the viewed month (1-31).
 * @returns Locator for the day cell.
 */
function getDayCell(page: Page, header: string, day: number): Locator {
  return getPanel(page).getByRole('gridcell', { name: `${header} ${day}`, exact: true });
}

/**
 * Open the datetime row's calendar and pick a deterministic day through mouse interaction.
 * The header is read AFTER the open, so the expected value is derived from the month the panel
 * actually shows instead of the machine's clock. The pick commits and closes the calendar,
 * leaving focus on the date input.
 * @param page Browser page.
 * @param day Day of the viewed month to pick. Defaults to 15 (always exists in any month).
 * @returns The committed date as `YYYY-MM-DD`.
 */
async function pickDay(page: Page, day: number = 15): Promise<string> {
  await getDateInput(page).click();
  await expect(getGrid(page)).toBeVisible();
  const header = await readHeader(page);
  await getDayCell(page, header, day).click();
  return formatDay(header, day);
}

/**
 * Commit a deterministic time (14:30) through the datetime row's clock via mouse interaction.
 * The hour pick stays partial (panel open, value untouched); the minute pick completes the
 * session, which commits the value, closes the clock and leaves focus on the time input.
 * @param page Browser page.
 */
async function selectTime(page: Page): Promise<void> {
  await getTimeInput(page).click();
  await expect(getHourColumn(page)).toBeVisible();
  await getHour(page, 14).click();
  await expect(getTimeInput(page), 'hour pick must stay partial and keep the clock open').toHaveAttribute('aria-expanded', 'true');
  await getMinute(page, 30).click();
}

/**
 * E2e tests of the DateTimePicker wrapper on the dev page, all on the `cc-dateTimePicker` row in
 * mode="datetime" - the mode that renders BOTH sub-pickers plus their name qualifiers, so the
 * wrapper-level logic is exercised: label activation weighing two visibility signals, real focus
 * containment between the two inputs, outside press against the wrapper boundary, and the shared
 * form value both sub-pickers write into. The label tests reproduce the real activation order of
 * each browser project (focus-then-click on Chromium/Firefox, click-then-focus on WebKit), which
 * is exactly what unit tests can only simulate.
 */
test.describe('DateTimePicker', () => {
  test.describe('clicking', () => {
    test('should commit a date and a time through both sub-pickers into the form value', async ({ page }) => {
      // Arrange: Navigate to the custom components page; the shared value starts unset.
      await goToComponentsPage(page);
      await expect(getValueDisplay(page)).toContainText('❓');

      // Act: Pick a deterministic day through the calendar.
      const day = await pickDay(page);

      // Assert: The date committed at midnight, the calendar closed itself and the clock
      // never opened - one sub-picker's session must not wake the sibling.
      await expect(getDateInput(page)).toHaveValue(day);
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getTimeInput(page), 'the clock must stay closed after a date pick').toHaveAttribute('aria-expanded', 'false');
      await expect(getValueDisplay(page)).toContainText(`${day}T00:00:00`);

      // Act: Pick 14:30 through the clock (hour stays partial, minute completes the session).
      await getTimeInput(page).click();
      await expect(getHourColumn(page)).toBeFocused();
      await getHour(page, 14).click();

      // Assert: An hour-only session must not commit - the form still carries the midnight
      // time the date pick produced, and the clock stays open for the minute column.
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getValueDisplay(page), 'partial time pick must not rewrite the value').toContainText(`${day}T00:00:00`);

      // Act: Complete the session with minute 30.
      await getMinute(page, 30).click();

      // Assert: The completed session committed BOTH parts into the single shared value -
      // sub-inputs agree with it, the clock closed and focus parked on its input.
      await expect(getTimeInput(page)).toHaveValue('14:30');
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getTimeInput(page)).toBeFocused();
      await expect(getDateInput(page)).toHaveValue(day);
      await expect(getValueDisplay(page)).toContainText(`${day}T14:30:00`);
    });

    test('should close the calendar and keep the committed value when clicking outside after label activation', async ({ page }) => {
      // Arrange: Commit a deterministic day, then reopen the calendar THROUGH THE LABEL so
      // keyboard focus sits in the grid - the state only label activation produces.
      await goToComponentsPage(page);
      const day = await pickDay(page);
      await expect(getValueDisplay(page)).toContainText(`${day}T00:00:00`);
      await getLabel(page).click();
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getGrid(page)).toBeFocused();

      // Act: Click the page heading (moves focus away from the wrapper entirely).
      await page.locator('h1').click();

      // Assert: The calendar closed through the real outside-press/blur flow, the committed
      // value survived, and the clock never opened along the way.
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getTimeInput(page), 'the clock must stay closed throughout').toHaveAttribute('aria-expanded', 'false');
      await expect(getValueDisplay(page)).toContainText(`${day}T00:00:00`);
    });

    test('should close the clock and keep the committed value when clicking the outside Submit button', async ({ page }) => {
      // Arrange: Commit a deterministic time through the clock (minute pick closes it), then
      // reopen the clock so focus sits in the hour listbox.
      await goToComponentsPage(page);
      await selectTime(page);
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getValueDisplay(page)).toContainText('T14:30:00');
      await getTimeInput(page).click();
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();

      // Act: Click the Submit button outside the picker. Buttons are not click-focused on
      // macOS WebKit and pressing one does not reliably blur the focused listbox, so the
      // focusout-only close never fired there - the document-level mousedown guard is what
      // has to close the panel (regression guard for the outside-press fix).
      await page.getByRole('button', { name: 'Submit' }).click();

      // Assert: The clock closed by the press itself and the committed value was retained.
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getClockPanel(page)).toBeHidden();
      await expect(getValueDisplay(page)).toContainText('T14:30:00');
    });
  });

  test.describe('keyboard', () => {
    test('should hand focus from the calendar grid to the clock and back within one wrapper on Tab and Shift+Tab', async ({ page }) => {
      // Arrange: Open the calendar; the open path moves keyboard focus into its grid.
      await goToComponentsPage(page);
      await getDateInput(page).click();
      await expect(getGrid(page)).toBeFocused();
      await expect(getTimeInput(page), 'precondition: clock starts closed').toHaveAttribute('aria-expanded', 'false');

      // Act: Tab - native forward traversal from the grid. The wrapper's tab order is
      // date input -> grid -> time input (nav buttons and clock columns carry tabindex=-1),
      // so the next tab stop is the SIBLING input of the same wrapper.
      await page.keyboard.press('Tab');

      // Assert: Focus arrived at the time input, which auto-opened the clock and steered
      // focus into its hour listbox, while the wrapper's focusin handler closed the calendar.
      // Unit tests can only approximate this by focusing the input directly - here the real
      // browser traversal, the open path and the sibling close all run for real.
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getPanel(page), 'calendar must close when focus moves to the sibling input').toBeHidden();

      // Act: Shift+Tab - backwards from the hour listbox. The picker hands focus to the
      // previous control, which inside this wrapper is the date input; its focus handler
      // reopens the calendar and moves focus back into the grid.
      await page.keyboard.press('Shift+Tab');

      // Assert: The round trip is complete - clock closed, calendar reopened with keyboard
      // focus in its grid, and no value appeared along the way.
      await expect(getTimeInput(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(getClockPanel(page)).toBeHidden();
      await expect(getDateInput(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(getGrid(page)).toBeFocused();
      await expect(getValueDisplay(page), 'focus hand-off must not fabricate a value').toContainText('❓');
    });
  });

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

  test.describe('accessibility', () => {
    test('is correct axe-wise with the calendar open in datetime mode', async ({ page }) => {
      // Arrange: Open the calendar of the datetime row - BOTH sub-pickers and their distinct
      // name qualifiers are on the page, plus the open dialog/grid markup of the panel.
      await goToComponentsPage(page);
      await getDateInput(page).click();
      await expect(getPanel(page)).toBeVisible();
      await expect(getGrid(page)).toBeFocused();

      // Act: Run axe with every default rule - notably aria-required-children and
      // aria-required-parent, which the calendar grid satisfies through its role="row" wrappers.
      const results = await new AxeBuilder({ page }).analyze();

      // Assert: No accessibility violations.
      expect(results.violations).toEqual([]);
    });

    test('is correct axe-wise with the clock open in datetime mode', async ({ page }) => {
      // Arrange: Open the clock of the datetime row - its listbox/aria-activedescendant markup
      // is analyzed while the sibling date input and qualifier are present too.
      await goToComponentsPage(page);
      await getTimeInput(page).click();
      await expect(getClockPanel(page)).toBeVisible();
      await expect(getHourColumn(page)).toBeFocused();

      // Act: Run axe against the page with the clock open. The two clock columns are excluded
      // NODE-WISE instead of disabling the whole rule, so scrollable-region-focusable keeps
      // guarding the rest of the page - same contract as the standalone time-picker's open-panel
      // axe test: the columns are `overflow-y: auto` listboxes whose options are plain divs and
      // whose own tabindex=-1 keeps them out of the tab order (the input is the tab stop), yet
      // they ARE keyboard-operable - they take programmatic focus on open and arrow/Home/End/
      // PageUp/PageDown scroll them, so WCAG 2.1.1 is met. tabindex=0 would insert them into the
      // tab order and break the Tab-out behavior the keyboard test above relies on.
      const results = await new AxeBuilder({ page })
        .exclude('.clock-column')
        .analyze();

      // Assert: No accessibility violations.
      expect(results.violations).toEqual([]);
    });
  });
});
