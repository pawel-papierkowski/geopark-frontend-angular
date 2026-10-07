import { ComponentFixture, TestBed } from '@angular/core/testing';

import { enDateTimePickerMode } from '@/shared/ui/other/types';
import { registerLabelPreventionTests, registerOutsidePressTests, type OutsidePressDriver } from '@/shared/ui/components/form/popup-panel/testing/label-guard-tests';
import { dispatchMousedown } from '@/shared/ui/components/form/popup-panel/testing/mouse';

import { DateTimePicker } from './date-time-picker';

/**
 * Unit tests of date-time-picker component.
 * Note: DateTimePicker wraps DatePicker and TimePicker subcomponents, so tests cover their
 * presence, interactions between them and label activation (the hidden label target must
 * redirect focus into a sub-picker input instead of the non-focusable wrapper).
 */
describe('DateTimePicker', () => {
  /** Options used to arrange a DateTimePicker instance under test. */
  interface DateTimePickerTestOptions {
    /** Identifier of the picker (used for ids and label association). */
    ident?: string;
    /** Id of the external `<label>` element forwarded to the sub-pickers. */
    label?: string;
    /** Whether an element with the given `label` id is created (false leaves the reference
     * dangling, for the dev-mode warning tests). */
    resolveLabel?: boolean;
    /** Mode of operation. */
    mode?: enDateTimePickerMode;
    /** Whether the picker is disabled. */
    disabled?: boolean;
  }

  /**
   * Create and configure a DateTimePicker component under test.
   * @param opts Options controlling initial inputs.
   * @returns Fixture of the created component with initial change detection applied.
   */
  async function arrangeDateTimePicker(opts: DateTimePickerTestOptions = {}): Promise<ComponentFixture<DateTimePicker>> {
    const { ident = 'test-dtp', label = '', resolveLabel = true, mode = 'time', disabled = false } = opts;

    await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();

    const fixture = TestBed.createComponent(DateTimePicker);

    // Give the label reference a real target before the first change detection (the sub-pickers'
    // dev-only effects check it there), unless a test deliberately leaves it dangling.
    // Removed together with the fixture so ids never leak into the next test.
    if (label !== '' && resolveLabel) {
      const labelElement = document.createElement('label');
      labelElement.id = label;
      document.body.appendChild(labelElement);
      fixture.componentRef.onDestroy(() => labelElement.remove());
    }

    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Get the hidden label target button of given fixture.
   * @param fixture Fixture of the component.
   * @returns Hidden button that `<label for>` points at.
   */
  function getHiddenButton(fixture: ComponentFixture<DateTimePicker>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button.hidden-label-button');
  }

  /**
   * Get the date input of the wrapped date-picker (ident is derived as `dateId_<ident>`).
   * @param fixture Fixture of the component.
   * @returns Input element of the date sub-picker.
   */
  function getDateInput(fixture: ComponentFixture<DateTimePicker>): HTMLInputElement {
    return fixture.nativeElement.querySelector(`[data-testid="dateId_${fixture.componentInstance.resolvedIdent()}_input"]`);
  }

  /**
   * Get the time input of the wrapped time-picker (ident is derived as `timeId_<ident>`).
   * @param fixture Fixture of the component.
   * @returns Input element of the time sub-picker.
   */
  function getTimeInput(fixture: ComponentFixture<DateTimePicker>): HTMLInputElement {
    return fixture.nativeElement.querySelector(`[data-testid="timeId_${fixture.componentInstance.resolvedIdent()}_input"]`);
  }

  /**
   * Get the hour listbox column of the wrapped time-picker (first of the two clock columns).
   * @param fixture Fixture of the component.
   * @returns Hour listbox element.
   */
  function getHourColumn(fixture: ComponentFixture<DateTimePicker>): HTMLElement {
    return fixture.nativeElement.querySelector('.clock-column');
  }

  /**
   * Get the calendar grid of the wrapped date-picker (the focus target of the open path).
   * Day cells are not focusable (the grid announces its cursor via aria-activedescendant),
   * so DOM focus lands on the grid container itself.
   * @param fixture Fixture of the component.
   * @returns Grid element of the date sub-picker.
   */
  function getCalendarGrid(fixture: ComponentFixture<DateTimePicker>): HTMLElement {
    return fixture.nativeElement.querySelector('.calendar-grid');
  }

  /**
   * Flush pending component work: panel opening awaits `forRender` internally, so
   * interaction tests need stability flushes before asserting focus and panel state.
   * @param fixture Fixture of the component.
   */
  async function flush(fixture: ComponentFixture<DateTimePicker>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Open the calendar panel with a mouse click on the date input and flush pending component work.
   * Asserts the open inside the helper, so a failing setup reads as a broken precondition.
   * @param fixture Fixture of the component.
   */
  async function openCalendarPanel(fixture: ComponentFixture<DateTimePicker>): Promise<void> {
    getDateInput(fixture).click();
    await flush(fixture);
    await flush(fixture);
    expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before act').toBe('true');
  }

  /**
   * Open the clock panel with a mouse click on the time input and flush pending component work.
   * Asserts the open inside the helper, so a failing setup reads as a broken precondition.
   * @param fixture Fixture of the component.
   */
  async function openClockPanel(fixture: ComponentFixture<DateTimePicker>): Promise<void> {
    getTimeInput(fixture).click();
    await flush(fixture);
    await flush(fixture);
    expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should be open before act').toBe('true');
  }

  /**
   * Find the rendered calendar day cell of the given day-of-month in the currently viewed month.
   * Adjacent-month padding cells share day numbers, so they are excluded via their `not-current`
   * class; the lookup stays independent of the index-based cell testids.
   * @param fixture Fixture of the component.
   * @param day Day of month to find.
   * @returns The cell element, or null when that day is not on the displayed grid.
   */
  function findDayCell(fixture: ComponentFixture<DateTimePicker>, day: number): HTMLElement | null {
    const cells = [...fixture.nativeElement.querySelectorAll('.day:not(.not-current)')] as HTMLElement[];
    return cells.find((cell) => cell.textContent?.trim() === String(day)) ?? null;
  }

  /**
   * Run the given body with the system clock pinned to a fixed instant (Date only - timers stay
   * real, so Angular's stability flushes are unaffected). Needed wherever the date seeded into a
   * committed value must not depend on when the suite runs.
   * @param instant The instant `new Date()` should report during `run`.
   * @param run Body executed under the mocked clock; real timers are restored afterwards.
   * @returns Whatever `run` resolves to.
   */
  async function withMockedNow<T>(instant: Date, run: () => Promise<T>): Promise<T> {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instant);
    try {
      return await run();
    } finally {
      vi.useRealTimers();
    }
  }

  describe('general', () => {
    describe('outputs', () => {
      it('should forward touch output from time-picker', async () => {
        // Arrange: Render wrapper in time mode and spy on its touch output.
        await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();
        const fixture = TestBed.createComponent(DateTimePicker);
        fixture.componentRef.setInput('ident', 'test-dtp');
        fixture.componentRef.setInput('mode', 'time');
        fixture.detectChanges();
        await fixture.whenStable();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const timeInput = fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_input"]');
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Simulate focus leaving the inner time-picker (bubbles to its focusout handler).
          timeInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
          fixture.detectChanges();

          // Assert: Wrapper reports touch so Signal Forms receive the blur.
          expect(touchSpy, 'touch should be forwarded from time-picker to wrapper').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          outside.remove();
        }
      });

      it('should forward touch output from date-picker', async () => {
        // Arrange: Render wrapper in date mode and spy on its touch output.
        const fixture = await arrangeDateTimePicker({ mode: 'date' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Simulate focus leaving the inner date-picker (bubbles to its focusout handler).
          getDateInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
          fixture.detectChanges();

          // Assert: Wrapper reports touch so Signal Forms receive the blur.
          expect(touchSpy, 'touch should be forwarded from date-picker to wrapper').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          outside.remove();
        }
      });
    });

    describe('ident', () => {
      it('should generate id following date-time-picker-N pattern when ident is empty', async () => {
        // Arrange: Render wrapper without ident (empty ident input).
        await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();
        const fixture = TestBed.createComponent(DateTimePicker);
        fixture.componentRef.setInput('mode', 'time');
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: Hidden button gets generated id, sub-picker derives its ident from it.
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        const ident = hiddenButton.getAttribute('id');
        expect(ident, 'hidden button id should follow date-time-picker-N pattern').toMatch(/^date-time-picker-\d+$/);
        const timeInput = fixture.nativeElement.querySelector(`[data-testid="timeId_${ident}_input"]`);
        expect(timeInput, 'time-picker should derive ident from generated parent ident').not.toBeNull();
      });

      it('should derive sub-picker idents from provided ident', async () => {
        // Arrange: Render wrapper with explicit ident.
        await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();
        const fixture = TestBed.createComponent(DateTimePicker);
        fixture.componentRef.setInput('ident', 'test-dtp');
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: Sub-picker idents are derived from the provided ident.
        expect(fixture.componentInstance.dateIdent(), 'dateIdent should be dateId_test-dtp').toBe('dateId_test-dtp');
        expect(fixture.componentInstance.timeIdent(), 'timeIdent should be timeId_test-dtp').toBe('timeId_test-dtp');
        expect(fixture.componentInstance.resolvedIdent(), 'resolvedIdent should mirror ident').toBe('test-dtp');
      });

      it('should re-resolve ident and sub-picker idents when ident changes after creation', async () => {
        // Arrange: Render wrapper in datetime mode with the initial ident.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        expect(fixture.componentInstance.resolvedIdent(), 'precondition: resolvedIdent should be the provided ident').toBe('test-dtp');

        // Act: Consumer renames the control after creation.
        fixture.componentRef.setInput('ident', 'renamed');
        await flush(fixture);

        // Assert: The linked signal re-resolves and both sub-pickers re-render under the new
        // idents (stale testids would break label pairing and any consumer test hooks).
        expect(fixture.componentInstance.resolvedIdent(), 'resolvedIdent should follow the new ident').toBe('renamed');
        expect(fixture.componentInstance.dateIdent(), 'dateIdent should derive from the new ident').toBe('dateId_renamed');
        expect(fixture.componentInstance.timeIdent(), 'timeIdent should derive from the new ident').toBe('timeId_renamed');
        expect(getHiddenButton(fixture).id, 'hidden label target should carry the new id').toBe('renamed');
        expect(fixture.nativeElement.querySelector('[data-testid="dateId_renamed_input"]'), 'date input should re-render under the new ident').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="timeId_renamed_input"]'), 'time input should re-render under the new ident').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="dateId_test-dtp_input"]'), 'stale date input must not survive the rename').toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_input"]'), 'stale time input must not survive the rename').toBeNull();
      });
    });

    // Switching `mode` re-renders the `@if` blocks around the sub-pickers: the losing sub-picker
    // is destroyed WITH its open panel, the gaining one mounts fresh (closed - only focus or a
    // click may open it), and a sub-picker rendered by both modes must keep its state untouched.
    describe('mode', () => {
      it('should render the newly required sub-picker when mode changes after creation', async () => {
        // Arrange: Render wrapper in date-only mode (time sub-picker absent).
        const fixture = await arrangeDateTimePicker({ mode: 'date' });
        expect(fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_input"]'), 'precondition: time sub-picker must not render in date mode').toBeNull();

        // Act: Consumer switches to datetime after creation.
        fixture.componentRef.setInput('mode', 'datetime');
        await flush(fixture);

        // Assert: The time sub-picker joins without disturbing the date one.
        expect(getDateInput(fixture), 'date sub-picker should survive the mode change').not.toBeNull();
        expect(getTimeInput(fixture), 'time sub-picker should appear after switching to datetime').not.toBeNull();
      });

      it('should adopt a value set in date mode into both halves after switching to datetime', async () => {
        // Arrange: date-only mode carrying a value (only the date sub-picker exists to show it).
        const fixture = await arrangeDateTimePicker({ mode: 'date' });
        fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 45)));
        await flush(fixture);
        expect(getDateInput(fixture).value, 'precondition: date input should show the value').toBe('2026-01-15');

        // Act: Consumer switches to datetime after creation.
        fixture.componentRef.setInput('mode', 'datetime');
        await flush(fixture);

        // Assert: The freshly mounted time half adopts the time part of the existing value -
        // switching modes must not lose the value or leave the new sub-input empty.
        expect(getDateInput(fixture).value, 'date input should keep showing the value').toBe('2026-01-15');
        expect(getTimeInput(fixture).value, 'time input should adopt the time part after the mode switch').toBe('14:45');
        expect(fixture.componentInstance.value(), 'the wrapper value must survive the mode switch').not.toBeNull();
      });

      it('should close the clock and mount a closed calendar when mode switches from time to date with the clock panel open', async () => {
        // Arrange: time mode with the clock panel open (keyboard focus sits in its hour listbox).
        const fixture = await arrangeDateTimePicker({ mode: 'time' });
        await openClockPanel(fixture);

        // Act: Consumer switches to date-only mode while the clock is open.
        fixture.componentRef.setInput('mode', 'date');
        await flush(fixture);

        // Assert: The whole time sub-picker vanishes together with its open panel, the date
        // sub-picker takes its place, and merely appearing must NOT open the calendar - only
        // focus or a click may do that, and the mode change must not produce either.
        expect(getTimeInput(fixture), 'time sub-picker should vanish when mode leaves time').toBeNull();
        expect(fixture.nativeElement.querySelector('.clock-container'), 'the open clock panel should vanish with its sub-picker').toBeNull();
        expect(getDateInput(fixture), 'date sub-picker should appear after switching to date').not.toBeNull();
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'appearing date sub-picker must not auto-open the calendar').toBe('false');
      });

      it('should mount a closed date sub-picker and keep the clock untouched when mode switches from time to datetime with the clock panel open', async () => {
        // Arrange: time mode with the clock panel open.
        const fixture = await arrangeDateTimePicker({ mode: 'time' });
        await openClockPanel(fixture);

        // Act: Consumer switches to datetime while the clock is open.
        fixture.componentRef.setInput('mode', 'datetime');
        await flush(fixture);

        // Assert: The date sub-picker joins CLOSED, while the untouched time sub-picker keeps
        // its open panel and the keyboard focus that was inside it.
        expect(getDateInput(fixture), 'date sub-picker should appear after switching to datetime').not.toBeNull();
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'appearing date sub-picker must not auto-open the calendar').toBe('false');
        expect(getTimeInput(fixture), 'time sub-picker should stay rendered').not.toBeNull();
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock panel should stay open through the mode change').toBe('true');
        expect(document.activeElement, 'keyboard focus should stay in the hour listbox').toBe(getHourColumn(fixture));
      });

      it('should drop the date sub-picker and keep the clock untouched when mode switches from datetime to time with the clock panel open', async () => {
        // Arrange: datetime mode with the clock panel open (opened through its input).
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        await openClockPanel(fixture);

        // Act: Consumer switches to time-only mode while the clock is open.
        fixture.componentRef.setInput('mode', 'time');
        await flush(fixture);

        // Assert: The date sub-picker vanishes; the untouched time sub-picker keeps its open
        // panel and the keyboard focus that was inside it.
        expect(getDateInput(fixture), 'date sub-picker should vanish when mode leaves date').toBeNull();
        expect(getTimeInput(fixture), 'time sub-picker should stay rendered').not.toBeNull();
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock panel should stay open through the mode change').toBe('true');
        expect(document.activeElement, 'keyboard focus should stay in the hour listbox').toBe(getHourColumn(fixture));
      });
    });
  });

  // The sub-pickers own their own state rendering (their specs cover what `disabled`/`invalid`/
  // `required`/`showWeeks`/`dateMin`/`dateMax`/`canNull` do to a standalone picker). These tests
  // cover the WRAPPER's side of the contract: every input must actually reach the rendered
  // sub-pickers, since a dropped binding in date-time-picker.html would otherwise go unnoticed.
  describe('inputs forwarding', () => {
    it('should forward disabled to both sub-inputs and the hidden label target', async () => {
      // Arrange: Render wrapper in datetime mode and disabled.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime', disabled: true });

      // Assert: Both sub-inputs and the label target carry the disabled state (a wrapper that
      // forgot the [disabled] bindings would leave them focusable and openable).
      expect(getDateInput(fixture).disabled, 'date input should be disabled').toBe(true);
      expect(getTimeInput(fixture).disabled, 'time input should be disabled').toBe(true);
      expect(getDateInput(fixture).getAttribute('aria-disabled'), 'date input should be aria-disabled').toBe('true');
      expect(getTimeInput(fixture).getAttribute('aria-disabled'), 'time input should be aria-disabled').toBe('true');
      expect(getHiddenButton(fixture).disabled, 'hidden label target should be disabled').toBe(true);

      // Act: Try to open both panels by clicking the disabled inputs.
      getDateInput(fixture).click();
      getTimeInput(fixture).click();
      await flush(fixture);

      // Assert: Neither sub-picker reacts to the clicks.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'disabled date input must not open the calendar').toBe('false');
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'disabled time input must not open the clock').toBe('false');
    });

    it('should forward invalid to both sub-inputs', async () => {
      // Arrange: Render wrapper in datetime mode, then mark it invalid.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      fixture.componentRef.setInput('invalid', true);
      await flush(fixture);

      // Assert: Both sub-inputs expose the invalid state for styling and assistive technology.
      expect(getDateInput(fixture).getAttribute('aria-invalid'), 'date input should be aria-invalid').toBe('true');
      expect(getTimeInput(fixture).getAttribute('aria-invalid'), 'time input should be aria-invalid').toBe('true');
      expect(getDateInput(fixture).classList.contains('invalid'), 'date input should carry the invalid class').toBe(true);
      expect(getTimeInput(fixture).classList.contains('invalid'), 'time input should carry the invalid class').toBe(true);
    });

    it('should forward required to both sub-inputs', async () => {
      // Arrange: Render wrapper in datetime mode, then mark it required.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      fixture.componentRef.setInput('required', true);
      await flush(fixture);

      // Assert: aria-required reaches both sub-inputs.
      expect(getDateInput(fixture).getAttribute('aria-required'), 'date input should be aria-required').toBe('true');
      expect(getTimeInput(fixture).getAttribute('aria-required'), 'time input should be aria-required').toBe('true');
    });

    it('should forward showWeeks to the date sub-picker', async () => {
      // Arrange: Render wrapper in date mode with the calendar open - grid content only exists
      // while the panel is shown, so the layout assertion needs a real viewed month.
      const fixture = await arrangeDateTimePicker({ mode: 'date' });
      await openCalendarPanel(fixture);
      const grid = fixture.nativeElement.querySelector('.calendar-grid');
      expect(grid.style.gridTemplateColumns, 'plain grid should use 7 columns').toBe('repeat(7, 1fr)');
      expect(fixture.nativeElement.querySelectorAll('.week-num').length, 'no week cells without showWeeks').toBe(0);

      // Act: Consumer enables week numbers after creation.
      fixture.componentRef.setInput('showWeeks', true);
      fixture.detectChanges();

      // Assert: The date sub-picker switches to the 8-column layout with week-number cells.
      expect(grid.style.gridTemplateColumns, 'week grid should use 8 columns').toBe('repeat(8, 1fr)');
      expect(fixture.nativeElement.querySelectorAll('.week-num').length, 'six week-number cells should appear').toBe(6);
    });

    it('should forward dateMin/dateMax to the date sub-picker', async () => {
      // Arrange: Wrapper bounded to 10-20 January 2026; the January value pins the viewed month
      // to January 2026 (the grid opens on the value's month), so the test never depends on
      // when the suite runs.
      const fixture = await arrangeDateTimePicker({ mode: 'date' });
      const value = new Date(Date.UTC(2026, 0, 15));
      fixture.componentRef.setInput('value', value);
      fixture.componentRef.setInput('dateMin', new Date(Date.UTC(2026, 0, 10)));
      fixture.componentRef.setInput('dateMax', new Date(Date.UTC(2026, 0, 20)));
      await flush(fixture);
      await openCalendarPanel(fixture);

      // Assert: Out-of-range days are marked for AT; the in-range day stays pickable.
      const before = findDayCell(fixture, 5);
      const inRange = findDayCell(fixture, 15);
      const after = findDayCell(fixture, 25);
      expect(before, 'precondition: day 5 should be on the January 2026 grid').not.toBeNull();
      expect(inRange, 'precondition: day 15 should be on the January 2026 grid').not.toBeNull();
      expect(after, 'precondition: day 25 should be on the January 2026 grid').not.toBeNull();
      expect(before?.getAttribute('aria-disabled'), 'day before dateMin should be aria-disabled').toBe('true');
      expect(inRange?.hasAttribute('aria-disabled'), 'in-range day should stay pickable').toBe(false);
      expect(after?.getAttribute('aria-disabled'), 'day after dateMax should be aria-disabled').toBe('true');

      // Act: Click the out-of-range day.
      before?.click();
      await flush(fixture);

      // Assert: The bounds reached the date sub-picker - no value change, panel stays open.
      expect(fixture.componentInstance.value(), 'out-of-range pick must not change the value').toBe(value);
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'out-of-range pick must keep the calendar open').toBe('true');
    });

    it('should forward canNull to the date sub-picker', async () => {
      // Arrange: date mode, deselectable, carrying a value whose day is already selected.
      const fixture = await arrangeDateTimePicker({ mode: 'date' });
      fixture.componentRef.setInput('canNull', true);
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15)));
      await flush(fixture);
      await openCalendarPanel(fixture);

      // Act: Re-click the value's own day - a deselect is only allowed when canNull reached
      // the sub-picker (its default is false).
      const selected = fixture.nativeElement.querySelector('.day.selected') as HTMLElement | null;
      expect(selected, 'precondition: value day should be marked selected').not.toBeNull();
      selected?.click();
      await flush(fixture);

      // Assert: The deselect cleared the value and emptied the input.
      expect(fixture.componentInstance.value(), 'deselect must clear the wrapper value').toBeNull();
      expect(getDateInput(fixture).value, 'date input should be empty after deselect').toBe('');
    });

    it('should forward canNull to the time sub-picker', async () => {
      // Arrange: time mode, deselectable, carrying a value.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      fixture.componentRef.setInput('canNull', true);
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 30)));
      await flush(fixture);

      // Act: Press Backspace on the time input - the clear path is gated on canNull.
      getTimeInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
      fixture.detectChanges();

      // Assert: The clear reached the wrapper through the shared value model.
      expect(fixture.componentInstance.value(), 'Backspace with canNull must clear the value').toBeNull();
      expect(getTimeInput(fixture).value, 'time input should be empty after clear').toBe('');
    });
  });

  describe('label', () => {
    it('should open clock panel and move focus into hour listbox when hidden button (label target) is clicked', async () => {
      // Arrange: Render wrapper in time mode with closed panel.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const timeInput = getTimeInput(fixture);
      expect(timeInput.getAttribute('aria-expanded'), 'panel should start closed').toBe('false');

      // Act: Click hidden button; label activation forwards the click here.
      getHiddenButton(fixture).click();
      await flush(fixture);

      // Assert: Panel is open on the time input and keyboard focus sits in its hour listbox -
      // the same end state as clicking the input directly.
      expect(timeInput.getAttribute('aria-expanded'), 'label-target click should open the clock panel').toBe('true');
      expect(document.activeElement, 'focus should move into the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should redirect focus from hidden button into sub-picker when it receives focus directly', async () => {
      // Arrange: Render wrapper in time mode with closed panel.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const hiddenButton = getHiddenButton(fixture);

      // Act: Focus hidden button programmatically (as label activation does before clicking it).
      hiddenButton.focus();
      await flush(fixture);

      // Assert: Focus left the hidden button and the panel opened through the input focus handler.
      expect(document.activeElement, 'focus should leave the hidden button').not.toBe(hiddenButton);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'redirected focus should open the clock panel').toBe('true');
      expect(document.activeElement, 'focus should end in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should keep clock panel open and not emit touch when focus moves to hidden button', async () => {
      // Arrange: Open the clock panel via first label activation and spy on touch output.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getHiddenButton(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before act').toBe('true');

      // Act: Simulate label activation moving focus from inside the time-picker to the hidden
      // button (bubbles to the time-picker's focusout handler, like a real focus move does).
      getTimeInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: getHiddenButton(fixture) }));
      fixture.detectChanges();

      // Assert: The hidden button is the host component's label relay - still "inside" the
      // component, so it must neither close the panel nor report the control as touched.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus move to hidden button should keep panel open').toBe('true');
      expect(touchSpy, 'focus move to hidden button should not emit touch').not.toHaveBeenCalled();
    });

    it('should close clock panel and keep focus on time input on second label activation', async () => {
      // Arrange: Open the clock panel through the first label activation.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getHiddenButton(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before second activation').toBe('true');

      // Act: Second label activation - the browser focuses the hidden button, then forwards click.
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);

      // Assert: Second activation toggles closed; focus never left the component, so no touch.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'second label activation should close the panel').toBe('false');
      expect(document.activeElement, 'focus should end on the time input').toBe(getTimeInput(fixture));
      expect(touchSpy, 'second label activation should not emit touch').not.toHaveBeenCalled();
    });

    it('should keep clock panel closed when the forwarded click runs before the hidden button focus', async () => {
      // Arrange: Open the clock panel through the first label activation.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getHiddenButton(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before second activation').toBe('true');

      // Act: Engines disagree on label activation order - WebKit forwards the click FIRST
      // (the click closes the panel) and only then focuses the hidden button, both within the
      // same task. The focus that follows must not read the just-closed panel as a fresh
      // (focus-only) activation.
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.click();
      hiddenButton.focus();
      await flush(fixture);

      // Assert: Panel stays closed with focus parked on the input; internal focus moves report no touch.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus after the closing click must not reopen the panel').toBe('false');
      expect(document.activeElement, 'focus should end on the time input').toBe(getTimeInput(fixture));
      expect(touchSpy, 'click-then-focus activation should not emit touch').not.toHaveBeenCalled();
    });

    it('should open clock panel on click-first label activation when input already holds focus', async () => {
      // Arrange: Close the panel so focus parks on the input (state left behind by a previous close).
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.click();
      await flush(fixture);
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be closed before act').toBe('false');
      expect(document.activeElement, 'focus should be parked on the input before act').toBe(getTimeInput(fixture));

      // Act: Click-first activation while the input already has focus (both events in the same
      // task, like a real WebKit label activation) - the click's focus redirect is a no-op
      // (input already focused), so opening must not depend on a focus event.
      hiddenButton.click();
      hiddenButton.focus();
      await flush(fixture);

      // Assert: Panel opens and keyboard focus ends in the hour listbox.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'click-first activation should open the panel').toBe('true');
      expect(document.activeElement, 'focus should end in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should reopen clock panel on third label activation', async () => {
      // Arrange: Open then close the panel through two label activations.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.click();
      await flush(fixture);
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be closed before third activation').toBe('false');

      // Act: Third label activation.
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);

      // Assert: Activation toggles back open with keyboard focus in the hour listbox.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'third label activation should reopen the panel').toBe('true');
      expect(document.activeElement, 'focus should end in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should not redirect focus or open panel when disabled', async () => {
      // Arrange: Render wrapper in time mode and disabled.
      const fixture = await arrangeDateTimePicker({ mode: 'time', disabled: true });

      // Act: Click hidden button (label activation target).
      getHiddenButton(fixture).click();
      await flush(fixture);

      // Assert: Panel stays closed and focus is not pulled into the sub-picker.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'disabled picker should keep panel closed').toBe('false');
      expect(document.activeElement, 'disabled picker should not take focus via label target').not.toBe(getTimeInput(fixture));
      expect(document.activeElement, 'disabled picker should not focus hour listbox').not.toBe(getHourColumn(fixture));
    });

    // datetime mode: BOTH sub-pickers are rendered, so handleLabelFocus's `wasClosed` evaluates
    // two terms (the single-mode tests above only ever exercise one). Every activation below
    // presses the associated label first, because the wrapper's document mousedown handler is
    // what resets focusOpened/labelClickDecision - the same fresh state a real pointer press
    // produces. Skipping it leaves a stale `labelClickDecision`, which routes the focus handler
    // down a different branch and hides the state computation under test.

    /**
     * Create a `<label>` whose `for` points at the fixture's hidden label target, removed
     * together with the fixture. Real label activations press THIS element (the document
     * handler recognizes it as the wrapper's own label and resets the activation markers
     * instead of treating the press as an outside close).
     * @param fixture Fixture of the wrapper under test.
     * @returns The associated label element.
     */
    function appendAssociatedLabel(fixture: ComponentFixture<DateTimePicker>): HTMLLabelElement {
      const label = document.createElement('label');
      label.htmlFor = fixture.componentInstance.resolvedIdent();
      document.body.appendChild(label);
      fixture.componentRef.onDestroy(() => label.remove());
      return label;
    }

    /**
     * Simulate one full label activation the way focus-first engines (Chromium/Firefox)
     * perform it: mousedown on the label, focus of its hidden target, then the forwarded click.
     * @param label The wrapper's associated label.
     * @param hiddenButton The label's hidden target button.
     */
    function activateFocusFirst(label: HTMLLabelElement, hiddenButton: HTMLButtonElement): void {
      dispatchMousedown(label);
      hiddenButton.focus();
      hiddenButton.click();
    }

    /**
     * Simulate one full label activation the way click-first engines (WebKit) perform it:
     * mousedown on the label, the forwarded click, then the focus of its hidden target.
     * @param label The wrapper's associated label.
     * @param hiddenButton The label's hidden target button.
     */
    function activateClickFirst(label: HTMLLabelElement, hiddenButton: HTMLButtonElement): void {
      dispatchMousedown(label);
      hiddenButton.click();
      hiddenButton.focus();
    }

    it('should swallow the forwarded click and keep the calendar open on first label activation in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with closed panels and an associated label.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);

      // Act: One full focus-first activation (the open half of the pair).
      activateFocusFirst(label, getHiddenButton(fixture));
      await flush(fixture);
      await flush(fixture);

      // Assert: The focus redirect opened the calendar and the paired click was swallowed -
      // a single activation must not toggle the panel shut again (closed -> open, exactly once).
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'first activation should leave the calendar open').toBe('true');
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'the clock must stay closed in datetime mode').toBe('false');
      expect(document.activeElement, 'focus should end in the calendar grid').toBe(getCalendarGrid(fixture));
    });

    it('should close the calendar on second focus-first label activation in datetime mode', async () => {
      // Arrange: Open the calendar through the first full activation.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const hiddenButton = getHiddenButton(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      activateFocusFirst(label, hiddenButton);
      await flush(fixture);
      await flush(fixture);
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before second activation').toBe('true');

      // Act: Second focus-first activation - the wrapper must see the OPEN calendar (neither
      // panel closed is false) and therefore not arm the click swallow, so the forwarded click
      // toggles the panel shut.
      activateFocusFirst(label, hiddenButton);
      await flush(fixture);

      // Assert: The calendar closed and focus parked on the date input; internal focus moves
      // (grid -> hidden target -> input) never leave the component, so no touch is reported.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'second focus-first activation should close the calendar').toBe('false');
      expect(document.activeElement, 'focus should end on the date input').toBe(getDateInput(fixture));
      expect(touchSpy, 'label toggle should not emit touch').not.toHaveBeenCalled();
    });

    it('should close both panels when a focus-first label activation starts with the clock open in datetime mode', async () => {
      // Arrange: datetime mode with the clock panel open (focus inside its hour listbox).
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getTimeInput(fixture).click();
      await flush(fixture);
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock panel should be open before act').toBe('true');

      // Act: Full focus-first activation. The redirect targets the date input (date leads),
      // whose arrival closes the clock (wrapper focusin) and opens the calendar; the forwarded
      // click must toggle that freshly opened calendar shut instead of being swallowed.
      activateFocusFirst(label, getHiddenButton(fixture));
      await flush(fixture);
      await flush(fixture);

      // Assert: Clock-open -> activation ends with BOTH panels closed, never with the calendar
      // left standing after an invisible switch from the clock.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar must not survive a clock-open activation').toBe('false');
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should be closed by the focus redirect').toBe('false');
      expect(touchSpy, 'label toggle should not emit touch').not.toHaveBeenCalled();
    });

    it('should keep the calendar closed on second click-first label activation in datetime mode', async () => {
      // Arrange: Open the calendar through the first activation.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const hiddenButton = getHiddenButton(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      activateFocusFirst(label, hiddenButton);
      await flush(fixture);
      await flush(fixture);
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before second activation').toBe('true');

      // Act: Engines disagree on label activation order - WebKit forwards the click FIRST (the
      // click closes the calendar) and only then focuses the hidden button, both within the
      // same task. The focus that follows must restore focus on the input without reopening.
      activateClickFirst(label, hiddenButton);
      await flush(fixture);

      // Assert: Panel stays closed with focus parked on the input; no touch is reported.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'click-first activation should close the calendar').toBe('false');
      expect(document.activeElement, 'focus should end on the date input').toBe(getDateInput(fixture));
      expect(touchSpy, 'click-first label toggle should not emit touch').not.toHaveBeenCalled();
    });

    it('should open the calendar on click-first label activation when both panels are closed in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with closed panels and an associated label.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);

      // Act: One full click-first activation (WebKit order): the forwarded click runs while both
      // panels are closed, so it records the 'open' decision and opens the calendar itself; the
      // focus of the hidden button that follows must consume that decision instead of toggling.
      activateClickFirst(label, getHiddenButton(fixture));
      await flush(fixture);
      await flush(fixture);

      // Assert: The calendar is open with keyboard focus in its grid (date leads the open
      // redirect); the clock stays closed throughout.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'click-first activation should open the calendar').toBe('true');
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'the clock must stay closed in datetime mode').toBe('false');
      expect(document.activeElement, 'focus should end in the calendar grid').toBe(getCalendarGrid(fixture));
    });

    it('should close the clock and park focus on the time input on click-first label activation while only the clock is open in datetime mode', async () => {
      // Arrange: datetime mode with ONLY the clock panel open (opened through its input), so the
      // forwarded click records WHICH panel it closed - the `closed:time` branch the single-mode
      // tests can only reach without a sibling date sub-picker present.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getTimeInput(fixture).click();
      await flush(fixture);
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock panel should be open before act').toBe('true');

      // Act: Click-first activation with the calendar closed and the clock open.
      activateClickFirst(label, getHiddenButton(fixture));
      await flush(fixture);

      // Assert: The click closed the clock via hidePanelAndRefocus and the focus that followed
      // only restored on the time input; the calendar must never open on the way, and the whole
      // relay stays inside the wrapper, so no touch is reported.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'label activation should close the clock').toBe('false');
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar must not open while closing the clock').toBe('false');
      expect(document.activeElement, 'focus should end on the time input').toBe(getTimeInput(fixture));
      expect(touchSpy, 'label toggle should not emit touch').not.toHaveBeenCalled();
    });

    registerLabelPreventionTests({
      ident: 'test-dtp',
      arrange: async (ident) => {
        const fixture = await arrangeDateTimePicker(ident === undefined ? {} : { ident });
        return { destroy: () => fixture.destroy() };
      },
    });
  });

  describe('aria', () => {
    it('should name both sub-inputs with the label plus distinct qualifiers in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime', label: 'my-label' });

      // Assert: Each input is labelled by the same label AND its own qualifier, so the two
      // accessible names differ while the visible label text stays a prefix of both.
      const dateName = getDateInput(fixture).getAttribute('aria-labelledby');
      const timeName = getTimeInput(fixture).getAttribute('aria-labelledby');
      expect(dateName, 'date input should be labelled by label + date qualifier').toBe('my-label dateId_test-dtp_qualifier');
      expect(timeName, 'time input should be labelled by label + time qualifier').toBe('my-label timeId_test-dtp_qualifier');
      expect(dateName, 'the two inputs must not share the same accessible name').not.toBe(timeName);
      expect(getDateInput(fixture).hasAttribute('aria-label'), 'labelled date input must not carry aria-label').toBe(false);
      expect(getTimeInput(fixture).hasAttribute('aria-label'), 'labelled time input must not carry aria-label').toBe(false);
    });

    it('should render both qualifier elements with distinct ids in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime', label: 'my-label' });

      // Assert: Both hidden qualifiers exist and their ids match the aria-labelledby references.
      const dateQualifier = fixture.nativeElement.querySelector('#dateId_test-dtp_qualifier');
      const timeQualifier = fixture.nativeElement.querySelector('#timeId_test-dtp_qualifier');
      expect(dateQualifier, 'date qualifier should be rendered').not.toBeNull();
      expect(timeQualifier, 'time qualifier should be rendered').not.toBeNull();
      expect(dateQualifier?.textContent?.trim(), 'date qualifier should carry the date key').toBe('dateTimePicker.date');
      expect(timeQualifier?.textContent?.trim(), 'time qualifier should carry the time key').toBe('dateTimePicker.time');
    });

    it('should label the single date input without a qualifier in date mode', async () => {
      // Arrange: Render wrapper in date-only mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'date', label: 'my-label' });

      // Assert: Only the date input exists; its name is the plain label (no qualifier needed).
      expect(getDateInput(fixture).getAttribute('aria-labelledby'), 'date input should be labelled by the label alone').toBe('my-label');
      expect(fixture.nativeElement.querySelector('[id="dateId_test-dtp_qualifier"]'), 'qualifier must not render in date mode').toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_input"]'), 'time input must not render in date mode').toBeNull();
    });

    it('should label the single time input without a qualifier in time mode', async () => {
      // Arrange: Render wrapper in time-only mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'time', label: 'my-label' });

      // Assert: Only the time input exists; its name is the plain label (no qualifier needed).
      expect(getTimeInput(fixture).getAttribute('aria-labelledby'), 'time input should be labelled by the label alone').toBe('my-label');
      expect(fixture.nativeElement.querySelector('[id="timeId_test-dtp_qualifier"]'), 'qualifier must not render in time mode').toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="dateId_test-dtp_input"]'), 'date input must not render in time mode').toBeNull();
    });

    it('should fall back to distinct aria-labels in datetime mode when no label is given', async () => {
      // Arrange: Render wrapper in datetime mode without a label.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });

      // Assert: Fallback names are already distinct per sub-field; no dangling aria-labelledby.
      expect(getDateInput(fixture).hasAttribute('aria-labelledby'), 'date input must not carry aria-labelledby without label').toBe(false);
      expect(getTimeInput(fixture).hasAttribute('aria-labelledby'), 'time input must not carry aria-labelledby without label').toBe(false);
      expect(getDateInput(fixture).getAttribute('aria-label'), 'date input should fall back to its date key').toBe('dateTimePicker.date');
      expect(getTimeInput(fixture).getAttribute('aria-label'), 'time input should fall back to its time key').toBe('dateTimePicker.time');
      expect(fixture.nativeElement.querySelector('.picker-name-qualifier'), 'no qualifier should render without label').toBeNull();
    });

    it('should warn from both sub-pickers when the forwarded label id matches no element', async () => {
      // Arrange: Spy on console.warn; datetime mode renders both sub-pickers and the label
      // reference is deliberately left dangling.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Act: Create the wrapper - each sub-picker checks the forwarded reference on first CD.
        await arrangeDateTimePicker({ mode: 'datetime', label: 'ghost-label', resolveLabel: false });

        // Assert: Both sub-pickers reported the dangling id, each naming its own input.
        const messages = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
        expect(messages, 'date sub-picker should report the dangling id').toContain('(ident "dateId_test-dtp")');
        expect(messages, 'time sub-picker should report the dangling id').toContain('(ident "timeId_test-dtp")');
        expect(messages, 'warning should name the dangling id').toContain('ghost-label');
      } finally { // cleanup
        warnSpy.mockRestore();
      }
    });
  });

  describe('outside press', () => {
    /**
     * Open the clock panel through a direct click on the time input.
     * @param fixture Fixture of the wrapper under test.
     */
    async function openClockPanel(fixture: ComponentFixture<DateTimePicker>): Promise<void> {
      getTimeInput(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before act').toBe('true');
    }

    const driver: OutsidePressDriver = {
      popup: 'clock panel',
      subject: 'wrapper',
      touchSource: 'focusout',
      ident: 'test-dtp',
      arrange: async () => {
        const fixture = await arrangeDateTimePicker({ mode: 'time' });
        return {
          open: async () => {
            await openClockPanel(fixture);
          },
          isOpen: () => getTimeInput(fixture).getAttribute('aria-expanded') === 'true',
          trackTouch: () => {
            const touchSpy = vi.fn();
            fixture.componentInstance.touch.subscribe(touchSpy);
            return touchSpy;
          },
          settle: () => flush(fixture),
          destroy: () => fixture.destroy(),
        };
      },
    };
    registerOutsidePressTests(driver);

    it('should keep the value when an outside press closes the clock panel with a pending pick', async () => {
      // Arrange: Wrapper carrying a value, clock panel open and hour 9 picked - the pick stays
      // pending until the minute column is picked too.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const value = new Date(Date.UTC(2026, 0, 15, 14, 30));
      fixture.componentRef.setInput('value', value);
      await flush(fixture);
      await openClockPanel(fixture);
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      try {
        // Act: Pick hour 9 (partial selection), then press outside the wrapper.
        fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_h9"]').click();
        await flush(fixture);
        expect(fixture.componentInstance.value(), 'pending hour pick must not change the value').toBe(value);
        dispatchMousedown(outside);
        await flush(fixture);

        // Assert: The press closes the panel WITHOUT committing the pending pick - the value
        // is the very same instance, so no form update happened on the way out.
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'outside mousedown should close the clock panel').toBe('false');
        expect(fixture.componentInstance.value(), 'outside press must discard the pending pick').toBe(value);
      } finally { // cleanup
        outside.remove();
      }
    });

    it('should keep clock panel open when mousedown lands inside the wrapper', async () => {
      // Arrange: Open the panel; both the input and the panel chrome are valid inside targets.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      await openClockPanel(fixture);

      // Act: Press the time input (its own mousedown handler runs as well).
      dispatchMousedown(getTimeInput(fixture));
      await flush(fixture);

      // Assert: Input press must not close - it toggles through the subsequent click.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'mousedown on the time input should keep the panel open').toBe('true');

      // Act: Press the clock panel chrome (padding/border area).
      dispatchMousedown(fixture.nativeElement.querySelector('.clock-container'));
      await flush(fixture);

      // Assert: Panel chrome is inside the wrapper, so the press must not close either.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'mousedown on the panel chrome should keep the panel open').toBe('true');
    });

    it('should close the calendar panel when mousedown lands outside the wrapper', async () => {
      // Arrange: Render wrapper in date mode with the calendar open and a button outside it -
      // the shared suite above drives the same guard through the clock, this one proves the
      // `onOutsidePress` close also reaches the date sub-picker.
      const fixture = await arrangeDateTimePicker({ mode: 'date' });
      await openCalendarPanel(fixture);
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      try {
        // Act: Press outside the wrapper - the document guard forwards it to onOutsidePress.
        dispatchMousedown(outside);
        await flush(fixture);

        // Assert: Panel closed by the press itself.
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'outside mousedown should close the calendar panel').toBe('false');
      } finally { // cleanup
        outside.remove();
      }
    });

    it('should keep calendar panel open when mousedown lands inside the wrapper', async () => {
      // Arrange: Open the calendar; both the input and the panel chrome are valid inside targets.
      const fixture = await arrangeDateTimePicker({ mode: 'date' });
      await openCalendarPanel(fixture);

      // Act: Press the date input (its own mousedown handler runs as well).
      dispatchMousedown(getDateInput(fixture));
      await flush(fixture);

      // Assert: Input press must not close - it toggles through the subsequent click.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'mousedown on the date input should keep the calendar open').toBe('true');

      // Act: Press the calendar panel chrome (padding/border area).
      dispatchMousedown(fixture.nativeElement.querySelector('.calendar-container'));
      await flush(fixture);

      // Assert: Panel chrome is inside the wrapper, so the press must not close either.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'mousedown on the panel chrome should keep the calendar open').toBe('true');
    });
  });

  // In datetime mode the wrapper keeps a SEPARATE model per sub-picker (date half, time half)
  // and only combines them into the wrapper value when BOTH halves are selected - a half-only
  // pick must never leak its default counterpart (00:00 time / today's date) into the wrapper
  // value or into the sibling input. In single modes the sub-picker binds the wrapper value
  // directly. The sub-picker specs verify their own half of the model; these tests verify the
  // split wiring, the combination and consumer writes across the wrapper.
  describe('value', () => {
    it('should render an externally set value in both sub-inputs in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with no value.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });

      // Act: Consumer writes a value into the wrapper model after creation.
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 45)));
      await flush(fixture);

      // Assert: The consumer value is split into both halves - the date input shows the UTC
      // date part, the time input the UTC time part.
      expect(getDateInput(fixture).value, 'date input should show the UTC date part').toBe('2026-01-15');
      expect(getTimeInput(fixture).value, 'time input should show the UTC time part').toBe('14:45');
    });

    it('should commit a date pick through the wrapper value while keeping the time of day', async () => {
      // Arrange: datetime mode carrying a value; the calendar opens on the value's month.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 30)));
      await flush(fixture);
      await openCalendarPanel(fixture);

      // Act: Pick a new day in the calendar.
      const day20 = findDayCell(fixture, 20);
      expect(day20, 'precondition: day 20 should be on the January 2026 grid').not.toBeNull();
      day20?.click();
      await flush(fixture);

      // Assert: The pick flowed through the wrapper model - new date, time of day preserved and
      // both sub-inputs agree with it; the calendar completes the interaction by closing.
      expect(fixture.componentInstance.value()?.toISOString(), 'committed pick should keep the time of day').toBe('2026-01-20T14:30:00.000Z');
      expect(getDateInput(fixture).value, 'date input should show the picked day').toBe('2026-01-20');
      expect(getTimeInput(fixture).value, 'time input should keep showing the time of day').toBe('14:30');
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should close after the pick').toBe('false');
    });

    it('should keep the wrapper value unset and the time input empty when only a date is picked', async () => {
      // Arrange: Clock pinned to 15 January 2026 so the no-value calendar seeds its grid on a
      // known month regardless of when the suite runs.
      const fixture = await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
        const created = await arrangeDateTimePicker({ mode: 'datetime' });

        // Act: Pick a day through the calendar.
        await openCalendarPanel(created);
        const day20 = findDayCell(created, 20);
        expect(day20, 'precondition: day 20 should be on the January 2026 grid').not.toBeNull();
        day20?.click();
        await flush(created);
        return created;
      });

      // Assert: Only the date half is selected - the wrapper stays unset (no implied 00:00
      // time) and the time input must not show a default time the user never picked.
      expect(fixture.componentInstance.value(), 'date-only pick must not produce a wrapper value').toBeNull();
      expect(getDateInput(fixture).value, 'date input should show the picked day').toBe('2026-01-20');
      expect(getTimeInput(fixture).value, 'time input must stay empty until a time is picked').toBe('');
    });

    it('should keep the wrapper value unset and the date input empty when only a time is picked', async () => {
      // Arrange: datetime mode with no value (the clock seeds its view from the local time).
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });

      // Act: Complete a clock pick - hour 14 first, then minute 45, which commits the time half.
      await openClockPanel(fixture);
      fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_h14"]').click();
      await flush(fixture);
      fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_m45"]').click();
      await flush(fixture);

      // Assert: Only the time half is selected - the wrapper stays unset (no auto-seeded
      // calendar date) and the date input must not show today unless the user picks a day.
      expect(fixture.componentInstance.value(), 'time-only pick must not produce a wrapper value').toBeNull();
      expect(getTimeInput(fixture).value, 'time input should show the picked time').toBe('14:45');
      expect(getDateInput(fixture).value, 'date input must stay empty until a day is picked').toBe('');
    });

    it('should combine a date pick followed by a time pick into the wrapper value', async () => {
      // Arrange: Clock pinned to 15 January 2026 so both picks land on a known calendar.
      const fixture = await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
        const created = await arrangeDateTimePicker({ mode: 'datetime' });

        // Act: Pick day 20 through the calendar, then 14:45 through the clock (hour partial,
        // minute completing the session).
        await openCalendarPanel(created);
        findDayCell(created, 20)?.click();
        await flush(created);
        await openClockPanel(created);
        created.nativeElement.querySelector('[data-testid="timeId_test-dtp_h14"]').click();
        await flush(created);
        created.nativeElement.querySelector('[data-testid="timeId_test-dtp_m45"]').click();
        await flush(created);
        return created;
      });

      // Assert: Both halves picked -> the wrapper value carries their combination and both
      // sub-inputs agree with it.
      expect(fixture.componentInstance.value()?.toISOString(), 'value should combine the picked date and time').toBe('2026-01-20T14:45:00.000Z');
      expect(getDateInput(fixture).value, 'date input should show the picked day').toBe('2026-01-20');
      expect(getTimeInput(fixture).value, 'time input should show the picked time').toBe('14:45');
    });

    it('should combine a time pick followed by a date pick onto the picked day, not onto today', async () => {
      // Arrange: Clock pinned to 15 January 2026 - today's date is a trap: a time picked first
      // must NOT seed it into the calendar half.
      const fixture = await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
        const created = await arrangeDateTimePicker({ mode: 'datetime' });

        // Act: Complete a clock pick first (14:45) - the wrapper must stay unset so far.
        await openClockPanel(created);
        created.nativeElement.querySelector('[data-testid="timeId_test-dtp_h14"]').click();
        await flush(created);
        created.nativeElement.querySelector('[data-testid="timeId_test-dtp_m45"]').click();
        await flush(created);
        expect(created.componentInstance.value(), 'precondition: time-only pick must stay unset').toBeNull();
        expect(getDateInput(created).value, 'precondition: date input must stay empty after the time pick').toBe('');

        // Act: Then pick day 20 through the calendar (its no-value grid seeds on the mocked
        // local date, 15 January 2026).
        await openCalendarPanel(created);
        findDayCell(created, 20)?.click();
        await flush(created);
        return created;
      });

      // Assert: The value carries the PICKED day with the picked time - never an auto-seeded
      // date.
      expect(fixture.componentInstance.value()?.toISOString(), 'value should combine picked time with picked day').toBe('2026-01-20T14:45:00.000Z');
      expect(getDateInput(fixture).value, 'date input should show the picked day').toBe('2026-01-20');
      expect(getTimeInput(fixture).value, 'time input should keep showing the picked time').toBe('14:45');
    });

    it('should clear the wrapper value but keep the time input when the date half deselects', async () => {
      // Arrange: datetime mode, deselectable, carrying a value rendered in both sub-inputs.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      fixture.componentRef.setInput('canNull', true);
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 30)));
      await flush(fixture);
      await openCalendarPanel(fixture);

      // Act: Re-click the value's own day - a deselect allowed by canNull.
      const selected = fixture.nativeElement.querySelector('.day.selected') as HTMLElement | null;
      expect(selected, 'precondition: value day should be marked selected').not.toBeNull();
      selected?.click();
      await flush(fixture);

      // Assert: Only the date half clears - the wrapper value follows it to null, while the
      // time half survives so the user does not lose the picked time.
      expect(fixture.componentInstance.value(), 'deselect must clear the wrapper value').toBeNull();
      expect(getDateInput(fixture).value, 'date input should be empty after the deselect').toBe('');
      expect(getTimeInput(fixture).value, 'time input should keep the surviving time half').toBe('14:30');
    });

    it('should clear the wrapper value but keep the date input when the time half deselects', async () => {
      // Arrange: datetime mode, deselectable, carrying a value rendered in both sub-inputs.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      fixture.componentRef.setInput('canNull', true);
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 30)));
      await flush(fixture);
      await openClockPanel(fixture);

      // Act: Un-pick both clock columns (re-picking a column's own value toggles it to
      // discarded under canNull) - the second discard of each column completes the clear.
      fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_h14"]').click();
      await flush(fixture);
      fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_h14"]').click();
      await flush(fixture);
      fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_m30"]').click();
      await flush(fixture);
      fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_m30"]').click();
      await flush(fixture);

      // Assert: Only the time half clears - the wrapper value follows it to null, while the
      // date half survives so the user does not lose the picked day.
      expect(fixture.componentInstance.value(), 'clear must empty the wrapper value').toBeNull();
      expect(getTimeInput(fixture).value, 'time input should be empty after the clear').toBe('');
      expect(getDateInput(fixture).value, 'date input should keep the surviving date half').toBe('2026-01-15');
    });

    it('should clear both sub-inputs when the consumer clears the value', async () => {
      // Arrange: datetime mode carrying a value rendered in both sub-inputs.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      fixture.componentRef.setInput('value', new Date(Date.UTC(2026, 0, 15, 14, 45)));
      await flush(fixture);
      expect(getDateInput(fixture).value, 'precondition: date input should show the value').toBe('2026-01-15');
      expect(getTimeInput(fixture).value, 'precondition: time input should show the value').toBe('14:45');

      // Act: Consumer writes null into the wrapper model.
      fixture.componentRef.setInput('value', null);
      await flush(fixture);

      // Assert: The cleared value empties BOTH halves - nothing may survive an external clear.
      expect(fixture.componentInstance.value(), 'value should stay null after the external clear').toBeNull();
      expect(getDateInput(fixture).value, 'date input should be empty after the external clear').toBe('');
      expect(getTimeInput(fixture).value, 'time input should be empty after the external clear').toBe('');
    });
  });

  describe('focus', () => {
    it('should focus the date input and open the calendar panel in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode - both sub-pickers are present and the date
      // one leads, so focus() must delegate to its (enabled) input. focus() is the
      // FormUiControl.focus contract used by the signal-forms Field directive.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });

      // Act: Focus the control programmatically. The calendar open awaits `forRender` once;
      // the second flush is a harmless extra round kept to mirror the clock's two-round open.
      fixture.componentInstance.focus();
      await flush(fixture);
      await flush(fixture);

      // Assert: The date input took focus, its focus handler opened the calendar panel, and
      // keyboard focus continued into the calendar grid so arrow navigation works right away.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'focus() should open the calendar panel').toBe('true');
      expect(document.activeElement, 'focus() should end with keyboard focus in the date sub-picker calendar grid').toBe(getCalendarGrid(fixture));
      expect(getCalendarGrid(fixture).getAttribute('aria-activedescendant'), 'grid should announce the seeded keyboard cursor').not.toBeNull();
    });

    it('should focus the time input and open the clock panel in time mode', async () => {
      // Arrange: Render wrapper in time mode with closed panel; focus() is the
      // FormUiControl.focus contract used by the signal-forms Field directive.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });

      // Act: Focus the control programmatically. The open spans two forRender rounds, so
      // a single flush cannot cover it yet (mirrors the sub-picker's focus-open tests).
      fixture.componentInstance.focus();
      await flush(fixture);
      await flush(fixture);

      // Assert: Delegation mirrors label activation - focus lands in the time sub-picker,
      // its focus handler opens the panel, and focus continues into the hour listbox.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus() should open the clock panel').toBe('true');
      expect(document.activeElement, 'focus() should end with keyboard focus in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should focus the date input and open the calendar panel in date mode', async () => {
      // Arrange: Render wrapper in date-only mode - the time sub-picker is absent, so focus()
      // must delegate to the date one without touching the missing view child.
      const fixture = await arrangeDateTimePicker({ mode: 'date' });

      // Act: Focus the control programmatically (FormUiControl.focus contract).
      fixture.componentInstance.focus();
      await flush(fixture);
      await flush(fixture);

      // Assert: The date input took focus, its focus handler opened the panel, and keyboard
      // focus continued into the calendar grid so arrow navigation works right away.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'focus() should open the calendar panel').toBe('true');
      expect(document.activeElement, 'focus() should end with keyboard focus in the calendar grid').toBe(getCalendarGrid(fixture));
    });

    it('should be a no-op when disabled', async () => {
      // Arrange: Disabled wrapper (forwarded to the sub-pickers).
      const fixture = await arrangeDateTimePicker({ mode: 'time', disabled: true });

      // Act: Focus the disabled control.
      fixture.componentInstance.focus();
      await flush(fixture);

      // Assert: Neither the input nor the panel reacts.
      expect(document.activeElement, 'focus() must not focus a disabled control').not.toBe(getTimeInput(fixture));
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus() must not open the panel when disabled').toBe('false');
    });

    it('should focus the date input exactly once, forwarding the given options', async () => {
      // Arrange: datetime mode - the date sub-picker leads, so it receives the contract's
      // options. A first bare probe focus would scroll the page (defeating preventScroll)
      // and leave a second, options-carrying call a no-op on the already-focused input.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const focusSpy = vi.spyOn(getDateInput(fixture), 'focus');

      // Act: Invoke the FormUiControl.focus contract with preventScroll, then settle the
      // panel open the focus handler started.
      fixture.componentInstance.focus({ preventScroll: true });
      await flush(fixture);
      await flush(fixture);

      // Assert: Exactly one focus call, and it carries the caller's options.
      expect(focusSpy, 'focus() must focus the date input in a single call').toHaveBeenCalledTimes(1);
      expect(focusSpy, 'focus() should pass the given options through to the date input').toHaveBeenCalledWith({ preventScroll: true });
    });

    it('should focus the time input exactly once, forwarding the given options', async () => {
      // Arrange: time mode - only the time sub-picker is rendered, so it owns the delegation.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const focusSpy = vi.spyOn(getTimeInput(fixture), 'focus');

      // Act: Invoke the FormUiControl.focus contract with preventScroll, then settle the
      // panel open the focus handler started.
      fixture.componentInstance.focus({ preventScroll: true });
      await flush(fixture);
      await flush(fixture);

      // Assert: Exactly one focus call, and it carries the caller's options.
      expect(focusSpy, 'focus() must focus the time input in a single call').toHaveBeenCalledTimes(1);
      expect(focusSpy, 'focus() should pass the given options through to the time input').toHaveBeenCalledWith({ preventScroll: true });
    });

    // Both sub-pickers live inside ONE wrapper root in datetime mode, so moving focus between
    // them never leaves the component the `touch` output talks about. The sub-pickers decide
    // that with their focusout containment, which used to be "own root + label target" only -
    // the sibling sub-picker was neither, so a Tab (or a Shift+Tab back out of the clock)
    // reported a spurious blur mid-interaction.
    describe('focus containment between sub-pickers', () => {
      it('should not emit touch when focus moves from the date input to the time input of the same wrapper', async () => {
        // Arrange: datetime mode (both sub-pickers present), calendar open with keyboard focus
        // in its grid, spy on the wrapper's touch output.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        fixture.componentInstance.focus();
        await flush(fixture);
        await flush(fixture);
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before the act').toBe('true');

        // Act: Tab-equivalent - focus the sibling time input directly.
        getTimeInput(fixture).focus();
        await flush(fixture);
        await flush(fixture);

        // Assert: Staying inside the wrapper is not a blur, but the wrapper still closes the
        // opposite panel (its focusin handler) and the arrival opens the clock.
        expect(touchSpy, 'focus move between sub-picker inputs of one wrapper must not report touch').not.toHaveBeenCalled();
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should close when focus moves to the time input').toBe('false');
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should open when focus arrives at the time input').toBe('true');
        expect(document.activeElement, 'focus should continue into the hour listbox').toBe(getHourColumn(fixture));
      });

      it('should not emit touch when focus moves from the clock back to the date input of the same wrapper', async () => {
        // Arrange: datetime mode with the clock open (keyboard sits in the hour listbox), spy
        // on the wrapper's touch output. This is the Shift+Tab-out-of-the-clock target.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        getTimeInput(fixture).focus();
        await flush(fixture);
        await flush(fixture);
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should be open before the act').toBe('true');
        expect(document.activeElement, 'keyboard should sit in the hour listbox before the act').toBe(getHourColumn(fixture));

        // Act: Shift+Tab-equivalent - focus the sibling date input directly.
        getDateInput(fixture).focus();
        await flush(fixture);
        await flush(fixture);

        // Assert: The hand-off back into the same wrapper must not report touch, while the
        // wrapper still closes the clock and the arrival auto-opens the calendar.
        expect(touchSpy, 'Shift+Tab back into the date sub-picker of one wrapper must not report touch').not.toHaveBeenCalled();
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should close when focus moves to the date input').toBe('false');
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should auto-open when focus arrives at the date input').toBe('true');
        expect(document.activeElement, 'focus should continue into the calendar grid').toBe(getCalendarGrid(fixture));
      });

      it('should emit touch when focus leaves the wrapper entirely', async () => {
        // Arrange: datetime mode with the calendar open, plus an element outside the wrapper.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        fixture.componentInstance.focus();
        await flush(fixture);
        await flush(fixture);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Focus the element outside the wrapper.
          outside.focus();
          await flush(fixture);

          // Assert: Containment on the wrapper root must not swallow a real blur.
          expect(touchSpy, 'focus leaving the wrapper should report touch once').toHaveBeenCalledTimes(1);
          expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should close when focus leaves the wrapper').toBe('false');
        } finally { // cleanup
          outside.remove();
        }
      });
    });
  });
});
