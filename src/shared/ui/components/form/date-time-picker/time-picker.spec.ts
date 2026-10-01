import { ComponentFixture, TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { TranslateService, type TranslationObject } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { TimePicker } from './time-picker';

/**
 * Unit tests of time-picker component.
 * Note: the component moves keyboard focus into the clock panel after opening and uses
 * `forRender` twice (baseline measure, then flip applied before focus), so interaction
 * tests always flush with `whenStable` + `detectChanges` - twice for focus-open flows.
 */
describe('TimePicker', () => {
  /** Options used to arrange a TimePicker instance under test. */
  interface TimePickerTestOptions {
    /** Initial value of the picker. */
    value?: Date | null;
    /** Identifier of the picker (used for ids and data-testids). */
    ident?: string;
    /** Label reference for aria-labelledby. */
    label?: string;
    /** Whether the picker allows deselecting the time. */
    canNull?: boolean;
    /** Whether the picker is required. */
    required?: boolean;
    /** Whether the picker is disabled. */
    disabled?: boolean;
    /** Whether the picker is in invalid state. */
    invalid?: boolean;
    /** Translations registered before component creation (needed for computed placeholder). */
    translations?: TranslationObject;
  }

  /**
   * Create and configure a TimePicker component under test.
   * @param opts Options controlling initial inputs and translations.
   * @returns Fixture of the created component with initial change detection applied.
   */
  async function arrangeTimePicker(opts: TimePickerTestOptions = {}): Promise<ComponentFixture<TimePicker>> {
    const {
      value = null,
      ident = 'test-time',
      label = '',
      canNull = false,
      required = false,
      disabled = false,
      invalid = false,
      translations,
    } = opts;

    await TestBed.configureTestingModule({
      imports: [TimePicker],
    }).compileComponents();

    // Register translations before component creation so computeds evaluating on first
    // change detection (placeholder) already see them.
    if (translations) {
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('en', translations);
      translateService.use('en');
    }

    const fixture = TestBed.createComponent(TimePicker);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('canNull', canNull);
    fixture.componentRef.setInput('required', required);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.componentRef.setInput('invalid', invalid);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  /**
   * Create a Date on a fixed date with given UTC time. Keeps assertions timezone-agnostic.
   * @param hour UTC hour.
   * @param minute UTC minute.
   * @param seconds UTC seconds (defaults to 0).
   * @param ms UTC milliseconds (defaults to 0).
   * @returns Date set to 2026-01-15 at given UTC time.
   */
  function utcTime(hour: number, minute: number, seconds: number = 0, ms: number = 0): Date {
    return new Date(Date.UTC(2026, 0, 15, hour, minute, seconds, ms));
  }

  /**
   * Get the time input element of given fixture (uses default ident).
   * @param fixture Fixture of the component.
   * @returns Input element of the picker.
   */
  function getInput(fixture: ComponentFixture<TimePicker>): HTMLInputElement {
    return fixture.nativeElement.querySelector('[data-testid="test-time_input"]');
  }

  /**
   * Open the clock panel with a mouse click on the input and flush pending component work.
   * Panel opening awaits `forRender` internally, hence the stability flushes.
   * @param fixture Fixture of the component.
   */
  async function openPanel(fixture: ComponentFixture<TimePicker>): Promise<void> {
    getInput(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Focus the input without triggering focus-driven panel opening, mimicking focus
   * that follows a mousedown (component skips auto-open for such focus). Uses the real
   * production path: a dispatched mousedown marks the upcoming focus as click-caused,
   * the focus handler then consumes the mark instead of opening the panel.
   * @param fixture Fixture of the component.
   * @returns The input element, already focused.
   */
  function focusInputWithoutOpening(fixture: ComponentFixture<TimePicker>): HTMLInputElement {
    const input = getInput(fixture);
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    fixture.detectChanges();
    return input;
  }

  /** Viewport width assumed by positioning logic (jsdom performs no layout, real value is 0). */
  const VIEWPORT_WIDTH = 1024;
  /** Viewport height assumed by positioning logic (jsdom performs no layout, real value is 0). */
  const VIEWPORT_HEIGHT = 768;

  /**
   * Stub clock column geometry so PageUp/PageDown can measure a known page step. jsdom performs
   * no layout: every height reports 0 and the component would fall back to its fixed page size.
   * The header sits outside the scroll container (above it), so only the column and its option
   * need stubbing - `pageStep` reads no header height.
   * @param fixture Fixture of the component.
   * @param column Column whose geometry gets stubbed.
   * @param sizes Assumed heights - visible column, single option.
   */
  function stubColumnGeometry(fixture: ComponentFixture<TimePicker>, column: 'hour' | 'minute', sizes: { clientHeight: number; optionHeight: number }): void {
    const el = column === 'hour' ? fixture.componentInstance.hourRef().nativeElement : fixture.componentInstance.minuteRef().nativeElement;
    const option = el.querySelector('.time-item');
    if (option === null) throw new Error('clock column should render its options');

    Object.defineProperty(el, 'clientHeight', { value: sizes.clientHeight, configurable: true });
    Object.defineProperty(option, 'offsetHeight', { value: sizes.optionHeight, configurable: true });
  }

  beforeAll(() => {
    // jsdom does not implement scrollIntoView; stubbed so a stray call cannot throw.
    // Doubles as a spy: the scrolling suite asserts the component never calls it.
    Element.prototype.scrollIntoView = vi.fn();

    // jsdom performs no layout, so `documentElement.clientWidth/clientHeight` (the viewport
    // dimensions the component checks for overflow) always report 0 - every open would look
    // like it overflows both edges. Define them as viewport-sized values for this suite.
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => VIEWPORT_WIDTH });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => VIEWPORT_HEIGHT });
  });

  afterAll(() => {
    // Drop the own-property stubs so the prototype (jsdom) definitions are back in place.
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  });

  describe('general', () => {
    describe('rendering&display', () => {
      it('should render with default values', async () => {
        // Arrange: Create component with defaults.
        const fixture = await arrangeTimePicker();

        // Assert: Component renders, value is null, panel is closed.
        expect(getInput(fixture), 'input should be rendered').not.toBeNull();
        expect(fixture.componentInstance.value(), 'default value should be null').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'clock panel should be closed by default').toBe(false);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_panel"]').style.display, 'panel should be hidden by default').toBe('none');
        expect(getInput(fixture).getAttribute('aria-expanded'), 'aria-expanded should be false by default').toBe('false');
      });

      it('should render 24 hour and 60 minute options with ident-based testids', async () => {
        // Arrange: Create component with default ident.
        const fixture = await arrangeTimePicker();

        // Assert: Both columns render full ranges with boundary options present.
        const hourOptions = fixture.nativeElement.querySelectorAll('[data-testid^="test-time_h"]');
        const minuteOptions = fixture.nativeElement.querySelectorAll('[data-testid^="test-time_m"]');
        expect(hourOptions.length, 'should render 24 hour options').toBe(24);
        expect(minuteOptions.length, 'should render 60 minute options').toBe(60);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h0"]'), 'hour 0 should exist').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h23"]'), 'hour 23 should exist').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m0"]'), 'minute 0 should exist').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m59"]'), 'minute 59 should exist').not.toBeNull();
      });

      it('should display formatted UTC time in input when value is set', async () => {
        // Arrange: Create component with value 14:30 UTC.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Assert: Input shows formatted time as plain text - the decorative clock glyph is a
        // separate aria-hidden element, never part of the value (screen readers announce values).
        expect(getInput(fixture).value, 'input should show formatted UTC time').toBe('14:30');
      });

      it('should update input display when value changes programmatically', async () => {
        // Arrange: Create component with value 14:30 UTC.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Set new value, then clear it.
        fixture.componentRef.setInput('value', utcTime(9, 5));
        fixture.detectChanges();
        expect(getInput(fixture).value, 'input should show updated time').toBe('09:05');

        // Assert: Clearing value empties the input again.
        fixture.componentRef.setInput('value', null);
        fixture.detectChanges();
        expect(getInput(fixture).value, 'input should be empty after clearing value').toBe('');
      });

      it('should show placeholder translation key when no value is set', async () => {
        // Arrange: Create component without value and translations.
        const fixture = await arrangeTimePicker({ value: null });

        // Assert: Placeholder is exactly the translation key (no translations registered) - the
        // decorative glyph must never leak into it.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_input"]').getAttribute('placeholder'), 'placeholder should be the translation key').toBe('dateTimePicker.placeholder.time');
      });

      it('should show translated placeholder when translations are provided', async () => {
        // Arrange: Create component with translations registered before creation.
        const fixture = await arrangeTimePicker({
          value: null,
          translations: { dateTimePicker: { placeholder: { time: 'hh:mm' } } },
        });

        // Assert: Placeholder is exactly the resolved translation - no decorative prefix.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_input"]').getAttribute('placeholder'), 'placeholder should be translated text').toBe('hh:mm');
      });

      it('should render the clock glyph as a separate aria-hidden decoration, not as value text', async () => {
        // Arrange: Create component with value and translations so both value and placeholder render.
        const fixture = await arrangeTimePicker({
          value: utcTime(14, 30),
          translations: { dateTimePicker: { placeholder: { time: 'hh:mm' } } },
        });
        const icon = fixture.nativeElement.querySelector('[data-testid="test-time_icon"]');

        // Assert: Value and placeholder carry pure text - a screen reader announces the value, so
        // an emoji in it would be read as "clock face one-thirty" before the time.
        expect(getInput(fixture).value, 'value must not contain the decorative glyph').toBe('14:30');
        expect(getInput(fixture).getAttribute('placeholder'), 'placeholder must not contain the decorative glyph').toBe('hh:mm');

        // Assert: The glyph exists once, outside the input, and is hidden from assistive technology.
        expect(icon, 'decorative icon element should be rendered').not.toBeNull();
        expect(icon.textContent, 'decorative icon should show the clock glyph').toBe('🕜');
        expect(icon.getAttribute('aria-hidden'), 'decorative icon must be hidden from AT').toBe('true');
        expect(fixture.nativeElement.querySelectorAll('[data-testid="test-time_icon"]').length, 'exactly one decorative icon').toBe(1);
      });

      it('should apply disabled state to input when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeTimePicker({ disabled: true });
        const input = getInput(fixture);

        // Assert: Input is disabled, not reachable via Tab and marked for assistive technology.
        expect(input.disabled, 'input should be disabled').toBe(true);
        expect(input.getAttribute('tabindex'), 'disabled input should not be a tab stop').toBe('-1');
        expect(input.classList.contains('disabled'), 'input should have disabled class').toBe(true);
        expect(input.getAttribute('aria-disabled'), 'aria-disabled should be true when disabled').toBe('true');
      });

      it('should apply invalid state to input when invalid', async () => {
        // Arrange: Create invalid component.
        const fixture = await arrangeTimePicker({ invalid: true });
        const input = getInput(fixture);

        // Assert: Root and input are marked invalid for styling and assistive technology.
        expect(fixture.nativeElement.querySelector('.picker-time').classList.contains('invalid'), 'root should have invalid class').toBe(true);
        expect(input.classList.contains('invalid'), 'input should have invalid class').toBe(true);
        expect(input.getAttribute('aria-invalid'), 'aria-invalid should be true when invalid').toBe('true');
      });

      it('should apply both disabled and invalid state when both inputs are true', async () => {
        // Arrange: Create component with both disabled and invalid.
        const fixture = await arrangeTimePicker({ disabled: true, invalid: true });
        const input = getInput(fixture);

        // Assert: Both visual states are applied together.
        expect(input.classList.contains('disabled'), 'input should have disabled class').toBe(true);
        expect(input.classList.contains('invalid'), 'input should have invalid class').toBe(true);
        expect(fixture.nativeElement.querySelector('.picker-time').classList.contains('invalid'), 'root should have invalid class').toBe(true);
      });

      it('should mark selected and current time options with classes when panel is open', async () => {
        // Arrange: Remember current local hour to tolerate hour rollover during the test.
        const beforeHour = new Date().getHours();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Open the clock panel (this computes viewed/current time).
        await openPanel(fixture);
        const afterHour = new Date().getHours();

        // Assert: Selected options match the value, exactly one option per column is current.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').classList.contains('selected'), 'hour 14 should be selected').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h13"]').classList.contains('selected'), 'hour 13 should not be selected').toBe(false);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').classList.contains('selected'), 'minute 30 should be selected').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m29"]').classList.contains('selected'), 'minute 29 should not be selected').toBe(false);
        const currHours = fixture.nativeElement.querySelectorAll('.time-hour.curr');
        expect(currHours.length, 'exactly one hour should be marked as current').toBe(1);
        expect([beforeHour, afterHour], 'current hour should match real current local hour').toContain(Number(currHours[0].textContent));
        expect(fixture.nativeElement.querySelectorAll('.time-minute.curr').length, 'exactly one minute should be marked as current').toBe(1);
      });

      it('should seed current time highlight from local timezone when no value is set', async () => {
        // Arrange: Remember current local time to tolerate rollover during the test.
        const beforeHour = new Date().getHours();
        const beforeMinute = new Date().getMinutes();
        const fixture = await arrangeTimePicker({ value: null });

        // Act: Open the clock panel (this computes viewed/current time).
        await openPanel(fixture);
        const afterHour = new Date().getHours();
        const afterMinute = new Date().getMinutes();

        // Assert: Viewed time and `curr` markers come from local time, not UTC.
        expect([beforeHour, afterHour], 'viewed hour should match real current local hour').toContain(fixture.componentInstance.viewHour());
        expect([beforeMinute, afterMinute], 'viewed minute should match real current local minute').toContain(fixture.componentInstance.viewMinute());
        const currHours = fixture.nativeElement.querySelectorAll('.time-hour.curr');
        expect(currHours.length, 'exactly one hour should be marked as current').toBe(1);
        expect([beforeHour, afterHour], 'current hour marker should match real current local hour').toContain(Number(currHours[0].textContent));
        const currMinutes = fixture.nativeElement.querySelectorAll('.time-minute.curr');
        expect(currMinutes.length, 'exactly one minute should be marked as current').toBe(1);
        expect([beforeMinute, afterMinute], 'current minute marker should match real current local minute').toContain(Number(currMinutes[0].textContent));
      });
    });

    describe('open/close&selection', () => {
      it('should open panel on click', async () => {
        // Arrange: Create component with closed panel.
        const fixture = await arrangeTimePicker();
        expect(fixture.componentInstance.isClockVisible(), 'panel should start closed').toBe(false);

        // Act: Click the input.
        await openPanel(fixture);

        // Assert: Panel is open, visible and reported to assistive technology.
        expect(fixture.componentInstance.isClockVisible(), 'panel should be open after click').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_panel"]').style.display, 'panel should be visible when open').not.toBe('none');
        expect(getInput(fixture).getAttribute('aria-expanded'), 'aria-expanded should be true when open').toBe('true');
        expect(document.activeElement, 'focus should move into the hour listbox').toBe(fixture.componentInstance.hourRef().nativeElement);
      });

      it('should close panel on second click', async () => {
        // Arrange: Create component and open the panel.
        const fixture = await arrangeTimePicker();
        await openPanel(fixture);
        expect(fixture.componentInstance.isClockVisible(), 'panel should be open before second click').toBe(true);

        // Act: Click the input again.
        getInput(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel is closed again.
        expect(fixture.componentInstance.isClockVisible(), 'panel should be closed after second click').toBe(false);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_panel"]').style.display, 'panel should be hidden when closed').toBe('none');
        expect(getInput(fixture).getAttribute('aria-expanded'), 'aria-expanded should be false when closed').toBe('false');
      });

      it('should seed keyboard focus state when panel opens on focus', async () => {
        // Arrange: Create component with value 14:30 and closed panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Focus the input (e.g. via Tab).
        getInput(fixture).focus();
        // The open spans two forRender rounds (measure under baseline, apply flip, then
        // focus), so a single whenStable + detectChanges pair cannot cover it yet.
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus state is seeded on every open - focus lands in the hour listbox, so the
        // active option must be both announced (aria-activedescendant) and visually marked
        // (.focused ring), otherwise a keyboard user has no focus indication at all.
        expect(fixture.componentInstance.isClockVisible(), 'panel should open on focus').toBe(true);
        expect(fixture.componentInstance.focusedHour(), 'focus-open should seed focused hour').toBe(14);
        expect(fixture.componentInstance.focusedMinute(), 'focus-open should seed focused minute').toBe(30);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference focused option').toBe('test-time_opt_h14');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').classList.contains('focused'), 'hour 14 should have focused class').toBe(true);
        expect(document.activeElement, 'focus should move into the hour listbox').toBe(fixture.componentInstance.hourRef().nativeElement);
      });

      it('should seed keyboard focus state when panel opens on click', async () => {
        // Arrange: Create component with value 14:30 and closed panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Click the input.
        await openPanel(fixture);

        // Assert: Mouse open seeds focus too - DOM focus still moves into the hour listbox.
        expect(fixture.componentInstance.isClockVisible(), 'panel should open on click').toBe(true);
        expect(fixture.componentInstance.focusedHour(), 'click-open should seed focused hour').toBe(14);
        expect(fixture.componentInstance.focusedMinute(), 'click-open should seed focused minute').toBe(30);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference focused option').toBe('test-time_opt_h14');
        expect(document.activeElement, 'focus should move into the hour listbox').toBe(fixture.componentInstance.hourRef().nativeElement);
      });

      it('should open exactly once on real mousedown-focus-click flow', async () => {
        // Arrange: Create component, simulate mousedown so component marks focus as click-caused.
        const fixture = await arrangeTimePicker();
        const input = getInput(fixture);
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        // Act: Focus follows mousedown (auto-open must be skipped), then click toggles the panel open.
        input.focus();
        input.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel is open (a double toggle would leave it closed - the click-caused focus
        // must not have auto-opened before the click closed it again).
        expect(fixture.componentInstance.isClockVisible(), 'real click flow should open panel exactly once').toBe(true);
      });

      it('should keep auto-open on focus after mousedown on already-focused input', async () => {
        // Arrange: Create component with input focused (focus-open suppressed) and panel closed.
        const fixture = await arrangeTimePicker();
        const input = focusInputWithoutOpening(fixture);

        // Act: Mousedown lands on the already-focused input, so no focus event follows to consume
        // the click-caused mark - it must not be set in the first place (a mark left behind here
        // would leak and swallow the auto-open asserted below).
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        input.blur();
        input.focus();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus auto-opens the panel (a leaked mark would keep it closed).
        expect(fixture.componentInstance.isClockVisible(), 'auto-open should work after mousedown on focused input').toBe(true);
      });

      it('should close panel and reset keyboard focus on Escape from input', async () => {
        // Arrange: Create component and open the panel (focus sits in the hour listbox).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        const input = getInput(fixture);
        input.focus();
        fixture.detectChanges();

        // Act: Press Escape while the input is focused.
        const user = userEvent.setup();
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel closed and keyboard focus state reset.
        expect(fixture.componentInstance.isClockVisible(), 'Escape should close the panel').toBe(false);
        expect(fixture.componentInstance.focusedHour(), 'Escape should reset focused hour').toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'Escape should reset focused minute').toBeNull();
      });

      it('should select hour on hour click without closing panel', async () => {
        // Arrange: Create component with empty value and open panel.
        const fixture = await arrangeTimePicker({ value: null });
        await openPanel(fixture);

        // Act: Click hour 14.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value carries selected hour with cleared seconds, panel stays open for minute picking.
        expect(fixture.componentInstance.value()?.getUTCHours(), 'value should contain hour 14').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
        expect(fixture.componentInstance.isClockVisible(), 'panel should stay open after hour click').toBe(true);
      });

      it('should move keyboard cursor to the hour clicked with mouse', async () => {
        // Arrange: Create component with value 14:30 and open panel (cursor seeded at hour 14).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        expect(fixture.componentInstance.focusedHour(), 'precondition: open should seed cursor at hour 14').toBe(14);

        // Act: Click hour 5.
        fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').click();
        fixture.detectChanges();

        // Assert: Cursor, aria-activedescendant and focus ring all follow the clicked hour,
        // otherwise they keep pointing at the hour seeded at open.
        expect(fixture.componentInstance.focusedHour(), 'clicking hour 5 should move the keyboard cursor there').toBe(5);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference clicked option').toBe('test-time_opt_h5');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').classList.contains('focused'), 'clicked hour 5 should carry the focus ring').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').classList.contains('focused'), 'previously seeded hour 14 should lose the focus ring').toBe(false);
      });

      it('should continue arrow navigation from the hour clicked with mouse', async () => {
        // Arrange: Create component with value 14:30, open panel and click hour 5.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').click();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'precondition: cursor should sit on clicked hour 5').toBe(5);

        // Act: Press ArrowDown in the hour listbox.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Navigation continues from the clicked hour, not from the stale seeded one.
        expect(fixture.componentInstance.focusedHour(), 'ArrowDown should advance from clicked hour 5 to 6').toBe(6);
      });

      it('should deselect, close panel and refocus input when the click deselects the value', async () => {
        // Arrange: Create deselectable component with value 14:30, open panel, move the cursor
        // away from the selected hour (so only a click on hour 14 itself can deselect) and spy
        // on touch output.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'precondition: cursor should sit on hour 15').toBe(15);

        // Act: Click the already selected hour 14 (deselects because canNull).
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Deselect completes the interaction - the mouse path must close the panel just
        // like the keyboard path and every minute click, and focus returns to the input without
        // reporting a touch (internal move).
        expect(fixture.componentInstance.value(), 're-clicking selected hour with canNull should clear value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'panel should close after deselecting with the mouse').toBe(false);
        expect(document.activeElement, 'focus should return to input after deselect').toBe(getInput(fixture));
        expect(fixture.componentInstance.focusedHour(), 'closing the panel should clear the keyboard cursor').toBeNull();
        expect(touchSpy, 'refocusing the input should not emit touch').not.toHaveBeenCalled();
      });

      it('should move keyboard cursor to the minute pressed with mouse before the click lands', async () => {
        // Arrange: Create component with value 14:30 and open panel (minute cursor seeded at 30).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        expect(fixture.componentInstance.focusedMinute(), 'precondition: open should seed cursor at minute 30').toBe(30);

        // Act: Dispatch mousedown only. The browser paints between mousedown and the click, so
        // the cursor must already be correct before the click selects anything - otherwise the
        // focus ring flashes on the previous/default option while the button is held.
        fixture.nativeElement.querySelector('[data-testid="test-time_m25"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();

        // Assert: Cursor, aria-activedescendant and focus ring all follow the pressed minute.
        expect(fixture.componentInstance.focusedMinute(), 'pressing minute 25 should move the keyboard cursor there').toBe(25);
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-activedescendant'), 'minute activedescendant should reference pressed option').toBe('test-time_opt_m25');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m25"]').classList.contains('focused'), 'pressed minute 25 should carry the focus ring').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').classList.contains('focused'), 'previously seeded minute 30 should lose the focus ring').toBe(false);
      });

      it('should move keyboard cursor to the hour pressed with mouse before the click lands', async () => {
        // Arrange: Create component with value 14:30 and open panel (hour cursor seeded at 14).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        expect(fixture.componentInstance.focusedHour(), 'precondition: open should seed cursor at hour 14').toBe(14);

        // Act: Dispatch mousedown only (see the minute counterpart for why the gap matters).
        fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();

        // Assert: Cursor, aria-activedescendant and focus ring all follow the pressed hour.
        expect(fixture.componentInstance.focusedHour(), 'pressing hour 5 should move the keyboard cursor there').toBe(5);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference pressed option').toBe('test-time_opt_h5');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').classList.contains('focused'), 'pressed hour 5 should carry the focus ring').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').classList.contains('focused'), 'previously seeded hour 14 should lose the focus ring').toBe(false);
      });

      it('should select minute on minute click, close panel and refocus input', async () => {
        // Arrange: Create component with value 14:05, open panel and spy on touch output.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 5) });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);

        // Act: Click minute 30.
        fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').click();
        fixture.detectChanges();

        // Assert: Minute updated, hour preserved, panel closed and focus back on the input.
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'value should contain minute 30').toBe(30);
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should be preserved').toBe(14);
        expect(fixture.componentInstance.isClockVisible(), 'panel should close after minute click').toBe(false);
        expect(document.activeElement, 'focus should return to input after minute click').toBe(getInput(fixture));
        expect(touchSpy, 'refocusing the input should not emit touch').not.toHaveBeenCalled();
      });

      it('should select minute from empty value with seconds cleared', async () => {
        // Arrange: Create component with empty value and open panel.
        const fixture = await arrangeTimePicker({ value: null });
        await openPanel(fixture);

        // Act: Click minute 45.
        fixture.nativeElement.querySelector('[data-testid="test-time_m45"]').click();
        fixture.detectChanges();

        // Assert: Value carries minute with cleared seconds.
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'value should contain minute 45').toBe(45);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
      });

      it('should seed the untouched hour from the highlighted current time when only a minute is picked', async () => {
        // Arrange: Create component without value and open panel (both columns highlight current
        // local time). Shift the highlighted hour by one so it cannot coincide with the
        // wall-clock hour the seeding used to copy from `new Date()` - the assertion then fails
        // on every machine timezone instead of passing vacuously on UTC runners.
        const fixture = await arrangeTimePicker({ value: null });
        await openPanel(fixture);
        expect(fixture.componentInstance.viewHour(), 'precondition: open should seed the viewed hour').not.toBeNull();
        const highlightedHour = ((fixture.componentInstance.viewHour() ?? 0) + 1) % 24;
        fixture.componentInstance.viewHour.set(highlightedHour);
        fixture.detectChanges();

        // Act: Click minute 45 without picking an hour first.
        fixture.nativeElement.querySelector('[data-testid="test-time_m45"]').click();
        fixture.detectChanges();

        // Assert: Value carries the clicked minute with the hour the panel highlighted - not the
        // highlight shifted by the browser's UTC offset (which the old seeding produced).
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should come from the highlighted current time').toBe(highlightedHour);
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should be the clicked one').toBe(45);
        expect(getInput(fixture).value, 'input should show highlighted hour with clicked minute').toBe(`${String(highlightedHour).padStart(2, '0')}:45`);
      });

      it('should seed the untouched minute from the highlighted current time when only an hour is picked', async () => {
        // Arrange: Create component without value, open panel and shift the highlighted minute
        // by one, for the same timezone-robustness reason as the hour variant above.
        const fixture = await arrangeTimePicker({ value: null });
        await openPanel(fixture);
        expect(fixture.componentInstance.viewMinute(), 'precondition: open should seed the viewed minute').not.toBeNull();
        const highlightedMinute = ((fixture.componentInstance.viewMinute() ?? 0) + 1) % 60;
        fixture.componentInstance.viewMinute.set(highlightedMinute);
        fixture.detectChanges();

        // Act: Click hour 14 without picking a minute first.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value carries the clicked hour with the minute the panel highlighted and no
        // stray seconds.
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should be the clicked one').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should come from the highlighted current time').toBe(highlightedMinute);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
      });

      it('should clear seconds and milliseconds when changing hour on value with sub-minute parts', async () => {
        // Arrange: Create component with value carrying stray seconds and milliseconds.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30, 47, 123) });
        await openPanel(fixture);

        // Act: Click hour 15.
        fixture.nativeElement.querySelector('[data-testid="test-time_h15"]').click();
        fixture.detectChanges();

        // Assert: Selected hour applied, seconds and milliseconds dropped.
        expect(fixture.componentInstance.value()?.getUTCHours(), 'value should contain hour 15').toBe(15);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
        expect(fixture.componentInstance.value()?.getUTCMilliseconds(), 'milliseconds should be zeroed').toBe(0);
      });

      it('should clear seconds and milliseconds when changing minute on value with sub-minute parts', async () => {
        // Arrange: Create component with value carrying stray seconds and milliseconds.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30, 47, 123) });
        await openPanel(fixture);

        // Act: Click minute 45.
        fixture.nativeElement.querySelector('[data-testid="test-time_m45"]').click();
        fixture.detectChanges();

        // Assert: Selected minute applied, hour preserved, seconds and milliseconds dropped.
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'value should contain minute 45').toBe(45);
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should be preserved').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
        expect(fixture.componentInstance.value()?.getUTCMilliseconds(), 'milliseconds should be zeroed').toBe(0);
      });

      it('should normalize sub-minute parts when re-clicking selected hour with canNull false', async () => {
        // Arrange: Create component with unclean value and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30, 47, 123), canNull: false });
        await openPanel(fixture);

        // Act: Click already selected hour 14.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value is kept but normalized instead of left with stray seconds.
        expect(fixture.componentInstance.value(), 'value should stay selected').not.toBeNull();
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should stay selected').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should be preserved').toBe(30);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
        expect(fixture.componentInstance.value()?.getUTCMilliseconds(), 'milliseconds should be zeroed').toBe(0);
      });

      it('should normalize sub-minute parts when re-clicking selected minute with canNull false', async () => {
        // Arrange: Create component with unclean value and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30, 47, 123), canNull: false });
        await openPanel(fixture);

        // Act: Click already selected minute 30.
        fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').click();
        fixture.detectChanges();

        // Assert: Value is kept but normalized instead of left with stray seconds.
        expect(fixture.componentInstance.value(), 'value should stay selected').not.toBeNull();
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should stay selected').toBe(30);
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should be preserved').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
        expect(fixture.componentInstance.value()?.getUTCMilliseconds(), 'milliseconds should be zeroed').toBe(0);
      });

      it('should keep value when same hour is clicked again and canNull is false', async () => {
        // Arrange: Create component with value 14:30 and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: false });
        await openPanel(fixture);
        const before = fixture.componentInstance.value();

        // Act: Click already selected hour 14.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value is untouched (same instance proves early return) and the panel stays
        // open so the minute can still be picked.
        expect(fixture.componentInstance.value(), 're-clicking selected hour should keep value').toBe(before);
        expect(fixture.componentInstance.isClockVisible(), 'non-deselect hour click should keep panel open').toBe(true);
      });

      it('should deselect value when same hour is clicked again and canNull is true', async () => {
        // Arrange: Create deselectable component with value 14:30 and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        await openPanel(fixture);

        // Act: Click already selected hour 14.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value is deselected and the interaction is complete.
        expect(fixture.componentInstance.value(), 're-clicking selected hour with canNull should clear value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'panel should close after deselecting').toBe(false);
      });

      it('should keep value when same minute is clicked again and canNull is false', async () => {
        // Arrange: Create component with value 14:30 and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: false });
        await openPanel(fixture);
        const before = fixture.componentInstance.value();

        // Act: Click already selected minute 30.
        fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').click();
        fixture.detectChanges();

        // Assert: Value is untouched (same instance proves early return).
        expect(fixture.componentInstance.value(), 're-clicking selected minute should keep value').toBe(before);
      });

      it('should deselect value when same minute is clicked again and canNull is true', async () => {
        // Arrange: Create deselectable component with value 14:30 and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        await openPanel(fixture);

        // Act: Click already selected minute 30.
        fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').click();
        fixture.detectChanges();

        // Assert: Value is deselected.
        expect(fixture.componentInstance.value(), 're-clicking selected minute with canNull should clear value').toBeNull();
      });

      it('should ignore hour and minute selection when disabled', async () => {
        // Arrange: Create disabled component with value (panel state is irrelevant for these guards).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), disabled: true });
        const before = fixture.componentInstance.value();

        // Act: Click the hidden options directly (the disabled panel stays hidden, but the
        // options remain in the DOM - only display is toggled - so the disabled guards are
        // checked through events, same approach as the option mousedown test below).
        fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').click();
        fixture.nativeElement.querySelector('[data-testid="test-time_m5"]').click();
        fixture.detectChanges();

        // Assert: Value and keyboard cursor are untouched.
        expect(fixture.componentInstance.value(), 'disabled component should not change value').toBe(before);
        expect(fixture.componentInstance.focusedHour(), 'disabled component should not move keyboard cursor').toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'disabled component should not move keyboard cursor').toBeNull();
      });

      it('should ignore option mousedown when disabled', async () => {
        // Arrange: Create disabled component with seeded keyboard focus state.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), disabled: true });
        fixture.componentInstance.focusedHour.set(3);
        fixture.componentInstance.focusedMinute.set(7);

        // Act: Dispatch mousedown directly on both options (the disabled panel stays hidden,
        // so real pointer input never reaches them - the guard is checked directly).
        fixture.nativeElement.querySelector('[data-testid="test-time_h5"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.nativeElement.querySelector('[data-testid="test-time_m25"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();

        // Assert: Keyboard focus state is untouched.
        expect(fixture.componentInstance.focusedHour(), 'disabled component should not move focused hour').toBe(3);
        expect(fixture.componentInstance.focusedMinute(), 'disabled component should not move focused minute').toBe(7);
        expect(fixture.componentInstance.activeColumn(), 'disabled component should not change active column').toBe('hour');
      });

      it('should not open panel on click when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeTimePicker({ disabled: true });

        // Act: Click the input, then call the click handler directly
        // (browsers do not deliver clicks to disabled inputs, so guard is checked directly too).
        getInput(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        await fixture.componentInstance.handleClick();

        // Assert: Panel stays closed.
        expect(fixture.componentInstance.isClockVisible(), 'disabled component should not open on click').toBe(false);
      });

      it('should ignore input keyboard events when disabled', async () => {
        // Arrange: Create disabled but deselectable component carrying a value (so a failed
        // disabled guard would actually clear it and fail the assertion).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true, disabled: true });

        // Act: Dispatch keydown directly (disabled inputs are not focusable for real keystrokes).
        getInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        getInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel stays closed and the clear key is ignored too.
        expect(fixture.componentInstance.isClockVisible(), 'disabled component should not open via keyboard').toBe(false);
        expect(fixture.componentInstance.value(), 'disabled component should not clear its value via Backspace').not.toBeNull();
      });

      it('should ignore hour and minute listbox keyboard events when disabled', async () => {
        // Arrange: Create disabled but deselectable component with seeded keyboard focus state
        // (canNull enabled so the disabled guard - not canNull - is the only reason nothing clears).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true, disabled: true });
        fixture.componentInstance.focusedHour.set(3);
        fixture.componentInstance.focusedMinute.set(7);

        // Act: Dispatch keydown directly on both listboxes.
        fixture.componentInstance.hourRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        fixture.componentInstance.minuteRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        fixture.componentInstance.hourRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
        fixture.componentInstance.minuteRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }));
        fixture.componentInstance.hourRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
        fixture.componentInstance.minuteRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Keyboard focus state is untouched and the value is not cleared.
        expect(fixture.componentInstance.focusedHour(), 'disabled component should not move focused hour').toBe(3);
        expect(fixture.componentInstance.focusedMinute(), 'disabled component should not move focused minute').toBe(7);
        expect(fixture.componentInstance.value(), 'disabled component should not clear its value via Delete/Backspace').not.toBeNull();
      });

      it('should close open panel when disabled becomes true', async () => {
        // Arrange: Create component, open panel and spy on touch output.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);
        expect(fixture.componentInstance.isClockVisible(), 'panel should be open before disabling').toBe(true);

        // Act: Disable component programmatically while panel is open.
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Effect closed the panel and reset keyboard focus without emitting touch.
        expect(fixture.componentInstance.isClockVisible(), 'panel should close when component becomes disabled').toBe(false);
        expect(fixture.componentInstance.focusedHour(), 'focused hour should be reset when disabled').toBeNull();
        expect(touchSpy, 'programmatic closing should not emit touch').toHaveBeenCalledTimes(0);
      });

      it('should close panel and emit touch when focus leaves the component', async () => {
        // Arrange: Create component, open panel, spy on touch and create element outside the component.
        const fixture = await arrangeTimePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Simulate focus leaving to the outside element.
          getInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
          fixture.detectChanges();

          // Assert: Panel closed and touch emitted once.
          expect(fixture.componentInstance.isClockVisible(), 'panel should close when focus leaves component').toBe(false);
          expect(touchSpy, 'touch should be emitted when focus leaves component').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          outside.remove();
        }
      });

      it('should keep panel open without touch when focus moves within component', async () => {
        // Arrange: Create component, open panel and spy on touch output.
        const fixture = await arrangeTimePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);

        // Act: Simulate focus moving from input to the hour listbox inside the component.
        getInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fixture.componentInstance.hourRef().nativeElement }));
        fixture.detectChanges();

        // Assert: Internal focus move is not a real blur.
        expect(fixture.componentInstance.isClockVisible(), 'internal focus move should keep panel open').toBe(true);
        expect(touchSpy, 'internal focus move should not emit touch').not.toHaveBeenCalled();
      });

      it('should keep panel open without touch when focus moves to the configured labelTarget', async () => {
        // Arrange: Create component, configure its host's label target, open panel, spy on touch.
        const fixture = await arrangeTimePicker();
        const labelTarget = document.createElement('button');
        document.body.appendChild(labelTarget);
        fixture.componentRef.setInput('labelTarget', labelTarget);
        fixture.detectChanges();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);

        try {
          // Act: Simulate label activation moving focus from inside the picker to the target.
          getInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: labelTarget }));
          fixture.detectChanges();

          // Assert: The configured label target is the host's own relay - still "internal", so
          // it must neither close the panel nor report the control as touched.
          expect(fixture.componentInstance.isClockVisible(), 'panel should stay open when focus moves to labelTarget').toBe(true);
          expect(touchSpy, 'touch should not be emitted when focus moves to labelTarget').not.toHaveBeenCalled();
        } finally { // cleanup
          labelTarget.remove();
        }
      });

      it('should treat focus move to a foreign hidden-label-button as a real blur', async () => {
        // Arrange: Create component, open panel, spy on touch and create a foreign element that
        // carries the shared hidden-label-button class but is NOT this picker's label target.
        const fixture = await arrangeTimePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        const foreign = document.createElement('button');
        foreign.classList.add('hidden-label-button');
        document.body.appendChild(foreign);

        try {
          // Act: Simulate focus leaving to the foreign hidden button.
          getInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: foreign }));
          fixture.detectChanges();

          // Assert: The class belongs to other components' label targets too, so it must count
          // as leaving - panel closed and touch emitted once.
          expect(fixture.componentInstance.isClockVisible(), 'panel should close when focus leaves to a foreign hidden-label-button').toBe(false);
          expect(touchSpy, 'touch should be emitted when focus leaves to a foreign hidden-label-button').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          foreign.remove();
        }
      });

      it('should prevent default on mousedown on the clock panel chrome', async () => {
        // Arrange: Create component and open the panel (chrome = padding/border of the panel).
        const fixture = await arrangeTimePicker();
        await openPanel(fixture);
        const panel = fixture.componentInstance.clockPanelRef().nativeElement;

        // Act: Dispatch a real cancelable mousedown on the panel itself.
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        panel.dispatchEvent(event);

        // Assert: Default focus change is cancelled, so focus cannot jump to <body> (which the
        // focusout handler would read as leaving the component - closing panel and emitting touch).
        expect(event.defaultPrevented, 'mousedown on panel chrome should be default-prevented').toBe(true);
      });

      it('should keep default on mousedown inside a clock column', async () => {
        // Arrange: Create component and open the panel.
        const fixture = await arrangeTimePicker();
        await openPanel(fixture);
        const column = fixture.componentInstance.hourRef().nativeElement;

        // Act: Dispatch a real cancelable mousedown on the hour listbox.
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        column.dispatchEvent(event);

        // Assert: Column presses keep native behaviour (focus lands on the column, scrollbars work).
        expect(event.defaultPrevented, 'mousedown inside clock column should keep its default').toBe(false);
      });

      it('should prevent default on mousedown on a column header and focus its column', async () => {
        // Arrange: Create component and open the panel (focus starts on the hour column, so a
        // move to the minute column proves the header handler focused it).
        const fixture = await arrangeTimePicker();
        await openPanel(fixture);
        const header = fixture.nativeElement.querySelectorAll('.column-header')[1] as HTMLElement;

        // Act: Dispatch a real cancelable mousedown on the minute header.
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        header.dispatchEvent(event);

        // Assert: Default focus fixup is cancelled (it would park focus on <body> and the
        // focusout handler would close the panel), and the header's own column is focused -
        // same outcome as when the header still lived inside the scroller.
        expect(event.defaultPrevented, 'mousedown on column header should be default-prevented').toBe(true);
        expect(document.activeElement, 'mousedown on minute header should focus the minute column').toBe(fixture.componentInstance.minuteRef().nativeElement);
      });

      it('should keep default on mousedown on a time item', async () => {
        // Arrange: Create component and open the panel.
        const fixture = await arrangeTimePicker();
        await openPanel(fixture);
        const item = fixture.nativeElement.querySelector('[data-testid="test-time_h14"]');

        // Act: Dispatch a real cancelable mousedown on an hour option.
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        item.dispatchEvent(event);

        // Assert: Option presses keep native behaviour, only panel chrome is guarded.
        expect(event.defaultPrevented, 'mousedown on time item should keep its default').toBe(false);
      });

      it('should emit touch when focus leaves while panel is already closed', async () => {
        // Arrange: Create component with closed panel (state reached after Escape or keyboard
        // commit moved focus back to the input) and spy on touch output.
        const fixture = await arrangeTimePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Simulate focusout while panel is closed.
          getInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
          fixture.detectChanges();

          // Assert: Blur reports touch even though the panel was already closed.
          expect(fixture.componentInstance.isClockVisible(), 'panel should stay closed').toBe(false);
          expect(touchSpy, 'touch should be emitted when focus leaves while panel is closed').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          outside.remove();
        }
      });

      it('should not emit touch when focus returns to the input inside the component', async () => {
        // Arrange: Create component, open panel and spy on touch output.
        const fixture = await arrangeTimePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);

        // Act: Simulate focusout produced by Escape refocusing the input (relatedTarget stays inside).
        fixture.componentInstance.hourRef().nativeElement.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: getInput(fixture) }));
        fixture.detectChanges();

        // Assert: Focus never left the component, so no touch is reported (Escape closes the panel separately).
        expect(touchSpy, 'refocus onto the input should not emit touch').not.toHaveBeenCalled();
        expect(fixture.componentInstance.isClockVisible(), 'panel should stay open for internal focus move').toBe(true);
      });

      it('should not emit touch when component becomes disabled while focus is inside', async () => {
        // Arrange: Create component, open panel, spy on touch and disable it (effect closes panel).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Simulate the focusout browsers fire when the focused listbox is hidden by disabling.
          fixture.componentInstance.hourRef().nativeElement.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
          fixture.detectChanges();

          // Assert: Programmatic close caused by disabling must not report touch.
          expect(touchSpy, 'disabling should not emit touch').toHaveBeenCalledTimes(0);
        } finally { // cleanup
          outside.remove();
        }
      });

      it('should not emit touch when Escape returns focus to the input', async () => {
        // Arrange: Create component with value and open panel (focus sits in the hour listbox).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        expect(document.activeElement, 'focus should sit in the hour listbox before Escape').toBe(fixture.componentInstance.hourRef().nativeElement);

        // Act: Leave the panel via Escape (refocuses the input, then hides the panel).
        fixture.componentInstance.hidePanelAndRefocus();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus stayed inside the component, so no touch is reported.
        expect(fixture.componentInstance.isClockVisible(), 'Escape should close the panel').toBe(false);
        expect(document.activeElement, 'Escape should refocus the input').toBe(getInput(fixture));
        expect(touchSpy, 'Escape refocus should not emit touch').not.toHaveBeenCalled();
      });

      it('should close panel and emit touch on focusout without relatedTarget', async () => {
        // Arrange: Create component, open panel and spy on touch output.
        const fixture = await arrangeTimePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);

        // Act: Simulate focusout without knowing the next target (e.g. window blur).
        getInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        fixture.detectChanges();

        // Assert: Panel closed and touch emitted.
        expect(fixture.componentInstance.isClockVisible(), 'panel should close on focusout without relatedTarget').toBe(false);
        expect(touchSpy, 'touch should be emitted on focusout without relatedTarget').toHaveBeenCalledTimes(1);
      });

      it('should open closed panel only on showPanel', async () => {
        // Arrange: Create component with closed panel.
        const fixture = await arrangeTimePicker();

        // Act: Show panel twice.
        await fixture.componentInstance.showPanel();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isClockVisible(), 'showPanel should open closed panel').toBe(true);

        // Assert: Second call keeps panel open (it only opens).
        await fixture.componentInstance.showPanel();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isClockVisible(), 'showPanel should keep open panel open').toBe(true);
      });

      it('should not open panel via showPanel when disabled', async () => {
        // Arrange: Create disabled component with closed panel.
        const fixture = await arrangeTimePicker({ disabled: true });

        // Act: Attempt programmatic open.
        await fixture.componentInstance.showPanel();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel stays closed and no focus is stolen into the listbox.
        expect(fixture.componentInstance.isClockVisible(), 'showPanel must not open the panel of a disabled picker').toBe(false);
        expect(document.activeElement, 'showPanel must not move focus into the panel while disabled')
          .not.toBe(fixture.componentInstance.hourRef().nativeElement);
      });
    });

    describe('positioning', () => {
      /** Height assumed for the panel, so the "fits above the anchor" comparisons have a value. */
      const PANEL_HEIGHT = 200;
      /** Anchor top with room for a `PANEL_HEIGHT`-tall panel above it. */
      const ANCHOR_TOP_WITH_ROOM = 400;
      /** Anchor top without room for a `PANEL_HEIGHT`-tall panel above it. */
      const ANCHOR_TOP_NO_ROOM = 100;

      /**
       * Build the panel rect parts read by the positioning logic.
       * Defaults model a panel that fits into the viewport on both axes.
       * @param overrides Rect parts to override the fitting defaults.
       * @returns DOMRect containing (at least) `right`, `bottom` and `height`.
       */
      function panelRect(overrides: Partial<DOMRect> = {}): DOMRect {
        return {
          right: VIEWPORT_WIDTH - 100,
          bottom: VIEWPORT_HEIGHT - 100,
          height: PANEL_HEIGHT,
          ...overrides,
        } as DOMRect;
      }

      /**
       * Stub the picker root geometry - it is the panel's containing block, so its top edge
       * is the space available above the anchor for an upward flip.
       * @param fixture Fixture of the component.
       * @param top Distance of the anchor's top edge from the viewport top.
       */
      function stubAnchorGeometry(fixture: ComponentFixture<TimePicker>, top: number): void {
        const anchor = fixture.nativeElement.querySelector('.picker-time');
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
      }

      /**
       * Close the clock panel with a mouse click on the input and flush pending component work.
       * Mirrors the flushing of the `openPanel` helper so the async close cycle fully settles.
       * @param fixture Fixture of the component.
       */
      async function closePanel(fixture: ComponentFixture<TimePicker>): Promise<void> {
        getInput(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      }

      it('should right-align panel when it would overflow the viewport', async () => {
        // Arrange: Create component and stub panel geometry to report horizontal overflow only.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(panelRect({ right: VIEWPORT_WIDTH + 50 }));

        // Act: Open the panel (positioning is recomputed after render).
        await openPanel(fixture);

        // Assert: Panel is right-aligned (CSSOM normalizes unitless zero to pixels).
        expect(panel.style.left, 'panel should not be left-aligned on overflow').toBe('auto');
        expect(panel.style.right, 'panel should be right-aligned on overflow').toBe('0px');
        expect(panel.style.top, 'panel should stay below the input when it fits vertically').toBe('100%');
        expect(panel.style.bottom, 'panel should stay below the input when it fits vertically').toBe('auto');
      });

      it('should restore left alignment when panel fits into the viewport', async () => {
        // Arrange: Open panel with overflow geometry first to get into right-aligned state.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        const geometrySpy = vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(panelRect({ right: VIEWPORT_WIDTH + 50 }));
        await openPanel(fixture);
        expect(panel.style.right, 'panel should start right-aligned on overflow').toBe('0px');

        // Act: Panel now fits, so close and reopen it.
        await closePanel(fixture);
        geometrySpy.mockReturnValue(panelRect());
        await openPanel(fixture);

        // Assert: Panel alignment flipped back to the left.
        expect(panel.style.left, 'panel should be left-aligned when it fits').toBe('0px');
        expect(panel.style.right, 'panel should not be right-aligned when it fits').toBe('auto');
      });

      it('should keep right alignment on reopen while the panel still overflows', async () => {
        // Arrange: Geometry models real layout - left-aligned panel pokes out of the viewport,
        // right-aligned panel fits (its right edge sits at the anchor, inside the viewport).
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() =>
          panel.style.left === 'auto'
            ? panelRect({ right: VIEWPORT_WIDTH - 100 })
            : panelRect({ right: VIEWPORT_WIDTH + 50 }),
        );

        // Act: Open, close, open again.
        await openPanel(fixture);
        expect(panel.style.right, 'first open should right-align the overflowing panel').toBe('0px');
        await closePanel(fixture);
        await openPanel(fixture);

        // Assert: Measurement ran under the reset baseline, so the panel must NOT revert to
        // left alignment (the old code measured under the persisted right alignment, saw
        // "fits" and wrote left - leaving an overflowing panel on every even reopen).
        expect(panel.style.right, 'reopen must keep right alignment while the panel overflows').toBe('0px');
        expect(panel.style.left, 'reopen must keep right alignment while the panel overflows').toBe('auto');
      });

      it('should flip panel above the input when it would overflow the viewport bottom', async () => {
        // Arrange: Geometry fits horizontally but pokes out below the viewport, with room
        // above the input for the flipped panel.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(panelRect({ bottom: VIEWPORT_HEIGHT + 50 }));
        stubAnchorGeometry(fixture, ANCHOR_TOP_WITH_ROOM);

        // Act: Open the panel.
        await openPanel(fixture);

        // Assert: Panel is flipped above the input (bottom: 100% mirrors the CSS top: 100%).
        expect(panel.style.top, 'panel should not stay below the input on vertical overflow').toBe('auto');
        expect(panel.style.bottom, 'panel should sit above the input on vertical overflow').toBe('100%');
        expect(panel.style.left, 'panel should stay left-aligned when it fits horizontally').toBe('0px');
        expect(panel.style.right, 'panel should stay left-aligned when it fits horizontally').toBe('auto');
      });

      it('should keep panel below the input when it fits on neither side', async () => {
        // Arrange: Panel overflows the viewport bottom and is taller than the space above the input.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(panelRect({ bottom: VIEWPORT_HEIGHT + 50 }));
        stubAnchorGeometry(fixture, ANCHOR_TOP_NO_ROOM);

        // Act: Open the panel.
        await openPanel(fixture);

        // Assert: Panel stays below the input so the user can scroll down, instead of being
        // pushed off the top of the viewport.
        expect(panel.style.top, 'panel should stay below the input when there is no room above').toBe('100%');
        expect(panel.style.bottom, 'panel should not flip above the input without room above').toBe('auto');
      });

      it('should restore placement below the input when it fits again', async () => {
        // Arrange: Open with vertical overflow first to get into flipped-above state.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        const geometrySpy = vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(panelRect({ bottom: VIEWPORT_HEIGHT + 50 }));
        stubAnchorGeometry(fixture, ANCHOR_TOP_WITH_ROOM);
        await openPanel(fixture);
        expect(panel.style.bottom, 'panel should start flipped above on vertical overflow').toBe('100%');

        // Act: Panel now fits, so close and reopen it.
        await closePanel(fixture);
        geometrySpy.mockReturnValue(panelRect());
        await openPanel(fixture);

        // Assert: Panel placement flipped back below the input.
        expect(panel.style.top, 'panel should be below the input when it fits').toBe('100%');
        expect(panel.style.bottom, 'panel should not stay above the input when it fits').toBe('auto');
      });
    });

    describe('invalid value', () => {
      /** Date the parser rejects: every UTC accessor on it returns NaN. */
      const invalidDate = new Date('not-a-date');

      it('should show empty value instead of NaN when value is an invalid Date', async () => {
        // Arrange: Create component fed an invalid Date (e.g. parsed from garbage input).
        const fixture = await arrangeTimePicker({ value: invalidDate });

        // Assert: Input stays empty so the placeholder shows - no NaN leaks into the field.
        expect(getInput(fixture).value, 'input must not show NaN:NaN for an invalid Date').toBe('');
      });

      it('should seed keyboard cursor from current time when value is an invalid Date', async () => {
        // Arrange: Create component fed an invalid Date and open the panel.
        const fixture = await arrangeTimePicker({ value: invalidDate });
        await openPanel(fixture);

        // Assert: Cursor lands on the highlighted current hour, not on a NaN index.
        expect(
          fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'),
          'hour activedescendant must reference the highlighted current hour',
        ).toBe(`test-time_opt_h${fixture.componentInstance.viewHour()}`);
      });

      it('should heal an invalid value when an hour is clicked', async () => {
        // Arrange: Create component fed an invalid Date and open the panel.
        const fixture = await arrangeTimePicker({ value: invalidDate });
        await openPanel(fixture);

        // Act: Click hour 14.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value became a valid Date carrying the clicked hour.
        const healed = fixture.componentInstance.value();
        expect(healed !== null && !Number.isNaN(healed.getTime()), 'value must become a valid Date after clicking an hour').toBe(true);
        expect(healed?.getUTCHours(), 'healed value must carry the clicked hour').toBe(14);
      });

      it('should heal an invalid value when a minute is clicked', async () => {
        // Arrange: Create component fed an invalid Date and open the panel.
        const fixture = await arrangeTimePicker({ value: invalidDate });
        await openPanel(fixture);

        // Act: Click minute 45.
        fixture.nativeElement.querySelector('[data-testid="test-time_m45"]').click();
        fixture.detectChanges();

        // Assert: Value became a valid Date carrying the clicked minute.
        const healed = fixture.componentInstance.value();
        expect(healed !== null && !Number.isNaN(healed.getTime()), 'value must become a valid Date after clicking a minute').toBe(true);
        expect(healed?.getUTCMinutes(), 'healed value must carry the clicked minute').toBe(45);
      });

      it('should clear an invalid value with Backspace from the input when canNull', async () => {
        // Arrange: Component fed an invalid Date (a non-null corrupt value), deselectable,
        // input focused with panel closed; touch must stay silent.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: invalidDate, canNull: true });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const input = focusInputWithoutOpening(fixture);

        // Act: Press Backspace.
        await user.keyboard('{Backspace}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: The corrupt value counts as an existing value and is cleared, so the model
        // is healed to null; clearing is not a blur, so focus and panel stay untouched.
        expect(fixture.componentInstance.value(), 'Backspace with canNull must clear an invalid value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'clearing from the input should keep the panel closed').toBe(false);
        expect(document.activeElement, 'focus should stay on the input').toBe(input);
        expect(touchSpy, 'clearing without focus movement should not emit touch').not.toHaveBeenCalled();
      });

      it('should clear an invalid value with Delete from the hour listbox and close the panel when canNull', async () => {
        // Arrange: Component fed an invalid Date, deselectable, panel open with focus in the hour listbox.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: invalidDate, canNull: true });
        await openPanel(fixture);

        // Act: Press Delete.
        await user.keyboard('{Delete}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Corrupt value cleared, so the interaction completes exactly like a normal
        // clear - panel closes and focus returns to the input internally.
        expect(fixture.componentInstance.value(), 'Delete with canNull must clear an invalid value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'clearing should complete the interaction and close the panel').toBe(false);
        expect(document.activeElement, 'focus should return to the input').toBe(getInput(fixture));
      });
    });
  });

  describe('i18n', () => {
    it('should update placeholder and translated labels on language switch', async () => {
      // Arrange: Create component with English translations registered before creation.
      const fixture = await arrangeTimePicker({
        value: null,
        translations: { dateTimePicker: { placeholder: { time: 'hh:mm' }, time: 'Time', timePicker: 'Time picker', hour: 'Hour', minute: 'Minute' } },
      });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('pl', { dateTimePicker: { placeholder: { time: 'gg:mm' }, time: 'Czas', timePicker: 'Wybór czasu', hour: 'Godzina', minute: 'Minuta' } });
      expect(getInput(fixture).getAttribute('placeholder'), 'precondition: placeholder should show English text').toContain('hh:mm');

      // Act: Activate Polish while the component is alive.
      await firstValueFrom(translateService.use('pl'));
      await fixture.whenStable();
      fixture.detectChanges();

      // Assert: Placeholder follows the language; pipe-based labels (columns, input fallback and
      // dialog name) prove they all update together.
      expect(getInput(fixture).getAttribute('placeholder'), 'placeholder should switch to Polish text').toContain('gg:mm');
      expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-label'), 'hour label should switch to Polish text').toBe('Godzina');
      expect(getInput(fixture).getAttribute('aria-label'), 'input fallback should switch to Polish text').toBe('Czas');
      expect(fixture.nativeElement.querySelector('[data-testid="test-time_panel"]').getAttribute('aria-label'), 'dialog label should switch to Polish text').toBe('Wybór czasu');
    });
  });

  describe('accessibility', () => {
    describe('aria', () => {
      it('should have combobox role and aria-haspopup dialog on input', async () => {
        // Arrange: Create component.
        const fixture = await arrangeTimePicker();
        const input = getInput(fixture);

        // Assert: Combobox semantics present; popup announced as dialog because aria-controls
        // references the role=dialog panel, not a listbox directly.
        expect(input.getAttribute('role'), 'should have combobox role').toBe('combobox');
        expect(input.getAttribute('aria-haspopup'), 'should have dialog popup').toBe('dialog');
      });

      it('should link aria-controls to panel id', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeTimePicker({ ident: 'my-time' });

        // Assert: aria-controls matches panel element id.
        const input = fixture.nativeElement.querySelector('[data-testid="my-time_input"]');
        const panel = fixture.nativeElement.querySelector('[data-testid="my-time_panel"]');
        expect(input.getAttribute('aria-controls'), 'aria-controls should reference panel id').toBe('my-time_panel');
        expect(panel.getAttribute('id'), 'panel id should follow ident pattern').toBe('my-time_panel');
        expect(input.getAttribute('aria-controls'), 'aria-controls should equal actual panel id').toBe(panel.getAttribute('id'));
      });

      it('should have dialog role and no aria-modal on panel', async () => {
        // Arrange: Create component.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');

        // Assert: Panel is a non-modal dialog - Tab intentionally leaves the component, so
        // claiming modality would tell AT the background is inert when it is not.
        expect(panel.getAttribute('role'), 'panel should have dialog role').toBe('dialog');
        expect(panel.hasAttribute('aria-modal'), 'panel should not claim to be modal').toBe(false);
      });

      it('should have listbox roles, aria-labels, aria-orientation and tabindex -1 on columns', async () => {
        // Arrange: Create component (translations not registered, keys are rendered).
        const fixture = await arrangeTimePicker();
        const hourBox = fixture.componentInstance.hourRef().nativeElement;
        const minuteBox = fixture.componentInstance.minuteRef().nativeElement;

        // Assert: Columns are activedescendant-managed vertical listboxes labelled by translation
        // keys; orientation matches the visual layout and the Up/Down option navigation.
        expect(hourBox.getAttribute('role'), 'hour column should have listbox role').toBe('listbox');
        expect(minuteBox.getAttribute('role'), 'minute column should have listbox role').toBe('listbox');
        expect(hourBox.getAttribute('aria-label'), 'hour column should be labelled with translation key').toBe('dateTimePicker.hour');
        expect(minuteBox.getAttribute('aria-label'), 'minute column should be labelled with translation key').toBe('dateTimePicker.minute');
        expect(hourBox.getAttribute('aria-orientation'), 'hour column should declare vertical orientation').toBe('vertical');
        expect(minuteBox.getAttribute('aria-orientation'), 'minute column should declare vertical orientation').toBe('vertical');
        expect(hourBox.getAttribute('tabindex'), 'hour column should not be a tab stop').toBe('-1');
        expect(minuteBox.getAttribute('tabindex'), 'minute column should not be a tab stop').toBe('-1');
      });

      it('should use translated column labels when translations are provided', async () => {
        // Arrange: Create component with column label translations.
        const fixture = await arrangeTimePicker({
          translations: { dateTimePicker: { hour: 'Hour', minute: 'Minute' } },
        });

        // Assert: Column labels are translated.
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-label'), 'hour column label should be translated').toBe('Hour');
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-label'), 'minute column label should be translated').toBe('Minute');
      });

      it('should not set aria-activedescendant when nothing is focused', async () => {
        // Arrange: Create component without opening the panel.
        const fixture = await arrangeTimePicker();

        // Assert: Neither listbox references an active option.
        expect(fixture.componentInstance.hourRef().nativeElement.hasAttribute('aria-activedescendant'), 'hour activedescendant should be absent').toBe(false);
        expect(fixture.componentInstance.minuteRef().nativeElement.hasAttribute('aria-activedescendant'), 'minute activedescendant should be absent').toBe(false);
      });

      it('should set aria-activedescendant to focused option ids after keyboard open', async () => {
        // Arrange: Create component with value 14:30 and focus input without auto-open.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        focusInputWithoutOpening(fixture);

        // Act: Open the panel via keyboard.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Keyboard focus seeded from value and referenced on the focused (hour)
        // column; the inactive minute column stays silent (the test below covers the switch).
        expect(fixture.componentInstance.focusedHour(), 'focused hour should come from value').toBe(14);
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should come from value').toBe(30);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference focused option').toBe('test-time_opt_h14');
        expect(fixture.componentInstance.minuteRef().nativeElement.hasAttribute('aria-activedescendant'), 'inactive minute listbox must not reference an active option').toBe(false);

        // Act: Switch keyboard focus to the minute listbox.
        await user.keyboard('{ArrowRight}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: The seeded minute becomes the announced option once its column is active.
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-activedescendant'), 'active minute activedescendant should reference focused option').toBe('test-time_opt_m30');
      });

      it('should set aria-activedescendant only on the active column', async () => {
        // Arrange: Create component with value 14:30 and open the panel - focus lands in the
        // hour listbox, but BOTH cursors are seeded on open (setupFocus on every open).
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);

        // Assert: Only the focused (hour) listbox references its active option. The inactive
        // minute listbox must stay silent - aria-activedescendant belongs to the widget that
        // holds DOM focus, mirroring how the .focused ring is gated on the active column.
        expect(fixture.componentInstance.hourRef().nativeElement.hasAttribute('aria-activedescendant'), 'active hour listbox should reference its active option').toBe(true);
        expect(fixture.componentInstance.minuteRef().nativeElement.hasAttribute('aria-activedescendant'), 'inactive minute listbox must not reference an active option').toBe(false);

        // Act: Switch keyboard focus to the minute listbox.
        await user.keyboard('{ArrowRight}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: The reference follows the active column - minute gains it, hour loses it.
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-activedescendant'), 'active minute listbox should reference its active option').toBe('test-time_opt_m30');
        expect(fixture.componentInstance.hourRef().nativeElement.hasAttribute('aria-activedescendant'), 'inactive hour listbox must not reference an active option').toBe(false);
      });

      it('should set aria-selected only on selected options', async () => {
        // Arrange: Create component with value 14:30.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Assert: Only matching options are selected.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').getAttribute('aria-selected'), 'hour 14 should be aria-selected').toBe('true');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h13"]').getAttribute('aria-selected'), 'hour 13 should not be aria-selected').toBe('false');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').getAttribute('aria-selected'), 'minute 30 should be aria-selected').toBe('true');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m29"]').getAttribute('aria-selected'), 'minute 29 should not be aria-selected').toBe('false');
      });

      it('should set aria-current on exactly one option per column, mirroring the curr class', async () => {
        // Arrange: Create component with value 14:30 (panel closed, no viewed time yet).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Open the clock panel (this seeds the viewed/current local time).
        await openPanel(fixture);
        const viewHour = fixture.componentInstance.viewHour() ?? 0;
        const viewMinute = fixture.componentInstance.viewMinute() ?? 0;
        const root: HTMLElement = fixture.nativeElement;
        const currentHours = root.querySelectorAll('.time-hour[aria-current]');
        const currentMinutes = root.querySelectorAll('.time-minute[aria-current]');

        // Assert: Exactly one option per column carries aria-current="time" and it is the option
        // marked with the `curr` class (expected value comes from the component's own viewed
        // time, so the test cannot flake on a wall-clock rollover mid-test).
        expect(currentHours.length, 'exactly one hour should expose aria-current').toBe(1);
        expect(currentHours[0].getAttribute('aria-current'), 'hour aria-current should use the time token').toBe('time');
        expect(currentHours[0], 'hour aria-current should mirror the curr class').toBe(root.querySelector('.time-hour.curr'));
        expect(root.querySelector(`[data-testid="test-time_h${viewHour}"]`)?.getAttribute('aria-current'), 'aria-current should sit on the viewed hour').toBe('time');
        expect(currentMinutes.length, 'exactly one minute should expose aria-current').toBe(1);
        expect(currentMinutes[0].getAttribute('aria-current'), 'minute aria-current should use the time token').toBe('time');
        expect(currentMinutes[0], 'minute aria-current should mirror the curr class').toBe(root.querySelector('.time-minute.curr'));
        expect(root.querySelector(`[data-testid="test-time_m${viewMinute}"]`)?.getAttribute('aria-current'), 'aria-current should sit on the viewed minute').toBe('time');
        expect(root.querySelector(`[data-testid="test-time_h${(viewHour + 1) % 24}"]`)?.hasAttribute('aria-current'), 'non-current hour must not expose aria-current').toBe(false);
        expect(root.querySelector(`[data-testid="test-time_m${(viewMinute + 1) % 60}"]`)?.hasAttribute('aria-current'), 'non-current minute must not expose aria-current').toBe(false);
      });

      it('should not set aria-current before the panel computes the viewed time', async () => {
        // Arrange: Create component with value while the panel stays closed.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Assert: No option claims to be current before findViewTime ran.
        expect(fixture.nativeElement.querySelectorAll('[aria-current]').length, 'no option should expose aria-current while the panel is closed').toBe(0);
      });

      it('should keep aria-current alongside aria-selected when the value equals the current time', async () => {
        // Arrange: Open the panel without a value so the viewed time is seeded.
        const fixture = await arrangeTimePicker({ value: null });
        await openPanel(fixture);

        // Act: Select the viewed time itself, so selected and current land on the same options.
        const viewHour = fixture.componentInstance.viewHour() ?? 0;
        const viewMinute = fixture.componentInstance.viewMinute() ?? 0;
        fixture.componentRef.setInput('value', utcTime(viewHour, viewMinute));
        fixture.detectChanges();
        await fixture.whenStable();
        const root: HTMLElement = fixture.nativeElement;
        const hourOption = root.querySelector(`[data-testid="test-time_h${viewHour}"]`);
        const minuteOption = root.querySelector(`[data-testid="test-time_m${viewMinute}"]`);

        // Assert: The two states coexist on the same option without overriding each other.
        expect(hourOption?.getAttribute('aria-selected'), 'viewed hour should also be aria-selected').toBe('true');
        expect(hourOption?.getAttribute('aria-current'), 'viewed hour should also expose aria-current').toBe('time');
        expect(minuteOption?.getAttribute('aria-selected'), 'viewed minute should also be aria-selected').toBe('true');
        expect(minuteOption?.getAttribute('aria-current'), 'viewed minute should also expose aria-current').toBe('time');
      });

      it('should set option ids following ident_opt_h and ident_opt_m patterns', async () => {
        // Arrange: Create component with value 14:30.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Assert: Option ids follow the documented pattern used by aria-activedescendant.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').getAttribute('id'), 'hour option id should follow pattern').toBe('test-time_opt_h14');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').getAttribute('id'), 'minute option id should follow pattern').toBe('test-time_opt_m30');
      });

      it('should set option aria-labels with translation keys', async () => {
        // Arrange: Create component (translations not registered, keys are rendered).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Assert: Option labels combine value with translation key.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').getAttribute('aria-label'), 'hour option label should contain translation key').toBe('14 dateTimePicker.hour');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').getAttribute('aria-label'), 'minute option label should contain translation key').toBe('30 dateTimePicker.minute');
      });

      it('should set data-testid from ident on input and panel', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeTimePicker({ ident: 'my-time' });

        // Assert: Input and panel use ident-based testids.
        expect(fixture.nativeElement.querySelector('[data-testid="my-time_input"]'), 'input testid should follow ident pattern').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="my-time_panel"]'), 'panel testid should follow ident pattern').not.toBeNull();
      });

      it('should set aria-labelledby on input from label input', async () => {
        // Arrange: Create component with label reference.
        const fixture = await arrangeTimePicker({ label: 'my-label' });

        // Assert: Input is labelled by the given label reference.
        expect(getInput(fixture).getAttribute('aria-labelledby'), 'aria-labelledby should match label input').toBe('my-label');
      });

      it('should not set aria-labelledby when label is empty', async () => {
        // Arrange: Create component without label reference.
        const fixture = await arrangeTimePicker({ label: '' });

        // Assert: aria-labelledby is absent.
        expect(getInput(fixture).hasAttribute('aria-labelledby'), 'aria-labelledby should be absent without label').toBe(false);
      });

      it('should set aria-label fallback on input when no label is given', async () => {
        // Arrange: Create component without label reference (no translations registered, so the
        // translation key is rendered).
        const fixture = await arrangeTimePicker({ label: '' });

        // Assert: Input is named by the dedicated fallback key, not by the placeholder ("hh:mm").
        expect(getInput(fixture).getAttribute('aria-label'), 'input should fall back to the dedicated time key').toBe('dateTimePicker.time');
      });

      it('should use translated aria-label fallback when translations are provided', async () => {
        // Arrange: Create component with translations registered before creation.
        const fixture = await arrangeTimePicker({
          label: '',
          translations: { dateTimePicker: { time: 'Time' } },
        });

        // Assert: Fallback name is resolved via translation.
        expect(getInput(fixture).getAttribute('aria-label'), 'input fallback should be translated').toBe('Time');
      });

      it('should not set aria-label on input when label is given', async () => {
        // Arrange: Create component with label reference.
        const fixture = await arrangeTimePicker({ label: 'my-label' });

        // Assert: aria-labelledby is the only name source - an aria-label would shadow a native
        // <label for> (accname gives aria-label precedence over native labelling).
        expect(getInput(fixture).hasAttribute('aria-label'), 'aria-label must be absent when a label is given').toBe(false);
        expect(getInput(fixture).getAttribute('aria-labelledby'), 'aria-labelledby should still name the input').toBe('my-label');
      });

      it('should label the dialog with a dedicated key instead of the placeholder', async () => {
        // Arrange: Create component (no translations registered, so keys are rendered).
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');

        // Assert: Dialog is named by its own key - the placeholder ("hh:mm") is a format hint.
        expect(panel.getAttribute('aria-label'), 'dialog should use the dedicated timePicker key').toBe('dateTimePicker.timePicker');
        expect(panel.getAttribute('aria-label'), 'dialog must not be named after the placeholder key').not.toBe('dateTimePicker.placeholder.time');
      });

      it('should set aria-required on input from required input', async () => {
        // Arrange: Create required component.
        const fixture = await arrangeTimePicker({ required: true });

        // Assert: aria-required reports required state.
        expect(getInput(fixture).getAttribute('aria-required'), 'aria-required should be true when required').toBe('true');
      });

      it('should not set aria-required when required is false', async () => {
        // Arrange: Create component without required.
        const fixture = await arrangeTimePicker({ required: false });

        // Assert: aria-required is absent.
        expect(getInput(fixture).hasAttribute('aria-required'), 'aria-required should be absent when not required').toBe(false);
      });
    });

    describe('keyboard: input', () => {
      it('should open panel and focus hour listbox on Enter, Space and ArrowDown', async () => {
        // Arrange: Create component, focus input without triggering focus-open.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        const input = focusInputWithoutOpening(fixture);
        expect(fixture.componentInstance.isClockVisible(), 'suppressed focus should not open panel').toBe(false);

        // Act: Press Enter.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel open, focus moved into hour listbox.
        expect(fixture.componentInstance.isClockVisible(), 'Enter should open the panel').toBe(true);
        expect(document.activeElement, 'Enter should move focus to hour listbox').toBe(fixture.componentInstance.hourRef().nativeElement);

        // Act: Escape closes panel and returns focus to input.
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isClockVisible(), 'Escape should close the panel').toBe(false);
        expect(document.activeElement, 'Escape should return focus to input').toBe(input);

        // Act: Press Space.
        await user.keyboard(' ');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isClockVisible(), 'Space should open the panel').toBe(true);

        // Act: Close again and press ArrowDown.
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: ArrowDown opens the panel as well.
        expect(fixture.componentInstance.isClockVisible(), 'ArrowDown should open the panel').toBe(true);
      });

      it('should seed keyboard focus from current time on keyboard open when no value', async () => {
        // Arrange: Create component without value and focus input without auto-open.
        const fixture = await arrangeTimePicker({ value: null });
        focusInputWithoutOpening(fixture);

        // Act: Open the panel via keyboard.
        const user = userEvent.setup();
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Keyboard focus seeded from viewed (current) time.
        expect(fixture.componentInstance.focusedHour(), 'focused hour should come from current time').toBe(fixture.componentInstance.viewHour());
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should come from current time').toBe(fixture.componentInstance.viewMinute());
        expect(fixture.componentInstance.focusedHour(), 'focused hour should be set').not.toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should be set').not.toBeNull();
      });

      it('should clear value with Backspace and Delete when canNull, keeping focus and panel state', async () => {
        // Arrange: Deselectable component with value, input focused and panel closed; touch must stay silent.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const input = focusInputWithoutOpening(fixture);

        // Act: Press Backspace.
        await user.keyboard('{Backspace}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Value cleared; focus and panel untouched (clearing is not a blur).
        expect(fixture.componentInstance.value(), 'Backspace with canNull should clear the value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'clearing from the input should keep the panel closed').toBe(false);
        expect(document.activeElement, 'focus should stay on the input').toBe(input);
        expect(touchSpy, 'clearing without focus movement should not emit touch').not.toHaveBeenCalled();

        // Act: Seed a value again and press Delete.
        fixture.componentInstance.value.set(utcTime(20, 5));
        fixture.detectChanges();
        await user.keyboard('{Delete}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Delete clears exactly like Backspace.
        expect(fixture.componentInstance.value(), 'Delete with canNull should clear the value').toBeNull();

        // Act: Press Backspace once more on the already-null value.
        await user.keyboard('{Backspace}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Repeat clear is a harmless no-op.
        expect(fixture.componentInstance.value(), 'clearing an already-null value should stay null').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'no-op clear should keep the panel closed').toBe(false);
        expect(touchSpy, 'repeated clearing should still not emit touch').not.toHaveBeenCalled();
      });

      it('should keep the value on Backspace when canNull is false and still prevent the default', async () => {
        // Arrange: Component with value but canNull disabled.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: false });

        // Act: Dispatch a cancelable Backspace keydown directly (userEvent does not expose the event object).
        const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        getInput(fixture).dispatchEvent(event);
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Value untouched, but the key is swallowed anyway - a readonly input must never
        // hand Backspace to the browser's legacy history-back handling.
        expect(fixture.componentInstance.value(), 'Backspace without canNull should keep the value').not.toBeNull();
        expect(event.defaultPrevented, 'Backspace should be default-prevented even when canNull is false').toBe(true);
      });
    });

    describe('keyboard: hour listbox', () => {
      it('should move focused hour down with wraparound', async () => {
        // Arrange: Create component, open panel (focus sits in hour listbox) and seed focus.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);

        // Act: Press ArrowDown.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'ArrowDown should advance hour from 14 to 15').toBe(15);

        // Act: Press ArrowDown on last hour.
        fixture.componentInstance.focusedHour.set(23);
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Wraparound to first hour.
        expect(fixture.componentInstance.focusedHour(), 'ArrowDown from 23 should wrap to 0').toBe(0);
      });

      it('should move focused hour up with wraparound', async () => {
        // Arrange: Create component, open panel and seed focus on first hour.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(0);

        // Act: Press ArrowUp.
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'ArrowUp from 0 should wrap to 23').toBe(23);

        // Act: Press ArrowUp on middle hour.
        fixture.componentInstance.focusedHour.set(15);
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Moved one hour up.
        expect(fixture.componentInstance.focusedHour(), 'ArrowUp should decrease hour').toBe(14);
      });

      it('should jump to first and last hour on Home and End', async () => {
        // Arrange: Create component, open panel and seed focus.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(10);

        // Act: Press Home.
        await user.keyboard('{Home}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'Home should jump to first hour').toBe(0);

        // Act: Press End.
        await user.keyboard('{End}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Jumped to last hour.
        expect(fixture.componentInstance.focusedHour(), 'End should jump to last hour').toBe(23);
      });

      it('should page hours by the measured page size, clamping and then wrapping at the ends', async () => {
        // Arrange: Open panel, stub geometry so the page step is measurable (jsdom has no
        // layout): 180 (the 200px row minus the header, which now sits OUTSIDE the scroller)
        // / 20 option = 9 visible, minus 1 overlap => step 8.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        stubColumnGeometry(fixture, 'hour', { clientHeight: 180, optionHeight: 20 });
        fixture.componentInstance.focusedHour.set(10);

        // Act: Page down from 10.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'PageDown should move by the measured step of 8 (10 -> 18)').toBe(18);

        // Act: Page down again - 18 + 8 overshoots the list end.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'PageDown should clamp onto hour 23 instead of wrapping right away').toBe(23);

        // Act: Page down again - cursor already stands on the end item.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'PageDown from hour 23 should wrap to 0').toBe(0);

        // Act: Page down again - stepping resumes from the wrapped position.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Normal step after the wrap, with AT state following the new cursor.
        expect(fixture.componentInstance.focusedHour(), 'PageDown after wrapping should apply the step again (0 -> 8)').toBe(8);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should follow the paged cursor').toBe('test-time_opt_h8');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h8"]').classList.contains('focused'), 'paged-to hour should carry the focus highlight').toBe(true);
      });

      it('should page hours backward by the measured page size, clamping and then wrapping at the ends', async () => {
        // Arrange: Open panel, stub geometry (see previous test - step is 8) and seed near the start.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        stubColumnGeometry(fixture, 'hour', { clientHeight: 180, optionHeight: 20 });
        fixture.componentInstance.focusedHour.set(5);

        // Act: Page up from 5 - 5 - 8 undershoots the list start.
        await user.keyboard('{PageUp}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'PageUp should clamp onto hour 0 instead of wrapping right away').toBe(0);

        // Act: Page up again - cursor already stands on the first item.
        await user.keyboard('{PageUp}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'PageUp from hour 0 should wrap to 23').toBe(23);

        // Act: Page up again - stepping resumes from the wrapped position.
        await user.keyboard('{PageUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Normal step after the wrap.
        expect(fixture.componentInstance.focusedHour(), 'PageUp after wrapping should apply the step again (23 -> 15)').toBe(15);
      });

      it('should only seed the focused hour from the value when no hour is focused yet', async () => {
        // Arrange: Open panel (value 14:30 seeds the cursor) and clear it to reach the unfocused state.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(null);

        // Act: Press PageDown with nothing focused yet.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: The press only shows focus on the value's hour - no page jump, mirroring how
        // the Arrow keys treat a null cursor.
        expect(fixture.componentInstance.focusedHour(), 'first PageDown should seed from value without paging (14 stays 14)').toBe(14);
      });

      it('should cancel the native page scroll of PageUp and PageDown on both listboxes', async () => {
        // Arrange: Open panel so both listboxes carry their keyboard handlers.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        const hourBox = fixture.componentInstance.hourRef().nativeElement;
        const minuteBox = fixture.componentInstance.minuteRef().nativeElement;

        // Act: Dispatch cancelable keydowns directly - userEvent does not expose the event object.
        const pageDown = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
        const pageUp = new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true });
        hourBox.dispatchEvent(pageDown);
        minuteBox.dispatchEvent(pageUp);
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Without preventDefault the browser scrolls the column natively and the
        // highlight stays behind - the keys must be fully owned by the component.
        expect(pageDown.defaultPrevented, 'PageDown should be default-prevented on the hour listbox').toBe(true);
        expect(pageUp.defaultPrevented, 'PageUp should be default-prevented on the minute listbox').toBe(true);
      });

      it('should advance from seeded hour on first ArrowDown', async () => {
        // Arrange: Create component with value 14:30 and open panel (open seeds focus from value).
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        expect(fixture.componentInstance.focusedHour(), 'open should seed focused hour from value').toBe(14);

        // Act: Press ArrowDown for the first time.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'first ArrowDown should advance past seeded hour').toBe(15);

        // Act: Press ArrowDown again.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Second press moves one hour further down.
        expect(fixture.componentInstance.focusedHour(), 'second ArrowDown should advance hour').toBe(16);
      });

      it('should switch to minute column on ArrowRight when both columns focused', async () => {
        // Arrange: Create component, open panel and seed focus for both columns.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);
        fixture.componentInstance.focusedMinute.set(30);
        fixture.componentInstance.activeColumn.set('hour');

        // Act: Press ArrowRight in hour listbox.
        await user.keyboard('{ArrowRight}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Active column switched and DOM focus moved into minute listbox.
        expect(fixture.componentInstance.activeColumn(), 'ArrowRight should activate minute column').toBe('minute');
        expect(document.activeElement, 'ArrowRight should focus minute listbox').toBe(fixture.componentInstance.minuteRef().nativeElement);
      });

      it('should select focused hour and focus minute column on Enter', async () => {
        // Arrange: Create component with value 14:05, open panel and seed focused hour.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 5) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(9);

        // Act: Press Enter to pick the focused hour.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Hour selected (minute preserved), flow advanced to minute column.
        expect(fixture.componentInstance.value()?.getUTCHours(), 'value should contain hour 9').toBe(9);
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should be preserved').toBe(5);
        expect(fixture.componentInstance.activeColumn(), 'flow should advance to minute column').toBe('minute');
        expect(document.activeElement, 'focus should move to minute listbox').toBe(fixture.componentInstance.minuteRef().nativeElement);
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should be seeded from value').toBe(5);
      });

      it('should select focused hour on Space', async () => {
        // Arrange: Create component with value 14:05, open panel and seed focused hour.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 5) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(21);

        // Act: Press Space to pick the focused hour.
        await user.keyboard(' ');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Hour selected and flow advanced to minute column.
        expect(fixture.componentInstance.value()?.getUTCHours(), 'value should contain hour 21').toBe(21);
        expect(fixture.componentInstance.activeColumn(), 'flow should advance to minute column').toBe('minute');
      });

      it('should deselect and close panel on Enter with same hour when canNull', async () => {
        // Arrange: Create deselectable component with value 14:30, open panel, seed focused hour 14.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);

        // Act: Press Enter on already selected hour.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Value deselected, panel closed, focus back on input.
        expect(fixture.componentInstance.value(), 'Enter on same hour with canNull should clear value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'panel should close after deselecting').toBe(false);
        expect(document.activeElement, 'focus should return to input').toBe(getInput(fixture));
      });

      it('should select seeded hour on Enter right after open', async () => {
        // Arrange: Create component with value 14:30 and open panel (open seeds focus from value).
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        const before = fixture.componentInstance.value();
        expect(fixture.componentInstance.focusedHour(), 'open should seed focused hour from value').toBe(14);

        // Act: Press Enter without any prior key press.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Seeded hour is committed and the flow advances to the seeded minute.
        expect(fixture.componentInstance.value(), 'Enter should keep the clean seeded value instance').toBe(before);
        expect(fixture.componentInstance.value()?.getUTCHours(), 'value should contain seeded hour 14').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should be preserved').toBe(30);
        expect(fixture.componentInstance.activeColumn(), 'flow should advance to minute column').toBe('minute');
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should stay seeded').toBe(30);
        expect(document.activeElement, 'focus should move to minute listbox').toBe(fixture.componentInstance.minuteRef().nativeElement);
      });

      it('should close panel and refocus input on Escape from hour listbox', async () => {
        // Arrange: Create component and open panel (focus sits in hour listbox).
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);

        // Act: Press Escape.
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel closed, focus state reset, focus back on input.
        expect(fixture.componentInstance.isClockVisible(), 'Escape should close the panel').toBe(false);
        expect(fixture.componentInstance.focusedHour(), 'Escape should reset focused hour').toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'Escape should reset focused minute').toBeNull();
        expect(document.activeElement, 'Escape should return focus to input').toBe(getInput(fixture));
      });

      it('should close panel and move focus to previous control on Shift+Tab from hour listbox', async () => {
        // Arrange: Create component with open panel focused in hour listbox and a focusable
        // control before the picker (target of backwards focus handoff).
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);
        const before = fixture.componentInstance.value();
        const prevControl = document.createElement('button');
        prevControl.setAttribute('data-testid', 'prev-control');
        document.body.insertBefore(prevControl, fixture.nativeElement);

        try {
          // Act: Press Shift+Tab to move backwards out of the picker.
          await user.keyboard('{Shift>}{Tab}{/Shift}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Panel closed, focus state reset, value untouched, focus moved on.
          expect(fixture.componentInstance.isClockVisible(), 'panel should close on Shift+Tab').toBe(false);
          expect(fixture.componentInstance.focusedHour(), 'Shift+Tab should reset focused hour').toBeNull();
          expect(fixture.componentInstance.focusedMinute(), 'Shift+Tab should reset focused minute').toBeNull();
          expect(fixture.componentInstance.value(), 'Shift+Tab should not change value').toBe(before);
          expect(document.activeElement, 'focus should move to previous focusable control').toBe(prevControl);
        } finally { // cleanup
          prevControl.remove();
        }
      });

      it('should track focused hour with focused class and aria-activedescendant', async () => {
        // Arrange: Create component, open panel and seed focused hour.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(5);
        fixture.componentInstance.activeColumn.set('hour');
        fixture.detectChanges();
        const hourOption = fixture.nativeElement.querySelector('[data-testid="test-time_h5"]');

        // Assert: Focused hour is visually marked and referenced by activedescendant.
        expect(hourOption.classList.contains('focused'), 'hour 5 should have focused class').toBe(true);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference hour 5').toBe('test-time_opt_h5');

        // Act: Column becomes inactive.
        fixture.componentInstance.activeColumn.set('minute');
        fixture.detectChanges();

        // Assert: Focused class removed from hour column and its activedescendant goes with it.
        expect(hourOption.classList.contains('focused'), 'focused class should apply only to active column').toBe(false);
        expect(fixture.componentInstance.hourRef().nativeElement.hasAttribute('aria-activedescendant'), 'inactive hour listbox must drop its activedescendant').toBe(false);
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-activedescendant'), 'active minute listbox should carry the activedescendant').toBe('test-time_opt_m30');
      });

      it('should clear value with Delete from the hour listbox, close the panel and refocus input when canNull', async () => {
        // Arrange: Deselectable component with value, panel open with focus in the hour listbox.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);

        // Act: Press Delete.
        await user.keyboard('{Delete}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Value cleared, interaction completed (panel closed), keyboard focus state reset,
        // focus moved back to the input INTERNALLY - so no touch is reported.
        expect(fixture.componentInstance.value(), 'Delete with canNull should clear the value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'clearing should complete the interaction and close the panel').toBe(false);
        expect(fixture.componentInstance.focusedHour(), 'closing should reset focused hour').toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'closing should reset focused minute').toBeNull();
        expect(document.activeElement, 'focus should return to the input').toBe(getInput(fixture));
        expect(touchSpy, 'internal focus move should not emit touch').not.toHaveBeenCalled();
      });

      it('should keep value and panel on Delete when canNull is false', async () => {
        // Arrange: Component with value, canNull disabled, panel open.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: false });
        await openPanel(fixture);
        fixture.componentInstance.focusedHour.set(14);
        const before = fixture.componentInstance.value();

        // Act: Press Delete.
        await user.keyboard('{Delete}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Nothing was cleared, so the interaction is not complete - panel and focus stay.
        expect(fixture.componentInstance.value(), 'Delete without canNull should keep the value').toBe(before);
        expect(fixture.componentInstance.isClockVisible(), 'panel should stay open when nothing was cleared').toBe(true);
        expect(document.activeElement, 'focus should stay in the hour listbox').toBe(fixture.componentInstance.hourRef().nativeElement);
      });
    });

    describe('keyboard: minute listbox', () => {
      /**
       * Arrange component with open panel and DOM focus in the minute listbox.
       * @param opts Options passed to the component arrangement.
       * @returns Fixture of the created component, focused in minute listbox.
       */
      async function arrangeFocusedMinute(opts: TimePickerTestOptions = {}): Promise<ComponentFixture<TimePicker>> {
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), ...opts });
        await openPanel(fixture);
        fixture.componentInstance.minuteRef().nativeElement.focus();
        fixture.detectChanges();
        return fixture;
      }

      it('should move focused minute down with wraparound', async () => {
        // Arrange: Create component focused in minute listbox with seeded focus.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedMinute.set(59);

        // Act: Press ArrowDown on last minute.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'ArrowDown from 59 should wrap to 0').toBe(0);

        // Act: Press ArrowDown on middle minute.
        fixture.componentInstance.focusedMinute.set(30);
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Moved one minute down.
        expect(fixture.componentInstance.focusedMinute(), 'ArrowDown should advance minute').toBe(31);
      });

      it('should move focused minute up with wraparound', async () => {
        // Arrange: Create component focused in minute listbox with seeded focus.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedMinute.set(0);

        // Act: Press ArrowUp on first minute.
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'ArrowUp from 0 should wrap to 59').toBe(59);

        // Act: Press ArrowUp on middle minute.
        fixture.componentInstance.focusedMinute.set(31);
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Moved one minute up.
        expect(fixture.componentInstance.focusedMinute(), 'ArrowUp should decrease minute').toBe(30);
      });

      it('should jump to first and last minute on Home and End', async () => {
        // Arrange: Create component focused in minute listbox with seeded focus.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedMinute.set(10);

        // Act: Press Home.
        await user.keyboard('{Home}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'Home should jump to first minute').toBe(0);

        // Act: Press End.
        await user.keyboard('{End}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Jumped to last minute.
        expect(fixture.componentInstance.focusedMinute(), 'End should jump to last minute').toBe(59);
      });

      it('should page minutes with clamp then wrap when the column cannot be measured', async () => {
        // Arrange: Focused minute listbox WITHOUT geometry stubs - jsdom has no layout, so the
        // component falls back to its fixed page step of 5.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedMinute.set(58);

        // Act: Page down from 58 - 58 + 5 overshoots the list end.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'PageDown should clamp onto minute 59 instead of wrapping right away').toBe(59);

        // Act: Page down again - cursor already stands on the end item.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'PageDown from minute 59 should wrap straight to 0').toBe(0);

        // Act: Page down again - stepping resumes from the wrapped position.
        await user.keyboard('{PageDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Fallback step applies after the wrap, with AT state following the cursor.
        expect(fixture.componentInstance.focusedMinute(), 'PageDown after wrapping should apply the fallback step (0 -> 5)').toBe(5);
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-activedescendant'), 'minute activedescendant should follow the paged cursor').toBe('test-time_opt_m5');
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m5"]').classList.contains('focused'), 'paged-to minute should carry the focus highlight').toBe(true);
      });

      it('should page minutes backward with clamp then wrap when the column cannot be measured', async () => {
        // Arrange: Focused minute listbox without geometry stubs (fallback page step of 5).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedMinute.set(1);

        // Act: Page up from 1 - 1 - 5 undershoots the list start.
        await user.keyboard('{PageUp}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'PageUp should clamp onto minute 0 instead of wrapping right away').toBe(0);

        // Act: Page up again - cursor already stands on the first item.
        await user.keyboard('{PageUp}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedMinute(), 'PageUp from minute 0 should wrap straight to 59').toBe(59);

        // Act: Page up again - stepping resumes from the wrapped position.
        await user.keyboard('{PageUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Fallback step applies after the wrap.
        expect(fixture.componentInstance.focusedMinute(), 'PageUp after wrapping should apply the fallback step (59 -> 54)').toBe(54);
      });

      it('should switch to hour column on ArrowLeft', async () => {
        // Arrange: Create component focused in minute listbox with both columns seeded.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedHour.set(14);
        fixture.componentInstance.focusedMinute.set(30);

        // Act: Press ArrowLeft in minute listbox.
        await user.keyboard('{ArrowLeft}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Active column switched and DOM focus moved back into hour listbox.
        expect(fixture.componentInstance.activeColumn(), 'ArrowLeft should activate hour column').toBe('hour');
        expect(document.activeElement, 'ArrowLeft should focus hour listbox').toBe(fixture.componentInstance.hourRef().nativeElement);
      });

      it('should select minute on Enter, close panel and move focus to next control', async () => {
        // Arrange: Create component focused in minute listbox with seeded focus and
        // a focusable control after the picker (target of focus handoff).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ value: utcTime(14, 5) });
        fixture.componentInstance.focusedMinute.set(30);
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);

        try {
          // Act: Press Enter to pick the focused minute.
          await user.keyboard('{Enter}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Minute selected (hour preserved), panel closed, focus moved on.
          expect(fixture.componentInstance.value()?.getUTCMinutes(), 'value should contain minute 30').toBe(30);
          expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should be preserved').toBe(14);
          expect(fixture.componentInstance.isClockVisible(), 'panel should close after minute selection').toBe(false);
          expect(document.activeElement, 'focus should move to next focusable control').toBe(nextControl);
        } finally { // cleanup
          nextControl.remove();
        }
      });

      it('should select minute on Space and close panel', async () => {
        // Arrange: Create component focused in minute listbox with seeded focus.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ value: utcTime(14, 5) });
        fixture.componentInstance.focusedMinute.set(45);

        // Act: Press Space to pick the focused minute.
        await user.keyboard(' ');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Minute selected and panel closed.
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'value should contain minute 45').toBe(45);
        expect(fixture.componentInstance.isClockVisible(), 'panel should close after minute selection').toBe(false);
      });

      it('should deselect value on Enter with same minute when canNull', async () => {
        // Arrange: Create deselectable component focused in minute listbox with selected minute focused
        // and a focusable control after the picker (target of focus handoff).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ canNull: true });
        fixture.componentInstance.focusedMinute.set(30);
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);

        try {
          // Act: Press Enter on already selected minute (same toggle as mouse re-click).
          await user.keyboard('{Enter}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Value deselected, panel closed, focus moved on (Enter commits and exits).
          expect(fixture.componentInstance.value(), 'Enter on same minute with canNull should clear value').toBeNull();
          expect(fixture.componentInstance.isClockVisible(), 'panel should close after deselecting').toBe(false);
          expect(document.activeElement, 'focus should move to next focusable control').toBe(nextControl);
        } finally { // cleanup
          nextControl.remove();
        }
      });

      it('should keep the same value instance on Enter with same minute', async () => {
        // Arrange: Create component focused in minute listbox with the already selected minute focused
        // and a focusable control after the picker (target of focus handoff).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ canNull: false });
        fixture.componentInstance.focusedMinute.set(30);
        const before = fixture.componentInstance.value();
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);

        try {
          // Act: Press Enter on already selected minute.
          await user.keyboard('{Enter}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Value instance untouched (no spurious model update), flow still completes.
          expect(fixture.componentInstance.value(), 'Enter on same minute should keep the same value instance').toBe(before);
          expect(fixture.componentInstance.isClockVisible(), 'panel should close after minute selection').toBe(false);
          expect(document.activeElement, 'focus should move to next focusable control').toBe(nextControl);
        } finally { // cleanup
          nextControl.remove();
        }
      });

      it('should clear seconds and milliseconds on Enter with same minute', async () => {
        // Arrange: Create component with value carrying stray seconds and milliseconds,
        // focused in minute listbox on the selected minute.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ value: utcTime(14, 30, 47, 123), canNull: false });
        fixture.componentInstance.focusedMinute.set(30);

        // Act: Press Enter on already selected minute.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Sub-minute parts normalized while the selection stays.
        expect(fixture.componentInstance.value()?.getUTCMinutes(), 'minute should stay selected').toBe(30);
        expect(fixture.componentInstance.value()?.getUTCHours(), 'hour should be preserved').toBe(14);
        expect(fixture.componentInstance.value()?.getUTCSeconds(), 'seconds should be zeroed').toBe(0);
        expect(fixture.componentInstance.value()?.getUTCMilliseconds(), 'milliseconds should be zeroed').toBe(0);
      });

      it('should close panel and refocus input on Escape from minute listbox', async () => {
        // Arrange: Create component focused in minute listbox.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute();
        fixture.componentInstance.focusedMinute.set(30);

        // Act: Press Escape.
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel closed, focus state reset, focus back on input.
        expect(fixture.componentInstance.isClockVisible(), 'Escape should close the panel').toBe(false);
        expect(fixture.componentInstance.focusedHour(), 'Escape should reset focused hour').toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'Escape should reset focused minute').toBeNull();
        expect(document.activeElement, 'Escape should return focus to input').toBe(getInput(fixture));
      });

      it('should close panel and move focus to previous control on Shift+Tab from minute listbox', async () => {
        // Arrange: Create component focused in minute listbox and a focusable control before
        // the picker (target of backwards focus handoff).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ value: utcTime(14, 5) });
        fixture.componentInstance.focusedMinute.set(30);
        const before = fixture.componentInstance.value();
        const prevControl = document.createElement('button');
        prevControl.setAttribute('data-testid', 'prev-control');
        document.body.insertBefore(prevControl, fixture.nativeElement);

        try {
          // Act: Press Shift+Tab to move backwards out of the picker.
          await user.keyboard('{Shift>}{Tab}{/Shift}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Panel closed, focus state reset, value untouched, focus moved on.
          expect(fixture.componentInstance.isClockVisible(), 'panel should close on Shift+Tab').toBe(false);
          expect(fixture.componentInstance.focusedHour(), 'Shift+Tab should reset focused hour').toBeNull();
          expect(fixture.componentInstance.focusedMinute(), 'Shift+Tab should reset focused minute').toBeNull();
          expect(fixture.componentInstance.value(), 'Shift+Tab should not change value').toBe(before);
          expect(document.activeElement, 'focus should move to previous focusable control').toBe(prevControl);
        } finally { // cleanup
          prevControl.remove();
        }
      });

      it('should clear value with Backspace from the minute listbox, close the panel and refocus input when canNull', async () => {
        // Arrange: Deselectable component focused in the minute listbox.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedMinute({ canNull: true });
        fixture.componentInstance.focusedMinute.set(30);

        // Act: Press Backspace.
        await user.keyboard('{Backspace}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Value cleared, interaction completed, focus moved back internally.
        expect(fixture.componentInstance.value(), 'Backspace with canNull should clear the value').toBeNull();
        expect(fixture.componentInstance.isClockVisible(), 'clearing should complete the interaction and close the panel').toBe(false);
        expect(document.activeElement, 'focus should return to the input').toBe(getInput(fixture));
      });
    });
  });

  describe('scrolling', () => {
    it('should not use scrollIntoView when opening panel or navigating with keyboard', async () => {
      // Arrange: Clear the shared scrollIntoView spy (stub installed in beforeAll).
      const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
      scrollSpy.mockClear();
      const user = userEvent.setup();
      const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

      // Act: Open the panel (centers the selected time) and navigate hours and minutes.
      await openPanel(fixture);
      await user.keyboard('{ArrowDown}');
      await fixture.whenStable();
      fixture.detectChanges();
      await user.keyboard('{ArrowRight}');
      await fixture.whenStable();
      fixture.detectChanges();
      await user.keyboard('{End}');
      await fixture.whenStable();
      fixture.detectChanges();

      // Assert: Only the clock column itself may be scrolled. scrollIntoView aligns against
      // the viewport, so it would also scroll every scrollable ancestor - including the page,
      // animated by html:focus-within smooth scrolling - whenever the option is off-center.
      expect(scrollSpy, 'scrollIntoView must not be used because it scrolls page ancestors').not.toHaveBeenCalled();
    });

    it('should center target option inside its own clock column via scrollTop', async () => {
      // Arrange: Component with selected time 14:30 and stubbed geometry (jsdom performs no
      // layout, so every rect and size defaults to zero without stubbing).
      const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
      const hourColumn = fixture.componentInstance.hourRef().nativeElement;
      const selectedHourOption = fixture.nativeElement.querySelector('[data-testid="test-time_h14"]');
      vi.spyOn(hourColumn, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
      vi.spyOn(selectedHourOption, 'getBoundingClientRect').mockReturnValue({ top: 250 } as DOMRect);
      Object.defineProperty(hourColumn, 'clientHeight', { value: 200, configurable: true });
      Object.defineProperty(selectedHourOption, 'offsetHeight', { value: 20, configurable: true });

      // Act: Open the panel, which centers the selected hour in its column.
      await openPanel(fixture);

      // Assert: scrollTop centers the option: current scroll 0 + option offset (250-100)
      // + half option height (10) - half column height (100) = 60.
      expect(hourColumn.scrollTop, 'selected hour should be vertically centered in its clock column').toBe(60);
    });
  });
});
