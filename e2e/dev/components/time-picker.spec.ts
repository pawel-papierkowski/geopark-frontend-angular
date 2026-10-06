import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Locate the time-picker input on the custom components page.
 * The page hosts two time-picker instances (datetime row and time row), so the ident prefix
 * `timeId_cc-timePicker` is what distinguishes this instance.
 * @param page Browser page.
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the time-picker input.
 */
function getTimePicker(page: Page, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId('timeId_cc-timePickerNull_input');
  return page.getByTestId('timeId_cc-timePicker_input');
}

/**
 * Locate the clock panel of the time-picker.
 * @param page Browser page.
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the clock panel.
 */
function getPanel(page: Page, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId('timeId_cc-timePickerNull_panel');
  return page.getByTestId('timeId_cc-timePicker_panel');
}

/**
 * Locate the hour listbox column inside the clock panel (first of the two columns).
 * @param page Browser page.
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the hour listbox.
 */
function getHourColumn(page: Page, wantNullable: boolean = false): Locator {
  return getPanel(page, wantNullable).locator('.clock-column').nth(0);
}

/**
 * Locate the minute listbox column inside the clock panel (second of the two columns).
 * @param page Browser page.
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the minute listbox.
 */
function getMinuteColumn(page: Page, wantNullable: boolean = false): Locator {
  return getPanel(page, wantNullable).locator('.clock-column').nth(1);
}

/**
 * Locate a specific hour option inside the time-picker.
 * @param page Browser page.
 * @param hour Hour value (0-23).
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the hour option.
 */
function getHour(page: Page, hour: number, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId(`timeId_cc-timePickerNull_h${hour}`);
  return page.getByTestId(`timeId_cc-timePicker_h${hour}`);
}

/**
 * Locate a specific minute option inside the time-picker.
 * @param page Browser page.
 * @param minute Minute value (0-59).
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the minute option.
 */
function getMinute(page: Page, minute: number, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId(`timeId_cc-timePickerNull_m${minute}`);
  return page.getByTestId(`timeId_cc-timePicker_m${minute}`);
}

/**
 * Locate the decorative clock glyph of the time-picker. It renders inside the input's box but
 * outside its value, so screen readers never announce it as part of the time.
 * @param page Browser page.
 * @returns Locator for the decorative icon span.
 */
function getTimeIcon(page: Page): Locator {
  return page.getByTestId('timeId_cc-timePicker_icon');
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
 * @param wantNullable False if you want base component, true if you want nullable version of component.
 * @returns Locator for the value display div.
 */
function getValueDisplay(page: Page, wantNullable: boolean = false): Locator {
  if (wantNullable) return page.getByTestId('cc-timePickerNull-value');
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
 * The hour pick stays partial; the minute pick completes the session, which commits the value,
 * closes the panel and leaves focus on the input.
 * @param page Browser page.
 */
async function selectTimeViaMouse(page: Page): Promise<void> {
  await getTimePicker(page).click();
  await getHour(page, 14).click();
  await getMinute(page, 30).click();
}

/** One entry of the page-side event log. */
interface LoggedEvent {
  /** Event sequence number (stable ordering). */
  seq: number;
  /** Marker pushed by the test before each label click, `step` type only. */
  type: string;
  /** performance.now() at logging time. */
  t: number;
  /** Described event target. */
  target?: string;
  /** Described relatedTarget (focus events). */
  related?: string;
  /** Whether mousedown default was already prevented when observed. */
  defaultPrevented?: boolean;
  /** Described document.elementFromPoint() at the mousedown point. */
  atPoint?: string;
  /** Described document.activeElement at logging time. */
  active?: string;
  /** aria-expanded of the time input at logging time (best effort, may lag CD). */
  expanded?: string | null;
  /** Whether the event was user-trusted. */
  trusted?: boolean;
  /** true when logged after the event dispatch settled (post handlers). */
  settled?: boolean;
  /** window.scrollY at logging time. */
  scrollY?: number;
}

/**
 * Install page-side event listeners recording every interaction relevant to the label
 * toggle state machine into `window.__eventLog`. Events are logged once on dispatch and
 * once more on a microtask after their dispatch settled, so handler side effects
 * (e.g. panel opened by a focus handler) are visible.
 * @param page Browser page.
 */
async function installEventLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __eventLog: LoggedEvent[]; __seq: number };
    w.__eventLog = [];
    w.__seq = 0;

    /** Render an element as a readable `tag#id.class1.class2` string. */
    const describe = (el: Element | null): string => {
      if (el === null) return 'null';
      if (el === document.body) return 'body';
      if (el === document.documentElement) return 'html';
      const id = el.id !== '' ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className.trim() !== ''
        ? `.${el.className.trim().split(/\s+/).join('.')}`
        : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    /** Push one log entry. */
    const rec = (type: string, ev: Event, settled: boolean): void => {
      const input = document.querySelector('[data-testid="timeId_cc-timePicker_input"]');
      const focusEv = ev as FocusEvent;
      const mouseEv = ev as MouseEvent;
      const entry: LoggedEvent = {
        seq: w.__seq++,
        type,
        t: Math.round(performance.now()),
        settled,
        active: describe(document.activeElement instanceof Element ? document.activeElement : null),
        expanded: input !== null ? input.getAttribute('aria-expanded') : null,
        scrollY: Math.round(window.scrollY),
      };
      if (ev.target instanceof Element) entry.target = describe(ev.target);
      if ('relatedTarget' in focusEv) entry.related = describe(focusEv.relatedTarget instanceof Element ? focusEv.relatedTarget : null);
      if ('isTrusted' in ev) entry.trusted = ev.isTrusted;
      if (type === 'mousedown') {
        entry.defaultPrevented = ev.defaultPrevented;
        entry.atPoint = describe(document.elementFromPoint(mouseEv.clientX, mouseEv.clientY));
      }
      w.__eventLog.push(entry);
      if (!settled) queueMicrotask(() => rec(type, ev, true));
    };

    // focus/blur do not bubble - capture phase is the only way to see them everywhere.
    for (const type of ['focus', 'blur']) {
      document.addEventListener(type, (e) => rec(type, e, false), true);
    }
    // Bubbling events: document bubble phase runs after component handlers, so
    // defaultPrevented and side effects of the same event are already visible.
    for (const type of ['mousedown', 'mouseup', 'click', 'focusin', 'focusout']) {
      document.addEventListener(type, (e) => rec(type, e, false));
    }
  });
}

/**
 * Push a step marker into the log so the failing activation can be located easily.
 * @param page Browser page.
 * @param step Step number about to run.
 */
async function markStep(page: Page, step: number): Promise<void> {
  await page.evaluate((n) => {
    const w = window as unknown as { __eventLog: LoggedEvent[]; __seq: number };
    w.__eventLog.push({ seq: w.__seq++, type: `step ${n}`, t: Math.round(performance.now()) });
  }, step);
}

/**
 * Read the accumulated page-side event log.
 * @param page Browser page.
 * @returns Logged events in order.
 */
async function readEventLog(page: Page): Promise<LoggedEvent[]> {
  return page.evaluate(() => (window as unknown as { __eventLog: LoggedEvent[] }).__eventLog);
}

/**
 * Render the event log as aligned text lines for attachments and error messages.
 * @param log Events to render.
 * @returns Multi-line human-readable representation.
 */
function formatLog(log: LoggedEvent[]): string {
  return log.map((e) => {
    const parts = [`#${String(e.seq).padStart(4, '0')}`, `${String(e.t).padStart(6)}ms`, e.type];
    if (e.settled === true) parts.push('[settled]');
    if (e.target !== undefined) parts.push(`target=${e.target}`);
    if (e.related !== undefined) parts.push(`related=${e.related}`);
    if (e.atPoint !== undefined) parts.push(`atPoint=${e.atPoint}`);
    if (e.defaultPrevented !== undefined) parts.push(`prevented=${String(e.defaultPrevented)}`);
    if (e.active !== undefined) parts.push(`active=${e.active}`);
    if (e.expanded !== undefined) parts.push(`expanded=${String(e.expanded)}`);
    if (e.scrollY !== undefined) parts.push(`scrollY=${String(e.scrollY)}`);
    if (e.trusted !== undefined) parts.push(`trusted=${String(e.trusted)}`);
    return parts.join(' | ');
  }).join('\n');
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
      await expect(getValueDisplay(page), 'hour-only pick must not commit a value yet').toContainText('❓'); // The form is notified only by the completed session.
      await getMinute(page, 30).click();

      // Assert: Input shows formatted time and raw value propagated to form display.
      await expect(timePicker).toHaveValue('14:30');
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

    test('should close panel when clicking an outside button', async ({ page }) => {
      // Arrange: Navigate, select a deterministic time, then reopen the panel.
      await goToComponentsPage(page);
      await selectTimeViaMouse(page);
      await expect(getValueDisplay(page)).toContainText('T14:30:00');
      await getTimePicker(page).click();
      await expect(getTimePicker(page)).toHaveAttribute('aria-expanded', 'true');

      // Act: Click the Submit button outside the picker. Buttons are not click-focused on
      // macOS WebKit and pressing one does not reliably blur the focused listbox, so the
      // focusout-only close never fired there - the document-level mousedown guard is what
      // has to close the panel (regression guard for the outside-press fix).
      await page.getByRole('button', { name: 'Submit' }).click();

      // Assert: Panel closed by the press itself, selected value retained.
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

    test('should show the focus ring on the pressed minute, not the seeded one, while the button is held', async ({ page }) => {
      // Arrange: Open the panel with an empty value - the minute cursor is seeded from the
      // current time, which is exactly the stale default the ring used to flash on.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);
      await timePicker.click();
      await expect(getPanel(page)).toBeVisible();
      // aria-activedescendant is exposed only on the ACTIVE column, so first switch into the
      // minute column (focus open lands in the hour column) to be able to read the seed.
      await getHourColumn(page).press('ArrowRight');
      await expect(getMinuteColumn(page)).toBeFocused();
      const seeded = await getMinuteColumn(page).getAttribute('aria-activedescendant');
      const seededMinute = Number(seeded?.match(/_opt_m(\d+)$/)?.[1]);
      expect(Number.isFinite(seededMinute), 'precondition: minute cursor should be seeded on open').toBe(true);
      const pressedMinute = (seededMinute + 1) % 60;

      // Act: Press and hold an option one minute away (hover scrolls it into the column view).
      await getMinute(page, pressedMinute).hover();
      await page.mouse.down();

      // Assert: The browser paints in the mousedown-to-click gap, so the ring and the announced
      // active option must already sit on the pressed minute - not on the seeded default.
      await expect(page.locator('.time-minute.focused')).toHaveAttribute('data-testid', `timeId_cc-timePicker_m${pressedMinute}`);
      await expect(getMinuteColumn(page)).toHaveAttribute('aria-activedescendant', `timeId_cc-timePicker_opt_m${pressedMinute}`);

      // Act: Release - the click picks the pressed minute. With no hour picked yet the session
      // stays partial, so the value must stay empty (deferred commit) and the panel must stay
      // open for the hour pick.
      await page.mouse.up();

      // Assert: The minute-only pick registers (highlighted option) but commits nothing yet.
      await expect(timePicker, 'panel should stay open after a minute-only pick').toHaveAttribute('aria-expanded', 'true');
      await expect(getMinute(page, pressedMinute), 'picked minute should be highlighted').toHaveClass(/selected/);
      await expect(timePicker, 'minute-only pick must not commit a value').toHaveValue('');

      // Act: Complete the session by picking hour 14.
      await getHour(page, 14).click();

      // Assert: The completed session commits `14:<pressed>` through the form, closes the panel
      // and returns focus to the input.
      await expect(timePicker).toHaveValue(`14:${String(pressedMinute).padStart(2, '0')}`);
      await expect(getValueDisplay(page)).toContainText(`T14:${String(pressedMinute).padStart(2, '0')}:00`);
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).toBeFocused();
    });
  });

  test.describe('label', () => {
    test('should have accessible name from label', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);

      // Assert: aria-labelledby points to the label element's id and is the sole name source -
      // an aria-label fallback must stay off: accname gives aria-label precedence over native
      // labelling, so its presence would shadow a <label for> pointing at this input.
      await expect(getTimePicker(page)).toHaveAttribute('aria-labelledby', 'cc-timePicker-label');
      expect(await getTimePicker(page).getAttribute('aria-label'), 'labelled input must not carry an aria-label fallback').toBeNull();
    });

    // Label activation lands on the wrapper's hidden button: its focus handler redirects into the
    // sub-picker input; focusing that input auto-opens the clock panel and moves keyboard focus
    // into the hour listbox - the same end state as clicking the input or Tab-ing into it. The
    // forwarded click is swallowed on that first activation; every later one toggles the panel.
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

    test('should close panel and focus input on second label click', async ({ page }) => {
      // Arrange: Navigate and open the panel through the first label click.
      await goToComponentsPage(page);
      const label = page.locator('label#cc-timePicker-label');
      const timePicker = getTimePicker(page);
      await label.click();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();

      // Act: Click the label a second time (label activation refocuses the hidden button, which
      // must read as an internal focus move - no touch, no close+reopen flicker).
      await label.click();

      // Assert: Second activation toggles the panel closed and parks focus on the input - the
      // same end state as clicking the input twice (combo-box toggles on second label click too).
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).toBeFocused();
    });

    // Regression: opening the panel must not scroll the page under the user's cursor. The
    // placement flip used to reach the DOM only after focus() had already scrolled the viewport
    // to the baseline (below-the-fold) panel position - a ~122px page jump that moved the label
    // away between a human's mousedown and mouseup, so the browser retargeted the click to a
    // common ancestor and the toggle was silently lost (label clicks intermittently "did
    // nothing"). Raw mouse input (no Playwright stable-box/hit-target guards, no pauses between
    // clicks) in back-to-back bursts is what catches it; state is asserted per burst.
    test('should toggle panel on every label click in back-to-back raw mouse bursts', async ({ page }, info) => {
      test.setTimeout(60_000);
      const CLICKS_PER_BURST = 3;
      const BURSTS = 5;
      const DOWN_UP_DELAY_MS = 80;

      // Arrange: short viewport where the page (722px of content) is scrollable, so the bug's
      // pre-condition (panel opens below the fold) actually holds; instrument the event log so
      // a failure can be traced to the exact lost activation.
      await page.setViewportSize({ width: 1100, height: 600 });
      await goToComponentsPage(page);
      await installEventLog(page);
      const label = page.locator('label#cc-timePicker-label');
      const timePicker = getTimePicker(page);
      await expect(timePicker, 'panel should start closed').toHaveAttribute('aria-expanded', 'false');

      // Act + Assert: fire bursts of clicks with no pauses (re-aiming at the label's current
      // position, holding through any page movement), then assert the net toggle per burst.
      let expected = false;
      let step = 0;
      for (let burst = 1; burst <= BURSTS; burst++) {
        const firstStepOfBurst = step + 1;
        for (let j = 0; j < CLICKS_PER_BURST; j++) {
          step++;
          await markStep(page, step);
          const box = await label.boundingBox(); // aim at where the label IS right now
          if (box !== null) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(DOWN_UP_DELAY_MS);
            await page.mouse.up();
          }
          expected = !expected;
        }

        try {
          await expect(
            timePicker,
            `burst ${burst} (steps ${firstStepOfBurst}-${step}) should toggle the panel ${expected ? 'open' : 'closed'} despite rapid clicking`,
          ).toHaveAttribute('aria-expanded', String(expected), { timeout: 2000 });
        } catch (error) {
          // Assert: surface the failing burst together with the captured event trace.
          const log = await readEventLog(page);
          await info.attach('event-log.txt', { body: formatLog(log), contentType: 'text/plain' });
          await info.attach('event-log.json', { body: JSON.stringify(log, null, 2), contentType: 'application/json' });
          const markerIndex = log.findIndex((e) => e.type === `step ${firstStepOfBurst}`);
          const excerpt = formatLog(log.slice(Math.max(0, markerIndex - 6)));
          const original = error instanceof Error ? error.message : String(error);
          throw new Error(`${original}\n\nEvent trace around failing burst:\n${excerpt}`, { cause: error });
        }
        await page.waitForTimeout(250); // let any focus work from a trailing open settle
      }
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

    // Regression: focus moves inside the open panel must never scroll the page. When the panel
    // fits on neither side of the input it deliberately stays below the fold (the user scrolls
    // down to it), so focus() without preventScroll scrolls the viewport to reveal the newly
    // focused column/refocus target - yanking the page under the user's cursor. Every in-panel
    // focus move below must leave window.scrollY exactly where it was.
    test('should not scroll the page when moving focus inside the open panel', async ({ page }) => {
      // Arrange: short viewport + downward scroll place the picker so the panel fits on
      // NEITHER side of the input (no room above or below it), which keeps the panel at its
      // baseline position extending past the viewport bottom - the exact below-the-fold state
      // the open path documents at length (time-picker.ts, toggleTimePickerVisibility).
      await page.setViewportSize({ width: 1100, height: 300 });
      await goToComponentsPage(page);
      await page.evaluate(() => window.scrollTo(0, 390));
      const timePicker = getTimePicker(page);
      await timePicker.focus(); // focus auto-opens the panel and lands in the hour listbox.

      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getHourColumn(page)).toBeFocused();
      const panelBox = await getPanel(page).boundingBox();
      expect(panelBox !== null && panelBox.y + panelBox.height, 'pre-condition: panel must extend below the fold for this test to mean anything').toBeGreaterThan(300);
      expect(panelBox !== null && panelBox.y, 'pre-condition: panel must stay partially visible so revealing it would scroll').toBeLessThan(300);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore, 'opening the panel must not scroll the page (open-path contract)').toBe(390);

      // Act: Switch hour -> minute with ArrowRight.
      await page.keyboard.press('ArrowRight');

      // Assert: Focus moved and the page did not.
      await expect(getMinuteColumn(page)).toBeFocused();
      expect(await page.evaluate(() => window.scrollY), 'ArrowRight (hour -> minute switch) must not scroll the page').toBe(scrollBefore);

      // Act: Switch back minute -> hour with ArrowLeft.
      await page.keyboard.press('ArrowLeft');

      // Assert: Focus moved and the page did not.
      await expect(getHourColumn(page)).toBeFocused();
      expect(await page.evaluate(() => window.scrollY), 'ArrowLeft (minute -> hour switch) must not scroll the page').toBe(scrollBefore);

      // Act: Confirm the hour, which advances focus into the minute column.
      await page.keyboard.press('Enter');

      // Assert: Flow advanced and the page did not.
      await expect(getMinuteColumn(page)).toBeFocused();
      expect(await page.evaluate(() => window.scrollY), 'Enter (hour -> minute advance) must not scroll the page').toBe(scrollBefore);

      // Act: Press OUR panel's hour column header (dispatched raw, so Playwright's own
      // pre-click scroll-into-view cannot move the page and pollute the assertion). The query
      // is scoped to the open panel: the page hosts several pickers whose hidden panels also
      // carry .column-header, and pressing a foreign one counts as an outside press (the
      // DateTimePicker document handler would close our panel instead of focusing a column).
      await getPanel(page).locator('.column-header').first().evaluate((header) => {
        header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      });

      // Assert: Header press refocused the hour column and the page did not.
      await expect(getHourColumn(page)).toBeFocused();
      expect(await page.evaluate(() => window.scrollY), 'header press must not scroll the page').toBe(scrollBefore);

      // Act: Leave the panel via Escape (refocuses the input).
      await page.keyboard.press('Escape');

      // Assert: Panel closed, focus back on the input, page still untouched.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).toBeFocused();
      expect(await page.evaluate(() => window.scrollY), 'Escape refocus must not scroll the page').toBe(scrollBefore);
    });

    test('should select time via keyboard and move focus to next component', async ({ page }) => {
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

      // Assert: Panel closed, focus on next component, value propagated through the form.
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('cc-checkBoxNull')).toBeFocused();
      await expect(timePicker).toHaveValue('15:30');
      await expect(getValueDisplay(page)).toContainText('T15:30:00');
    });

    test('should navigate from previous component to time-picker to next component on Tab presses', async ({ page }) => {
      // Arrange: Start keyboard modality on the previous component (the standalone date row's
      // date input), whose calendar opens on focus.
      await goToComponentsPage(page);
      const previousPicker = page.getByTestId('dateId_datePicker_input');
      await previousPicker.focus();
      await expect(previousPicker).toHaveAttribute('aria-expanded', 'true');

      // Act: Tab into the time-picker.
      await page.keyboard.press('Tab');

      // Assert: Panel opened and focus moved into the hour listbox.
      const timePicker = getTimePicker(page);
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page)).toBeVisible();
      await expect(getHourColumn(page)).toBeFocused();

      // Assert: Focus left the previous component, so its calendar panel closed on the way out.
      await expect(previousPicker).toHaveAttribute('aria-expanded', 'false');

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

      // Assert: Focus moved to next component; panel closed.
      await expect(page.getByTestId('cc-checkBoxNull')).toBeFocused();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
    });

    test('should navigate backwards from next component to time-picker to previous component on Shift+Tab presses', async ({ page }) => {
      // Arrange: Start keyboard modality on the next component (the element after the time-picker).
      await goToComponentsPage(page);
      await page.getByTestId('cc-checkBoxNull').focus();

      // Act: Shift+Tab into the time-picker.
      await page.keyboard.press('Shift+Tab');

      // Assert: Panel opened and focus moved into the hour listbox (picker properly selected).
      const timePicker = getTimePicker(page);
      await expect(timePicker).toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page)).toBeVisible();
      await expect(getHourColumn(page)).toBeFocused();

      // Act: Shift+Tab again — one press must close panel AND move focus out backwards.
      await page.keyboard.press('Shift+Tab');

      // Assert: Focus moved to previous component (the standalone date row's date input), which
      // auto-opens its calendar on focus and moves focus into its calendar grid (parity with our
      // own open behaviour); our panel closed and our input no longer holds focus.
      const previousPicker = page.getByTestId('dateId_datePicker_input');
      await expect(previousPicker).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('dateId_datePicker_panel').locator('.calendar-grid')).toBeFocused();
      await expect(timePicker).toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker).not.toBeFocused();
    });

    test('should clear the value with Delete and Backspace when canNull', async ({ page }) => {
      // Arrange: Navigate to the custom components page and check the canNull variant starts empty.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page, true);
      const valueDisplay = getValueDisplay(page, true);
      await expect(valueDisplay, 'value should start empty').toContainText('❓');

      // Act: Pick hour 14 only (partial session - the form must not be notified yet).
      await timePicker.click();
      await getHour(page, 14, true).click();

      // Assert: The hour pick highlights but commits nothing while the session is incomplete.
      await expect(timePicker, 'panel should stay open after the hour pick').toHaveAttribute('aria-expanded', 'true');
      await expect(valueDisplay, 'hour-only pick must not commit a value').toContainText('❓');
      await expect(getHour(page, 14, true), 'picked hour should be highlighted').toHaveClass(/selected/);

      // Act: Complete the session with minute 30.
      await getMinute(page, 30, true).click();

      // Assert: The completed session commits the value, closes the panel and refocuses the input.
      await expect(valueDisplay, 'completed selection should commit the value').toContainText('T14:30:00');
      await expect(timePicker, 'panel should close after the completing pick').toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker, 'focus should return to the input after the completing pick').toBeFocused();

      // Act: Reopen via keyboard and Delete while the hour listbox holds focus.
      await page.keyboard.press('Enter');
      await expect(getHourColumn(page, true), 'reopened panel should focus the hour listbox').toBeFocused();
      await page.keyboard.press('Delete');

      // Assert: Value cleared, interaction completed - panel closed, focus back on the input.
      await expect(valueDisplay, 'Delete should clear the value').toContainText('❓');
      await expect(timePicker, 'panel should close after clearing from the listbox').toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker, 'focus should return to the input after clearing').toBeFocused();

      // Act: Commit the value again (hour 14 + minute 30), then Backspace on the input.
      await page.keyboard.press('Enter');
      await getHour(page, 14, true).click();
      await getMinute(page, 30, true).click();
      await expect(valueDisplay, 'second selection should commit the value again').toContainText('T14:30:00');
      await expect(timePicker, 'focus should return to the input after the second selection').toBeFocused();
      await page.keyboard.press('Backspace');

      // Assert: Value and input cleared; the key closes nothing (panel already closed) and focus stays.
      await expect(valueDisplay, 'Backspace should clear the value').toContainText('❓');
      await expect(timePicker, 'input should show no residual value').toHaveValue('');
      await expect(timePicker, 'clearing from the input should keep the panel closed').toHaveAttribute('aria-expanded', 'false');
      await expect(timePicker, 'focus should stay on the input').toBeFocused();
    });
  });

  test.describe('display', () => {
    test('should render translated placeholder and column headers from real i18n assets', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);

      // Assert: Placeholder comes from the real translation files. The input itself carries no
      // aria-label: this instance is named by aria-labelledby (see the label tests), and the
      // fallback must stay off - accname gives aria-label precedence over native labelling, so
      // it would shadow a <label for> pointing at this input.
      await expect(timePicker).toHaveAttribute('placeholder', 'hh:mm');
      expect(await timePicker.getAttribute('aria-label'), 'labelled input must not carry an aria-label fallback').toBeNull();

      // Act: Open the panel.
      await timePicker.click();

      // Assert: Dialog name comes from the dedicated key in the real translation files - it must
      // not repeat the placeholder ("hh:mm"), which is a format hint, not a name.
      await expect(getPanel(page)).toHaveAttribute('aria-label', 'Time picker');

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
    test('should render the decorative clock glyph outside the value and hidden from AT', async ({ page }) => {
      // Arrange: Navigate to the custom components page.
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);
      const icon = getTimeIcon(page);

      // Assert: Icon exists once, shows the glyph and is hidden from assistive technology - the
      // VALUE is what a screen reader announces, so the glyph must never end up in it.
      await expect(icon, 'decorative icon should be rendered exactly once').toHaveCount(1);
      await expect(icon, 'decorative icon must be hidden from AT').toHaveAttribute('aria-hidden', 'true');
      await expect(icon, 'decorative icon should show the clock glyph').toHaveText('🕜');

      // Assert: Value and placeholder carry pure text (an emoji in them would be announced as
      // "clock face one-thirty" before the time).
      await expect(timePicker, 'value must stay pure text').toHaveValue('');
      await expect(timePicker, 'placeholder must stay pure text').toHaveAttribute('placeholder', 'hh:mm');

      // Assert: Icon overlays the input's own box - it decorates the field without layout shift.
      const iconBox = await icon.boundingBox();
      const inputBox = await timePicker.boundingBox();
      const iconInsideInput = iconBox !== null && inputBox !== null
        && iconBox.x >= inputBox.x && iconBox.y >= inputBox.y
        && iconBox.x + iconBox.width <= inputBox.x + inputBox.width
        && iconBox.y + iconBox.height <= inputBox.y + inputBox.height;
      expect(iconInsideInput, 'decorative icon should overlay the input box').toBe(true);

      // Assert: The reserved left padding covers the rendered glyph plus the designed gap - the
      // input's text (and placeholder) must start at least `--datetimepicker-time-icon-gap` after
      // the icon's right edge. Glyph advance varies per platform emoji font, so this is what
      // guards --datetimepicker-time-icon-width.
      const boxStyles = await timePicker.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          borderLeft: parseFloat(style.borderLeftWidth),
          paddingLeft: parseFloat(style.paddingLeft),
          gap: parseFloat(style.getPropertyValue('--datetimepicker-time-icon-gap')),
        };
      });
      const textStartsAt = (inputBox?.x ?? 0) + boxStyles.borderLeft + boxStyles.paddingLeft;
      const iconEndsAt = (iconBox?.x ?? 0) + (iconBox?.width ?? 0);
      expect(iconEndsAt, 'input text must start after the glyph, keeping the designed gap').toBeLessThanOrEqual(textStartsAt - boxStyles.gap);
    });

    test('should open the panel when clicking the glyph area of the input', async ({ page }) => {
      // Arrange: Navigate; the glyph sits over the input's left padding (a few px from the edge).
      await goToComponentsPage(page);
      const timePicker = getTimePicker(page);

      // Act: Click straight through the glyph's area. Playwright's hit-target check fails here if
      // the decoration starts swallowing pointer events (click would land on the icon, not the
      // input), and the panel stays closed if the click never reaches the input's handler.
      await timePicker.click({ position: { x: 10, y: 10 } });

      // Assert: Click reached the input, which owns panel opening.
      await expect(timePicker, 'click on the glyph area must reach the input').toHaveAttribute('aria-expanded', 'true');
      await expect(getPanel(page), 'panel should open').toBeVisible();
    });

    test('is correct axe-wise with panel open', async ({ page }) => {
      // Arrange: Navigate and open the panel so its dialog/listbox markup is analyzed too.
      await goToComponentsPage(page);
      await getTimePicker(page).click();
      await expect(getPanel(page)).toBeVisible();

      // Act: Run axe against the page with the panel open. The two clock columns are excluded
      // NODE-WISE instead of disabling the whole rule, so scrollable-region-focusable keeps
      // guarding the rest of the page. The columns cannot satisfy the rule as written: they are
      // `overflow-y: auto` listboxes whose options are plain divs (no tabbable descendant) and
      // whose own tabindex=-1 keeps them out of the tab order - axe would demand a tab stop that
      // must not exist (the input is the tab stop; NavUtils and the hidePanelAnd* hand-offs skip
      // button/element[tabindex="-1"]). They ARE keyboard-operable: they take programmatic focus
      // on open (`focusPanelTarget` -> hour column, column switch -> minute column) and the arrow,
      // Home/End and PageUp/PageDown keys scroll them, so WCAG 2.1.1 is met. axe's combobox-popup
      // exemption cannot see that: it keys off aria-controls/ids on the popup itself (the panel
      // gets it), and the nested columns carry no id. Making them tabindex=0 would insert them
      // into the tab order and break Tab-out behavior.
      const results = await new AxeBuilder({ page })
        .exclude('.clock-column')
        .analyze();

      // Assert: No accessibility violations.
      expect(results.violations).toEqual([]);
    });
  });
});
