import { ComponentFixture, TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { TranslateService, type TranslationObject } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { TimePicker } from './time-picker';

/**
 * Unit tests of time-picker component.
 * Note: the component moves keyboard focus into the clock panel after opening and uses
 * `afterRender` internally, so interaction tests always flush with `whenStable` + `detectChanges`.
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
   * Panel opening awaits `afterRender` internally, hence the stability flushes.
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
   * that follows a mousedown (component skips auto-open for such focus).
   * @param fixture Fixture of the component.
   * @returns The input element, already focused.
   */
  function focusInputWithoutOpening(fixture: ComponentFixture<TimePicker>): HTMLInputElement {
    const input = getInput(fixture);
    fixture.componentInstance.focusFromClick = true;
    input.focus();
    fixture.detectChanges();
    return input;
  }

  beforeAll(() => {
    // jsdom does not implement scrollIntoView; component calls it when the clock panel opens.
    Element.prototype.scrollIntoView = vi.fn();
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

        // Assert: Input shows formatted time with the clock emoji prefix.
        expect(getInput(fixture).value, 'input should show formatted UTC time').toBe('🕜 14:30');
      });

      it('should update input display when value changes programmatically', async () => {
        // Arrange: Create component with value 14:30 UTC.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Set new value, then clear it.
        fixture.componentRef.setInput('value', utcTime(9, 5));
        fixture.detectChanges();
        expect(getInput(fixture).value, 'input should show updated time').toBe('🕜 09:05');

        // Assert: Clearing value empties the input again.
        fixture.componentRef.setInput('value', null);
        fixture.detectChanges();
        expect(getInput(fixture).value, 'input should be empty after clearing value').toBe('');
      });

      it('should show placeholder translation key when no value is set', async () => {
        // Arrange: Create component without value and translations.
        const fixture = await arrangeTimePicker({ value: null });

        // Assert: Placeholder contains the translation key (no translations registered).
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_input"]').getAttribute('placeholder'), 'placeholder should contain translation key').toContain('dateTimePicker.placeholder.time');
      });

      it('should show translated placeholder when translations are provided', async () => {
        // Arrange: Create component with translations registered before creation.
        const fixture = await arrangeTimePicker({
          value: null,
          translations: { dateTimePicker: { placeholder: { time: 'hh:mm' } } },
        });

        // Assert: Placeholder is resolved via translation.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_input"]').getAttribute('placeholder'), 'placeholder should contain translated text').toContain('hh:mm');
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
        // Arrange: Remember current hour to tolerate hour rollover during the test.
        const beforeHour = new Date().getUTCHours();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });

        // Act: Open the clock panel (this computes viewed/current time).
        await openPanel(fixture);
        const afterHour = new Date().getUTCHours();

        // Assert: Selected options match the value, exactly one option per column is current.
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').classList.contains('selected'), 'hour 14 should be selected').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_h13"]').classList.contains('selected'), 'hour 13 should not be selected').toBe(false);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m30"]').classList.contains('selected'), 'minute 30 should be selected').toBe(true);
        expect(fixture.nativeElement.querySelector('[data-testid="test-time_m29"]').classList.contains('selected'), 'minute 29 should not be selected').toBe(false);
        const currHours = fixture.nativeElement.querySelectorAll('.time-hour.curr');
        expect(currHours.length, 'exactly one hour should be marked as current').toBe(1);
        expect([beforeHour, afterHour], 'current hour should match real current UTC hour').toContain(Number(currHours[0].textContent));
        expect(fixture.nativeElement.querySelectorAll('.time-minute.curr').length, 'exactly one minute should be marked as current').toBe(1);
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

      it('should open panel on focus without seeding keyboard focus', async () => {
        // Arrange: Create component with closed panel.
        const fixture = await arrangeTimePicker();

        // Act: Focus the input (e.g. via Tab).
        getInput(fixture).focus();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel opened, but keyboard focus state stays unseeded (focus path is not keyboard).
        expect(fixture.componentInstance.isClockVisible(), 'panel should open on focus').toBe(true);
        expect(fixture.componentInstance.focusedHour(), 'focus-open should not seed focused hour').toBeNull();
        expect(fixture.componentInstance.focusedMinute(), 'focus-open should not seed focused minute').toBeNull();
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

        // Assert: Panel is open (a double toggle would leave it closed) and suppression flag was consumed.
        expect(fixture.componentInstance.isClockVisible(), 'real click flow should open panel exactly once').toBe(true);
        expect(fixture.componentInstance.focusFromClick, 'click suppression flag should be reset after focus').toBe(false);
      });

      it('should keep auto-open on focus after mousedown on already-focused input', async () => {
        // Arrange: Create component with input focused (focus-open suppressed) and panel closed.
        const fixture = await arrangeTimePicker();
        const input = focusInputWithoutOpening(fixture);
        expect(fixture.componentInstance.focusFromClick, 'suppression flag should start consumed').toBe(false);

        // Act: Mousedown lands on the already-focused input, so no focus event follows to consume the flag.
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        // Assert: Nothing was marked (marking here would leak and swallow the next auto-open).
        expect(fixture.componentInstance.focusFromClick, 'mousedown on focused input should not mark the flag').toBe(false);

        // Act: Leave the input and focus it again (Tab-like flow).
        input.blur();
        input.focus();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus auto-opens the panel (a leaked flag would keep it closed).
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

        // Assert: Value is untouched (same instance proves early return).
        expect(fixture.componentInstance.value(), 're-clicking selected hour should keep value').toBe(before);
      });

      it('should deselect value when same hour is clicked again and canNull is true', async () => {
        // Arrange: Create deselectable component with value 14:30 and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), canNull: true });
        await openPanel(fixture);

        // Act: Click already selected hour 14.
        fixture.nativeElement.querySelector('[data-testid="test-time_h14"]').click();
        fixture.detectChanges();

        // Assert: Value is deselected.
        expect(fixture.componentInstance.value(), 're-clicking selected hour with canNull should clear value').toBeNull();
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

      it('should ignore selection of null hour or minute', async () => {
        // Arrange: Create component with value and open panel.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        const before = fixture.componentInstance.value();

        // Act: Call selection handlers with null (defensive API contract).
        fixture.componentInstance.selectHour(null);
        fixture.componentInstance.selectMinute(null);
        fixture.detectChanges();

        // Assert: Value is untouched.
        expect(fixture.componentInstance.value(), 'null selection should be ignored').toBe(before);
      });

      it('should ignore hour and minute selection when disabled', async () => {
        // Arrange: Create disabled component with value (panel state is irrelevant for these guards).
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), disabled: true });
        const before = fixture.componentInstance.value();

        // Act: Call selection handlers directly (disabled input does not receive user clicks).
        fixture.componentInstance.selectHour(5);
        fixture.componentInstance.selectMinute(5);
        fixture.detectChanges();

        // Assert: Value is untouched.
        expect(fixture.componentInstance.value(), 'disabled component should not change value').toBe(before);
      });

      it('should not open panel on click when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeTimePicker({ disabled: true });

        // Act: Click the input, then call the click handler directly
        // (browsers do not deliver clicks to disabled inputs, so guard is checked directly too).
        getInput(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        await fixture.componentInstance.handleClick(false);

        // Assert: Panel stays closed.
        expect(fixture.componentInstance.isClockVisible(), 'disabled component should not open on click').toBe(false);
      });

      it('should ignore input keyboard events when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeTimePicker({ disabled: true });

        // Act: Dispatch keydown directly (disabled inputs are not focusable for real keystrokes).
        getInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel stays closed.
        expect(fixture.componentInstance.isClockVisible(), 'disabled component should not open via keyboard').toBe(false);
      });

      it('should ignore hour and minute listbox keyboard events when disabled', async () => {
        // Arrange: Create disabled component with seeded keyboard focus state.
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30), disabled: true });
        fixture.componentInstance.focusedHour.set(3);
        fixture.componentInstance.focusedMinute.set(7);

        // Act: Dispatch keydown directly on both listboxes.
        fixture.componentInstance.hourRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        fixture.componentInstance.minuteRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Keyboard focus state is untouched.
        expect(fixture.componentInstance.focusedHour(), 'disabled component should not move focused hour').toBe(3);
        expect(fixture.componentInstance.focusedMinute(), 'disabled component should not move focused minute').toBe(7);
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

      it('should toggle panel visibility on flipPanel', async () => {
        // Arrange: Create component with closed panel.
        const fixture = await arrangeTimePicker();

        // Act: Flip twice.
        await fixture.componentInstance.flipPanel();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isClockVisible(), 'first flipPanel should open the panel').toBe(true);

        // Assert: Second flip closes it again.
        await fixture.componentInstance.flipPanel();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isClockVisible(), 'second flipPanel should close the panel').toBe(false);
      });
    });

    describe('positioning', () => {
      it('should right-align panel when it would overflow the window', async () => {
        // Arrange: Create component and stub panel geometry to report window overflow.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ right: window.innerWidth + 50 } as DOMRect);

        // Act: Open the panel (positioning is recomputed after render).
        await openPanel(fixture);

        // Assert: Panel is right-aligned (CSSOM normalizes unitless zero to pixels).
        expect(panel.style.left, 'panel should not be left-aligned on overflow').toBe('auto');
        expect(panel.style.right, 'panel should be right-aligned on overflow').toBe('0px');
      });

      it('should restore left alignment when panel fits into the window', async () => {
        // Arrange: Open panel with overflow geometry first to get into right-aligned state.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');
        const geometrySpy = vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ right: window.innerWidth + 50 } as DOMRect);
        await openPanel(fixture);
        expect(panel.style.right, 'panel should start right-aligned on overflow').toBe('0px');

        // Act: Panel now fits, so close and reopen it.
        getInput(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        geometrySpy.mockReturnValue({ right: 100 } as DOMRect);
        await openPanel(fixture);

        // Assert: Panel alignment flipped back to the left.
        expect(panel.style.left, 'panel should be left-aligned when it fits').toBe('0px');
        expect(panel.style.right, 'panel should not be right-aligned when it fits').toBe('auto');
      });
    });
  });

  describe('i18n', () => {
    it('should update placeholder and translated labels on language switch', async () => {
      // Arrange: Create component with English translations registered before creation.
      const fixture = await arrangeTimePicker({
        value: null,
        translations: { dateTimePicker: { placeholder: { time: 'hh:mm' }, hour: 'Hour', minute: 'Minute' } },
      });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('pl', { dateTimePicker: { placeholder: { time: 'gg:mm' }, hour: 'Godzina', minute: 'Minuta' } });
      expect(getInput(fixture).getAttribute('placeholder'), 'precondition: placeholder should show English text').toContain('hh:mm');

      // Act: Activate Polish while the component is alive.
      await firstValueFrom(translateService.use('pl'));
      await fixture.whenStable();
      fixture.detectChanges();

      // Assert: Placeholder follows the language; pipe-based label proves both update together.
      expect(getInput(fixture).getAttribute('placeholder'), 'placeholder should switch to Polish text').toContain('gg:mm');
      expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-label'), 'hour label should switch to Polish text').toBe('Godzina');
    });
  });

  describe('accessibility', () => {
    describe('aria', () => {
      it('should have combobox role and aria-haspopup listbox on input', async () => {
        // Arrange: Create component.
        const fixture = await arrangeTimePicker();
        const input = getInput(fixture);

        // Assert: Combobox semantics present.
        expect(input.getAttribute('role'), 'should have combobox role').toBe('combobox');
        expect(input.getAttribute('aria-haspopup'), 'should have listbox popup').toBe('listbox');
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

      it('should have dialog role and aria-modal on panel', async () => {
        // Arrange: Create component.
        const fixture = await arrangeTimePicker();
        const panel = fixture.nativeElement.querySelector('[data-testid="test-time_panel"]');

        // Assert: Panel is a modal dialog.
        expect(panel.getAttribute('role'), 'panel should have dialog role').toBe('dialog');
        expect(panel.getAttribute('aria-modal'), 'panel should be modal').toBe('true');
      });

      it('should have listbox roles, aria-labels and tabindex -1 on columns', async () => {
        // Arrange: Create component (translations not registered, keys are rendered).
        const fixture = await arrangeTimePicker();
        const hourBox = fixture.componentInstance.hourRef().nativeElement;
        const minuteBox = fixture.componentInstance.minuteRef().nativeElement;

        // Assert: Columns are activedescendant-managed listboxes labelled by translation keys.
        expect(hourBox.getAttribute('role'), 'hour column should have listbox role').toBe('listbox');
        expect(minuteBox.getAttribute('role'), 'minute column should have listbox role').toBe('listbox');
        expect(hourBox.getAttribute('aria-label'), 'hour column should be labelled with translation key').toBe('dateTimePicker.hour');
        expect(minuteBox.getAttribute('aria-label'), 'minute column should be labelled with translation key').toBe('dateTimePicker.minute');
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
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        focusInputWithoutOpening(fixture);

        // Act: Open the panel via keyboard.
        const user = userEvent.setup();
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Keyboard focus seeded from value and referenced via aria-activedescendant.
        expect(fixture.componentInstance.focusedHour(), 'focused hour should come from value').toBe(14);
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should come from value').toBe(30);
        expect(fixture.componentInstance.hourRef().nativeElement.getAttribute('aria-activedescendant'), 'hour activedescendant should reference focused option').toBe('test-time_opt_h14');
        expect(fixture.componentInstance.minuteRef().nativeElement.getAttribute('aria-activedescendant'), 'minute activedescendant should reference focused option').toBe('test-time_opt_m30');
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

      it('should fall back to selected hour on first ArrowDown when nothing is focused', async () => {
        // Arrange: Create component with value 14:30 and open panel via mouse (no keyboard focus seeded).
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        expect(fixture.componentInstance.focusedHour(), 'mouse open should not seed focused hour').toBeNull();

        // Act: Press ArrowDown for the first time.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.focusedHour(), 'first ArrowDown should point at selected hour').toBe(14);

        // Act: Press ArrowDown again.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Second press moves past the selected hour.
        expect(fixture.componentInstance.focusedHour(), 'second ArrowDown should advance past selected hour').toBe(15);
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

      it('should only seed focus values on ArrowRight when nothing is focused', async () => {
        // Arrange: Create component with value 14:30 and open panel via mouse.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        expect(fixture.componentInstance.focusedHour(), 'mouse open should not seed focused hour').toBeNull();

        // Act: Press ArrowRight with no focused values.
        await user.keyboard('{ArrowRight}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus values seeded from value, but column and DOM focus unchanged.
        expect(fixture.componentInstance.focusedHour(), 'focused hour should be seeded from value').toBe(14);
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should be seeded from value').toBe(30);
        expect(fixture.componentInstance.activeColumn(), 'column should stay hour when only seeding').toBe('hour');
        expect(document.activeElement, 'focus should stay in hour listbox when only seeding').toBe(fixture.componentInstance.hourRef().nativeElement);
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

      it('should seed focus without selecting on Enter when nothing is focused', async () => {
        // Arrange: Create component with value 14:30 and open panel via mouse.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        const before = fixture.componentInstance.value();

        // Act: Press Enter with no focused hour.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus seeded, value untouched, panel still open.
        expect(fixture.componentInstance.focusedHour(), 'focused hour should be seeded from value').toBe(14);
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should be seeded from value').toBe(30);
        expect(fixture.componentInstance.value(), 'value should stay untouched when only seeding').toBe(before);
        expect(fixture.componentInstance.isClockVisible(), 'panel should stay open when only seeding').toBe(true);
        expect(document.activeElement, 'focus should stay in hour listbox when only seeding').toBe(fixture.componentInstance.hourRef().nativeElement);
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

        // Assert: Focused class removed from hour column.
        expect(hourOption.classList.contains('focused'), 'focused class should apply only to active column').toBe(false);
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

      it('should seed focus without selecting on Enter when nothing is focused', async () => {
        // Arrange: Create component with value 14:30 and open panel via mouse.
        const user = userEvent.setup();
        const fixture = await arrangeTimePicker({ value: utcTime(14, 30) });
        await openPanel(fixture);
        fixture.componentInstance.minuteRef().nativeElement.focus();
        const before = fixture.componentInstance.value();
        expect(fixture.componentInstance.focusedMinute(), 'focus event should not seed focused minute').toBeNull();

        // Act: Press Enter with no focused minute.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus seeded, value untouched, panel still open.
        expect(fixture.componentInstance.focusedMinute(), 'focused minute should be seeded from value').toBe(30);
        expect(fixture.componentInstance.focusedHour(), 'focused hour should be seeded from value').toBe(14);
        expect(fixture.componentInstance.value(), 'value should stay untouched when only seeding').toBe(before);
        expect(fixture.componentInstance.isClockVisible(), 'panel should stay open when only seeding').toBe(true);
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
    });
  });
});
