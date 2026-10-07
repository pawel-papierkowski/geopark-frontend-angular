import { ComponentFixture, TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { TranslateService, type TranslationObject } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { EnCalendarCellType } from '@/shared/ui/other/types';
import { installViewportStub, registerPositioningTests, uninstallViewportStub, type PositioningDriver } from '@/shared/ui/components/form/popup-panel/testing/positioning-tests';
import { registerSubPickerCoreTests, registerSubPickerFocusTests, type SubPickerBaseDriver, type SubPickerBaseFixture } from '@/shared/ui/components/form/popup-panel/testing/sub-picker-base-tests';

import { DatePicker } from './date-picker';

/**
 * Unit tests of date-picker component.
 * Structure mirrors time-picker.spec.ts (same helper style, flush conventions and suite layout).
 * The calendar grid only gets its CELLS once the panel has been opened (the viewed month is
 * seeded on open), so cell-related tests always open the panel first - often under a mocked
 * clock, so grid content is deterministic regardless of the real date the suite runs on.
 */
describe('DatePicker', () => {
  /** Options used to arrange a DatePicker instance under test. */
  interface DatePickerTestOptions {
    /** Initial value of the picker. */
    value?: Date | null;
    /** Identifier of the picker (used for ids and data-testids). */
    ident?: string;
    /** Label reference for aria-labelledby. */
    label?: string;
    /** Whether an element with the given `label` id is created (false leaves the reference
     * dangling, for the dev-mode warning tests). */
    resolveLabel?: boolean;
    /** Whether the accessible name gets the hidden "Date" qualifier appended. */
    qualifyLabel?: boolean;
    /** Whether the picker allows deselecting the date. */
    canNull?: boolean;
    /** Whether the picker shows week numbers. */
    showWeeks?: boolean;
    /** Earliest allowed date. */
    dateMin?: Date | null;
    /** Latest allowed date. */
    dateMax?: Date | null;
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
   * Create and configure a DatePicker component under test.
   * @param opts Options controlling initial inputs and translations.
   * @returns Fixture of the created component with initial change detection applied.
   */
  async function arrangeDatePicker(opts: DatePickerTestOptions = {}): Promise<ComponentFixture<DatePicker>> {
    const {
      value = null,
      ident = 'test-date',
      label = '',
      resolveLabel = true,
      qualifyLabel = false,
      canNull = false,
      showWeeks = false,
      dateMin = null,
      dateMax = null,
      required = false,
      disabled = false,
      invalid = false,
      translations,
    } = opts;

    await TestBed.configureTestingModule({
      imports: [DatePicker],
    }).compileComponents();

    // Register translations before component creation so computeds evaluating on first
    // change detection (placeholder) already see them.
    if (translations) {
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('en', translations);
      translateService.use('en');
    }

    const fixture = TestBed.createComponent(DatePicker);

    // Give the label reference a real target before the first change detection (the component's
    // dev-only effect checks it there), unless a test deliberately leaves it dangling.
    // Removed together with the fixture so ids never leak into the next test.
    if (label !== '' && resolveLabel) {
      const labelElement = document.createElement('label');
      labelElement.id = label;
      document.body.appendChild(labelElement);
      fixture.componentRef.onDestroy(() => labelElement.remove());
    }

    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('qualifyLabel', qualifyLabel);
    fixture.componentRef.setInput('canNull', canNull);
    fixture.componentRef.setInput('showWeeks', showWeeks);
    fixture.componentRef.setInput('dateMin', dateMin);
    fixture.componentRef.setInput('dateMax', dateMax);
    fixture.componentRef.setInput('required', required);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.componentRef.setInput('invalid', invalid);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  /**
   * Create a Date carrying the given UTC calendar date (and optionally time).
   * Keeps assertions timezone-agnostic, matching how the component reads/writes values.
   * @param year UTC year.
   * @param month UTC month index (0 = January).
   * @param day UTC day of month.
   * @param hour UTC hour (defaults to 0).
   * @param minute UTC minute (defaults to 0).
   * @param seconds UTC seconds (defaults to 0).
   * @param ms UTC milliseconds (defaults to 0).
   * @returns Date set to the given UTC parts.
   */
  function utcDate(year: number, month: number, day: number, hour: number = 0, minute: number = 0, seconds: number = 0, ms: number = 0): Date {
    return new Date(Date.UTC(year, month, day, hour, minute, seconds, ms));
  }

  /**
   * Get the date input element of given fixture (uses its ident).
   * @param fixture Fixture of the component.
   * @returns Input element of the picker.
   */
  function getInput(fixture: ComponentFixture<DatePicker>): HTMLInputElement {
    return fixture.nativeElement.querySelector(`[data-testid="${fixture.componentInstance.ident()}_input"]`);
  }

  /**
   * Get the calendar panel element of given fixture (uses its ident).
   * @param fixture Fixture of the component.
   * @returns Panel element of the picker.
   */
  function getPanel(fixture: ComponentFixture<DatePicker>): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${fixture.componentInstance.ident()}_panel"]`);
  }

  /**
   * Get one calendar header navigation button of given fixture (uses its ident).
   * @param fixture Fixture of the component.
   * @param name Button suffix: `yearMinus` | `monthMinus` | `monthPlus` | `yearPlus`.
   * @returns Navigation button element.
   */
  function getNavButton(fixture: ComponentFixture<DatePicker>, name: 'yearMinus' | 'monthMinus' | 'monthPlus' | 'yearPlus'): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${fixture.componentInstance.ident()}_${name}"]`);
  }

  /**
   * Get the hidden accessible-name qualifier span of given fixture (uses its ident).
   * @param fixture Fixture of the component.
   * @returns Qualifier element, or null when it is not rendered.
   */
  function getQualifier(fixture: ComponentFixture<DatePicker>): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[id="${fixture.componentInstance.ident()}_qualifier"]`);
  }

  /**
   * Flush pending component work: panel opening awaits `forRender` internally, so interaction
   * tests need stability flushes before asserting panel/focus state.
   * @param fixture Fixture of the component.
   */
  async function flush(fixture: ComponentFixture<DatePicker>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Open the calendar panel with a mouse click on the input and flush pending component work.
   * @param fixture Fixture of the component.
   */
  async function openPanel(fixture: ComponentFixture<DatePicker>): Promise<void> {
    getInput(fixture).click();
    await flush(fixture);
  }

  /**
   * Close the calendar panel with a mouse click on the input and flush pending component work.
   * Mirrors the flushing of `openPanel` so the async close cycle fully settles.
   * @param fixture Fixture of the component.
   */
  async function closePanel(fixture: ComponentFixture<DatePicker>): Promise<void> {
    getInput(fixture).click();
    await flush(fixture);
  }

  /**
   * Focus the input without triggering focus-driven panel opening, mimicking focus that follows
   * a mousedown (component skips auto-open for such focus). Uses the real production path: a
   * dispatched mousedown marks the upcoming focus as click-caused, the focus handler then
   * consumes the mark instead of opening the panel.
   * @param fixture Fixture of the component.
   * @returns The input element, already focused.
   */
  function focusInputWithoutOpening(fixture: ComponentFixture<DatePicker>): HTMLInputElement {
    const input = getInput(fixture);
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
    fixture.detectChanges();
    return input;
  }

  /**
   * Arrange an open calendar panel with DOM focus explicitly placed on the calendar grid.
   * The open path already moves focus into the grid; focusing it explicitly keeps the helper
   * independent of that timing and guarantees user-event key presses route to the grid's own
   * keydown handler.
   * @param opts Options passed to the component arrangement.
   * @param instant Optional instant the system clock is pinned to while arranging and opening.
   * @returns Fixture of the created component with the panel open and the grid focused.
   */
  async function arrangeFocusedGrid(opts: DatePickerTestOptions = {}, instant?: Date): Promise<ComponentFixture<DatePicker>> {
    const arrange = async (): Promise<ComponentFixture<DatePicker>> => {
      const fixture = await arrangeDatePicker(opts);
      await openPanel(fixture);
      fixture.componentInstance.calendarGridRef().nativeElement.focus();
      fixture.detectChanges();
      return fixture;
    };
    return instant === undefined ? arrange() : withMockedNow(instant, arrange);
  }

  /**
   * Find the rendered day cell for the given UTC date.
   * Cell testids are index-based (and shift when week numbers are shown), so the lookup goes
   * through the component's own cell model instead of guessing the index.
   * @param fixture Fixture of the component.
   * @param year UTC year.
   * @param month UTC month index (0 = January).
   * @param day UTC day of month.
   * @returns The cell element, or null when that date is not on the displayed grid.
   */
  function findCell(fixture: ComponentFixture<DatePicker>, year: number, month: number, day: number): HTMLElement | null {
    const cell = fixture.componentInstance.calendarCells().find(
      (candidate) => candidate.type === EnCalendarCellType.Date
        && candidate.year === year && candidate.month === month && candidate.day === day,
    );
    if (cell === undefined) return null;
    return fixture.nativeElement.querySelector(`[data-testid="${cell.testid}"]`);
  }

  /**
   * Run the given body with the system clock pinned to a fixed instant (Date only - timers stay
   * real, so Angular's stability flushes are unaffected). Needed wherever grid content, the
   * `today` marker or the no-value focus seed must not depend on when the suite runs.
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

  /**
   * Wrap a DatePicker fixture into the facade the shared sub-picker base suites drive.
   * @param fixture Fixture of the component.
   * @returns Fixture facade with component-specific operations bound to this fixture.
   */
  function wrapSubPickerFixture(fixture: ComponentFixture<DatePicker>): SubPickerBaseFixture {
    return {
      detectChanges: () => fixture.detectChanges(),
      trackTouch: () => {
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        return touchSpy;
      },
      open: () => openPanel(fixture),
      isOpen: () => fixture.componentInstance.isCalendarVisible(),
      input: () => getInput(fixture),
      insideTarget: () => fixture.componentInstance.calendarGridRef().nativeElement,
      panel: () => fixture.nativeElement.querySelector('.calendar-container'),
      chromeInnerTarget: () => fixture.nativeElement.querySelector('[data-testid="test-date_10"]'),
      dispatchFocusout: (source, relatedTarget) => {
        source.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: relatedTarget ?? undefined }));
      },
      appendOutsideButton: () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        return button;
      },
      setContainer: (container) => {
        fixture.componentRef.setInput('container', container);
        fixture.detectChanges();
      },
      setDisabled: async (disabled) => {
        fixture.componentRef.setInput('disabled', disabled);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      },
      flush: async () => {
        // One stability round settles the open continuation (measure under baseline, then
        // focus) before the caller asserts.
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      },
      showPanel: async () => {
        await fixture.componentInstance.showPanel();
        await fixture.whenStable();
        fixture.detectChanges();
      },
      focus: async (options) => {
        // The open awaits `forRender` once (measure under baseline, then focus), so one
        // stability round settles it.
        fixture.componentInstance.focus(options);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      },
      trackInputFocus: () => vi.spyOn(getInput(fixture), 'focus'),
      assertFocusLanded: () => {
        // The final handoff into the grid is asserted by the dedicated grid-focus test.
        expect(document.activeElement, 'focus() should move focus into the component').not.toBe(document.body);
      },
    };
  }

  /** Driver wiring the shared sub-picker base suites (core + focus) to DatePicker. */
  const subPickerDriver: SubPickerBaseDriver = {
    popup: 'calendar',
    innerWhere: 'on a day cell',
    focusContractTitle: 'should open the panel when focus() is called programmatically',
    arrange: async (options) => {
      const fixture = await arrangeDatePicker({
        disabled: options?.disabled ?? false,
        value: options?.withValue === true ? utcDate(2026, 0, 15) : null,
      });
      return wrapSubPickerFixture(fixture);
    },
  };

  beforeAll(() => {
    // jsdom does not implement scrollIntoView; stubbed so a stray call cannot throw.
    // Doubles as a spy: the scrolling suite asserts the component never calls it.
    Element.prototype.scrollIntoView = vi.fn();

    // Pin the viewport dimensions (always 0 without layout) shared by the positioning suite.
    installViewportStub();
  });

  afterAll(() => {
    uninstallViewportStub();
  });

  afterEach(() => {
    // Safety net so a mocked clock can never leak into the next test.
    vi.useRealTimers();
  });

  describe('general', () => {
    describe('rendering&display', () => {
      it('should render with default values', async () => {
        // Arrange: Create component with defaults.
        const fixture = await arrangeDatePicker();

        // Assert: Component renders, value is null, panel is closed.
        expect(getInput(fixture), 'input should be rendered').not.toBeNull();
        expect(fixture.componentInstance.value(), 'default value should be null').toBeNull();
        expect(fixture.componentInstance.isCalendarVisible(), 'calendar panel should be closed by default').toBe(false);
        expect(getPanel(fixture).style.display, 'panel should be hidden by default').toBe('none');
        expect(getInput(fixture).getAttribute('aria-expanded'), 'aria-expanded should be false by default').toBe('false');
      });

      it('should render 42 day cells and 7 weekday headers with ident-based testids', async () => {
        // Arrange: Create component with default ident and open the panel (cells are built
        // from the viewed month, which is only seeded once the panel opens).
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);

        // Assert: A fixed six-week grid renders with ident-based boundary testids present.
        expect(fixture.nativeElement.querySelectorAll('.day').length, 'should render 6 rows x 7 days').toBe(42);
        expect(fixture.nativeElement.querySelectorAll('.weekday').length, 'should render 7 weekday headers').toBe(7);
        expect(fixture.nativeElement.querySelector('[data-testid="test-date_0"]'), 'first cell testid should follow ident pattern').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="test-date_41"]'), 'last cell testid should follow ident pattern').not.toBeNull();
      });

      it('should keep the grid element but not its content while the panel is closed', async () => {
        // Arrange: Create component with default ident - panel closed, grid shell already rendered.
        const fixture = await arrangeDatePicker();
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        expect(grid, 'precondition: grid element should exist while closed').not.toBeNull();
        expect(grid.querySelectorAll('.day').length, 'precondition: closed grid must not render day cells').toBe(0);
        expect(grid.querySelectorAll('.weekday').length, 'precondition: closed grid must not render weekday headers').toBe(0);

        // Act: Open the panel, capture the rendered counts, then close it again.
        await openPanel(fixture);
        const openDayCount = grid.querySelectorAll('.day').length;
        const openWeekdayCount = grid.querySelectorAll('.weekday').length;
        await closePanel(fixture);

        // Assert: Content mounts only while the panel is shown - open fills the fixed grid,
        // closing unmounts it again, so closed-state change detection has no cells to touch.
        expect(openDayCount, 'open grid should render 6 rows x 7 day cells').toBe(42);
        expect(openWeekdayCount, 'open grid should render 7 weekday headers').toBe(7);
        expect(grid.querySelectorAll('.day').length, 'closing should unmount the day cells again').toBe(0);
        expect(grid.querySelectorAll('.weekday').length, 'closing should unmount the weekday headers again').toBe(0);
      });

      it('should show January 2026 grid with correct boundary cells when opened at a mocked date', async () => {
        // Arrange/Act: Open the panel while the clock reads 15 January 2026 - January 1st is a
        // Thursday, so the grid pads 3 days of December and finishes with 8 days of February.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker();
          await openPanel(created);
          return created;
        });

        // Assert: Leading/trailing padding days belong to their own months and are marked as
        // such, while every day of the viewed month is marked as current.
        const firstCell = findCell(fixture, 2025, 11, 29);
        expect(firstCell, 'leading padding should start at 29 December').not.toBeNull();
        expect(firstCell?.textContent?.trim(), 'first cell should show 29').toBe('29');
        expect(firstCell?.classList.contains('not-current'), 'December padding day should not be current').toBe(true);

        const firstOfMonth = findCell(fixture, 2026, 0, 1);
        expect(firstOfMonth, '1 January should be on the grid').not.toBeNull();
        expect(firstOfMonth?.textContent?.trim(), 'cell should show 1').toBe('1');
        expect(firstOfMonth?.classList.contains('not-current'), 'viewed-month day should be current').toBe(false);

        expect(findCell(fixture, 2026, 0, 31), '31 January should be on the grid').not.toBeNull();

        const lastCell = findCell(fixture, 2026, 1, 8);
        expect(lastCell, 'trailing padding should end at 8 February').not.toBeNull();
        expect(lastCell?.textContent?.trim(), 'last cell should show 8').toBe('8');
        expect(lastCell?.classList.contains('not-current'), 'February padding day should not be current').toBe(true);
        expect(findCell(fixture, 2026, 1, 9), '9 February must not fit into the six-week grid').toBeNull();
      });

      it('should display formatted UTC date in input when value is set', async () => {
        // Arrange: Create component with a value that also carries a time part.
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15, 14, 30, 47, 123) });

        // Assert: Input shows the date part only - the date picker never exposes the time.
        expect(getInput(fixture).value, 'input should show the YYYY-MM-DD date').toBe('2026-01-15');
      });

      it('should update input display when value changes programmatically', async () => {
        // Arrange: Create component with value 15 January 2026.
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15) });

        // Act: Set new value, then clear it.
        fixture.componentRef.setInput('value', utcDate(2026, 4, 20));
        fixture.detectChanges();
        expect(getInput(fixture).value, 'input should show updated date').toBe('2026-05-20');

        // Assert: Clearing value empties the input again.
        fixture.componentRef.setInput('value', null);
        fixture.detectChanges();
        expect(getInput(fixture).value, 'input should be empty after clearing value').toBe('');
      });

      it('should show placeholder translation key when no value is set', async () => {
        // Arrange: Create component without value and translations.
        const fixture = await arrangeDatePicker({ value: null });

        // Assert: Placeholder is exactly the translation key (no translations registered).
        expect(getInput(fixture).getAttribute('placeholder'), 'placeholder should be the translation key').toBe('dateTimePicker.placeholder.date');
      });

      it('should show translated placeholder when translations are provided', async () => {
        // Arrange: Create component with translations registered before creation.
        const fixture = await arrangeDatePicker({
          value: null,
          translations: { dateTimePicker: { placeholder: { date: 'yyyy-mm-dd' } } },
        });

        // Assert: Placeholder is exactly the resolved translation.
        expect(getInput(fixture).getAttribute('placeholder'), 'placeholder should be translated text').toBe('yyyy-mm-dd');
      });

      it('should render the calendar glyph as a separate aria-hidden decoration, not as value text', async () => {
        // Arrange: Create component with value and translations so both value and placeholder render.
        const fixture = await arrangeDatePicker({
          value: utcDate(2026, 0, 15, 14, 30),
          translations: { dateTimePicker: { placeholder: { date: 'yyyy-mm-dd' } } },
        });
        const icon = fixture.nativeElement.querySelector('[data-testid="test-date_icon"]');

        // Assert: Value and placeholder carry pure text - a screen reader announces the value,
        // so an emoji in it would be read as "calendar face" before the date.
        expect(getInput(fixture).value, 'value must not contain the decorative glyph').toBe('2026-01-15');
        expect(getInput(fixture).getAttribute('placeholder'), 'placeholder must not contain the decorative glyph').toBe('yyyy-mm-dd');

        // Assert: The glyph exists once, outside the input, and is hidden from assistive technology.
        expect(icon, 'decorative icon element should be rendered').not.toBeNull();
        expect(icon.textContent, 'decorative icon should show the calendar glyph').toBe('📅');
        expect(icon.getAttribute('aria-hidden'), 'decorative icon must be hidden from AT').toBe('true');
        expect(fixture.nativeElement.querySelectorAll('[data-testid="test-date_icon"]').length, 'exactly one decorative icon').toBe(1);
      });

      it('should apply disabled state to input when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeDatePicker({ disabled: true });
        const input = getInput(fixture);

        // Assert: Input is disabled, not reachable via Tab and marked for assistive technology.
        expect(input.disabled, 'input should be disabled').toBe(true);
        expect(input.getAttribute('tabindex'), 'disabled input should not be a tab stop').toBe('-1');
        expect(input.classList.contains('disabled'), 'input should have disabled class').toBe(true);
        expect(input.getAttribute('aria-disabled'), 'aria-disabled should be true when disabled').toBe('true');
      });

      it('should apply invalid state to input when invalid', async () => {
        // Arrange: Create invalid component.
        const fixture = await arrangeDatePicker({ invalid: true });
        const input = getInput(fixture);

        // Assert: Root and input are marked invalid for styling and assistive technology.
        expect(fixture.nativeElement.querySelector('.picker-date').classList.contains('invalid'), 'root should have invalid class').toBe(true);
        expect(input.classList.contains('invalid'), 'input should have invalid class').toBe(true);
        expect(input.getAttribute('aria-invalid'), 'aria-invalid should be true when invalid').toBe('true');
      });

      it('should apply both disabled and invalid state when both inputs are true', async () => {
        // Arrange: Create component with both disabled and invalid.
        const fixture = await arrangeDatePicker({ disabled: true, invalid: true });
        const input = getInput(fixture);

        // Assert: Both visual states are applied together.
        expect(input.classList.contains('disabled'), 'input should have disabled class').toBe(true);
        expect(input.classList.contains('invalid'), 'input should have invalid class').toBe(true);
        expect(fixture.nativeElement.querySelector('.picker-date').classList.contains('invalid'), 'root should have invalid class').toBe(true);
      });

      it('should mark the day of an externally set value as selected when panel is open', async () => {
        // Arrange: Component carries a value set from outside (form load), opened under a clock
        // mocked to the value's month so the day is guaranteed to be on the grid.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ value: utcDate(2026, 0, 15) });
          await openPanel(created);
          return created;
        });

        // Assert: The value's day carries the selected marks, a neighbouring day does not.
        const selected = findCell(fixture, 2026, 0, 15);
        const other = findCell(fixture, 2026, 0, 14);
        expect(selected, 'value day should be rendered').not.toBeNull();
        expect(selected?.classList.contains('selected'), 'value day should carry the selected class').toBe(true);
        expect(selected?.getAttribute('aria-selected'), 'value day should be aria-selected').toBe('true');
        expect(other?.classList.contains('selected'), 'other day must not be selected').toBe(false);
        expect(other?.getAttribute('aria-selected'), 'other day must not be aria-selected').toBe('false');
      });

      it('should mark local calendar date as today when it differs from the UTC date', async () => {
        // Arrange: Clock set to 15 January 2026, 00:30 Warsaw time - the UTC date is still
        // 14 January, but the user's calendar shows 15 January, so that is the day that must be
        // marked as today.
        const fixture = await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
          const created = await arrangeDatePicker();
          await openPanel(created);
          return created;
        });

        // Assert: The local day is today; the UTC day is not.
        const localToday = findCell(fixture, 2026, 0, 15);
        const utcToday = findCell(fixture, 2026, 0, 14);
        expect(localToday, 'local today should be rendered').not.toBeNull();
        expect(localToday?.classList.contains('today'), 'local calendar date should carry the today mark').toBe(true);
        expect(utcToday?.classList.contains('today'), 'the already-passed UTC date must not be marked as today').toBe(false);
      });

      it('should mark the current day with today class when local and UTC dates agree', async () => {
        // Arrange: Clock set to midday 15 January 2026 - local and UTC calendar dates match, so
        // this pins the baseline marking regardless of when the suite runs.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker();
          await openPanel(created);
          return created;
        });

        // Assert: Exactly the current day is marked as today.
        const today = findCell(fixture, 2026, 0, 15);
        expect(today?.classList.contains('today'), 'current day should carry the today mark').toBe(true);
        expect(findCell(fixture, 2026, 0, 14)?.classList.contains('today'), 'previous day must not be marked today').toBe(false);
        expect(findCell(fixture, 2026, 0, 16)?.classList.contains('today'), 'next day must not be marked today').toBe(false);
      });

      it('should seed viewed and keyboard-focus date from the local calendar date when no value is set', async () => {
        // Arrange: Same 00:30 Warsaw instant as the today-marker test - opening without a value
        // must pre-select the local date (15 January), not the UTC date (14 January).
        const fixture = await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
          const created = await arrangeDatePicker({ value: null });
          await openPanel(created);
          return created;
        });

        // Assert: Viewed month and keyboard cursor both sit on the local calendar date.
        const focused = fixture.componentInstance.focusedDate();
        expect(focused, 'focus seed should be set on open').not.toBeNull();
        expect(focused?.getUTCFullYear(), 'seeded year should match the local calendar date').toBe(2026);
        expect(focused?.getUTCMonth(), 'seeded month should match the local calendar date').toBe(0);
        expect(focused?.getUTCDate(), 'seeded day should match the local calendar date').toBe(15);
        expect(findCell(fixture, 2026, 0, 15)?.classList.contains('focused'), 'local today cell should carry the focus ring').toBe(true);
      });

      it('should show the month of the value when the panel opens', async () => {
        // Arrange: Component with a June value, opened under a clock mocked to January 2026 -
        // the header must announce the value's month so the user sees their date.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({
            value: utcDate(2026, 5, 10),
            translations: { dateTimePicker: { month: { 0: 'January', 5: 'June' } } },
          });
          await openPanel(created);
          return created;
        });

        // Assert: Header shows the value's month, not the mocked clock's month.
        expect(fixture.nativeElement.querySelector('.header-title').textContent?.trim(), 'header should show the value\u2019s month').toBe('2026 June');
      });

      it('should render header text from year and translated month name with a polite live region', async () => {
        // Arrange: Create component with month translations, opened at 15 January 2026.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ translations: { dateTimePicker: { month: { 0: 'January' } } } });
          await openPanel(created);
          return created;
        });
        const header = fixture.nativeElement.querySelector('.header-title');

        // Assert: Header combines year and month name; navigation changes announce politely.
        expect(header.textContent?.trim(), 'header should show year and translated month').toBe('2026 January');
        expect(header.getAttribute('aria-live'), 'header should be a polite live region').toBe('polite');
      });

      it('should lay the grid out in 7 columns, or 8 when weeks are shown', async () => {
        // Arrange: Create component with the default column count (grid style is bound even
        // while the panel is closed).
        const fixture = await arrangeDatePicker({ showWeeks: false });
        const grid = fixture.nativeElement.querySelector('.calendar-grid');

        // Assert: Plain grid uses seven columns.
        expect(grid.style.gridTemplateColumns, 'plain grid should use 7 columns').toBe('repeat(7, 1fr)');

        // Act: Open the panel once (the viewed month must exist before week numbers can be
        // built - see the showWeeks crash test), then enable week numbers.
        await openPanel(fixture);
        fixture.componentRef.setInput('showWeeks', true);
        fixture.detectChanges();

        // Assert: Week grid adds the week-number column.
        expect(grid.style.gridTemplateColumns, 'week grid should add the week-number column').toBe('repeat(8, 1fr)');
      });

      it('should render 6 week-number cells with ident testids when showWeeks is set', async () => {
        // Arrange: Grid content is only built while the panel is shown, so the cells are built
        // for a real viewed month here. The empty-cell day list (direct `calendarCells` reads
        // before any open) still must not crash the week-number pass - the guard in
        // `calcCalendarCells` covers that; this test pins the rendered result.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ showWeeks: true });
          await openPanel(created);
          return created;
        });

        // Assert: Six week cells (one per row) render with ident-based testids and the week
        // numbers of the January 2026 rows (1 - 6 under the component's week algorithm);
        // day cells keep their own testids, so the lookup helper still finds them.
        const weekCells = fixture.nativeElement.querySelectorAll('.week-num');
        expect(weekCells.length, 'six rows should render six week-number cells').toBe(6);
        expect([...weekCells].map((cell) => cell.textContent?.trim()), 'week numbers should follow the viewed month').toEqual(['1', '2', '3', '4', '5', '6']);
        expect(fixture.nativeElement.querySelector('[data-testid="test-date_w3"]'), 'week testid should follow the ident pattern').not.toBeNull();
        expect(fixture.nativeElement.querySelectorAll('.day').length, 'day cells should not be displaced by week cells').toBe(42);
        expect(findCell(fixture, 2026, 0, 15), 'day lookup should work despite week cells shifting indexes').not.toBeNull();
      });

      it('should render weekday headers from dayOfWeek translation keys', async () => {
        // Arrange: Create component (no translations registered, keys render) and open it.
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);
        const weekdays = [...fixture.nativeElement.querySelectorAll('.weekday')] as HTMLElement[];

        // Assert: Seven headers in Monday-first order, exposed as the grid's column headers -
        // the day cells' aria-label carries only year/month/day, so the weekday context comes
        // from these cells (they must stay in the ARIA grid -> row -> cell hierarchy).
        expect(weekdays.length, 'should render seven weekday headers').toBe(7);
        expect(weekdays[0].textContent, 'first header should be the monday key').toContain('dateTimePicker.dayOfWeek.mon');
        expect(weekdays[6].textContent, 'last header should be the sunday key').toContain('dateTimePicker.dayOfWeek.sun');
        expect(weekdays.every((header) => header.getAttribute('role') === 'columnheader'), 'weekday headers should be columnheader cells').toBe(true);
        expect(weekdays.every((header) => header.parentElement?.getAttribute('role') === 'row'), 'column headers should sit in the header row').toBe(true);
      });
    });

    describe('open/close&selection', () => {
      it('should open panel on click', async () => {
        // Arrange: Create component with closed panel.
        const fixture = await arrangeDatePicker();
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should start closed').toBe(false);

        // Act: Click the input.
        await openPanel(fixture);

        // Assert: Panel is open, visible and reported to assistive technology.
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should be open after click').toBe(true);
        expect(getPanel(fixture).style.display, 'panel should be visible when open').not.toBe('none');
        expect(getInput(fixture).getAttribute('aria-expanded'), 'aria-expanded should be true when open').toBe('true');
      });

      it('should close panel on second click', async () => {
        // Arrange: Create component and open the panel.
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should be open before second click').toBe(true);

        // Act: Click the input again.
        await closePanel(fixture);

        // Assert: Panel is closed again.
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should be closed after second click').toBe(false);
        expect(getPanel(fixture).style.display, 'panel should be hidden when closed').toBe('none');
        expect(getInput(fixture).getAttribute('aria-expanded'), 'aria-expanded should be false when closed').toBe('false');
      });

      it('should seed keyboard focus state when panel opens on focus', async () => {
        // Arrange: Create component and focus the input (e.g. via Tab) under a clock mocked to
        // 15 January 2026, so the seeded cursor date is deterministic.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ value: null });
          getInput(created).focus();
          // The open awaits `forRender`, so one flush round may not cover it yet.
          created.detectChanges();
          await created.whenStable();
          created.detectChanges();
          await created.whenStable();
          created.detectChanges();
          return created;
        });

        // Assert: Focus-open seeds the keyboard cursor and the grid announces it.
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should open on focus').toBe(true);
        const focused = fixture.componentInstance.focusedDate();
        expect(focused, 'focus-open should seed the keyboard cursor').not.toBeNull();
        expect(focused?.toISOString().slice(0, 10), 'focus-open should seed the cursor on the current date').toBe('2026-01-15');
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        const focusedCell = fixture.nativeElement.querySelector('.day.focused');
        expect(grid.getAttribute('aria-activedescendant'), 'grid should announce the seeded cursor cell').not.toBeNull();
        expect(grid.getAttribute('aria-activedescendant'), 'activedescendant should reference the cell carrying the focus ring').toBe(focusedCell.id);
      });

      it('should seed keyboard focus state when panel opens on click', async () => {
        // Arrange: Create component and open it under a clock mocked to 15 January 2026.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ value: null });
          await openPanel(created);
          return created;
        });

        // Assert: Mouse-open seeds the keyboard cursor too - a keyboard user picking up right
        // after the click must land on the shown day, and the grid must announce it.
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should open on click').toBe(true);
        const focused = fixture.componentInstance.focusedDate();
        expect(focused, 'click-open should seed the keyboard cursor').not.toBeNull();
        expect(focused?.toISOString().slice(0, 10), 'click-open should seed the cursor on the current date').toBe('2026-01-15');
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        const focusedCell = fixture.nativeElement.querySelector('.day.focused');
        expect(grid.getAttribute('aria-activedescendant'), 'activedescendant should reference the cell carrying the focus ring').toBe(focusedCell.id);
      });

      it('should move DOM focus into the calendar grid when the panel opens', async () => {
        // Arrange: The open path promises that focus moves into the calendar grid, so a keyboard
        // user lands there (with the grid announcing the seeded cursor via aria-activedescendant)
        // instead of being left on the input. The grid (tabindex=0) must receive DOM focus on open.
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);

        // Assert: DOM focus sits on the grid, ready for arrow navigation.
        expect(document.activeElement, 'focus should move into the calendar grid when the panel opens')
          .toBe(fixture.componentInstance.calendarGridRef().nativeElement);
      });

      it('should open exactly once on real mousedown-focus-click flow', async () => {
        // Arrange: Create component, simulate mousedown so component marks focus as click-caused.
        const fixture = await arrangeDatePicker();
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
        expect(fixture.componentInstance.isCalendarVisible(), 'real click flow should open panel exactly once').toBe(true);
      });

      it('should keep auto-open on focus after mousedown on already-focused input', async () => {
        // Arrange: Create component with input focused (focus-open suppressed) and panel closed.
        const fixture = await arrangeDatePicker();
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
        expect(fixture.componentInstance.isCalendarVisible(), 'auto-open should work after mousedown on focused input').toBe(true);
      });

      it('should close panel and reset keyboard focus on Escape from input', async () => {
        // Arrange: Create component and open the panel, then move real focus to the input so the
        // keydown lands there.
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);
        const input = getInput(fixture);
        input.focus();
        fixture.detectChanges();

        // Act: Press Escape while the input is focused.
        const user = userEvent.setup();
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel closes; the keyboard cursor must reset on close, otherwise the next open
        // starts from a stale date and the aria-activedescendant of the closed grid keeps
        // pointing at a hidden cell.
        expect(fixture.componentInstance.isCalendarVisible(), 'Escape should close the panel').toBe(false);
        expect(fixture.componentInstance.focusedDate(), 'Escape should reset the keyboard cursor').toBeNull();
      });

      it('should commit the picked date on first click, close panel and refocus input', async () => {
        // Arrange: Create component with empty value, opened at 15 January 2026, and spy on touch.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null });
          const touchSpy = vi.fn();
          fixture.componentInstance.touch.subscribe(touchSpy);
          await openPanel(fixture);

          // Act: Click day 20 - unlike the two-step clock, the calendar commits on the first pick.
          const day20 = findCell(fixture, 2026, 0, 20);
          expect(day20, 'precondition: 20 January should be on the opened grid').not.toBeNull();
          day20?.click();
          fixture.detectChanges();

          // Assert: Value committed as a midnight UTC date, input mirrors it, panel closed and
          // focus returned to the input INTERNALLY, so no touch is reported.
          expect(fixture.componentInstance.value()?.toISOString(), 'value should contain the picked day at midnight UTC').toBe('2026-01-20T00:00:00.000Z');
          expect(getInput(fixture).value, 'input should display the picked date').toBe('2026-01-20');
          expect(fixture.componentInstance.isCalendarVisible(), 'panel should close after the pick').toBe(false);
          expect(document.activeElement, 'focus should return to input after the pick').toBe(getInput(fixture));
          expect(touchSpy, 'internal refocus should not emit touch').not.toHaveBeenCalled();
        });
      });

      it('should preserve the time of day when picking a new date on a value with time', async () => {
        // Arrange: Value carries 14:30:47.123 loaded from outside - a pick must move the DATE
        // only and inherit that existing time of day, never fall back to midnight.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15, 14, 30, 47, 123) });
          await openPanel(fixture);

          // Act: Pick another day.
          const day20 = findCell(fixture, 2026, 0, 20);
          expect(day20, 'precondition: 20 January should be on the opened grid').not.toBeNull();
          day20?.click();
          fixture.detectChanges();

          // Assert: The pick moves the DATE only - time of day must survive untouched.
          const picked = fixture.componentInstance.value();
          expect(picked?.toISOString().slice(0, 10), 'picked day should be 20 January').toBe('2026-01-20');
          expect(picked?.getUTCHours(), 'picking a new day must keep the value\u2019s hour').toBe(14);
          expect(picked?.getUTCMinutes(), 'picking a new day must keep the value\u2019s minute').toBe(30);
          expect(picked?.getUTCSeconds(), 'picking a new day must keep the value\u2019s second').toBe(47);
          expect(picked?.getUTCMilliseconds(), 'picking a new day must keep the value\u2019s millisecond').toBe(123);
        });
      });

      it('should keep value and panel when the selected day is clicked again with canNull false', async () => {
        // Arrange: Component with an externally loaded value whose day is already selected.
        // With canNull false, re-clicking that day must be a blocked deselect: the value stays
        // identical and the panel stays open for another pick.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15, 14, 30), canNull: false });
          const before = fixture.componentInstance.value();
          await openPanel(fixture);

          // Act: Click the value's own day.
          const day15 = findCell(fixture, 2026, 0, 15);
          expect(day15, 'precondition: 15 January should be on the opened grid').not.toBeNull();
          day15?.click();
          fixture.detectChanges();

          // Assert: A re-click on the selected day with deselect disabled must be a no-op.
          expect(fixture.componentInstance.value(), 're-clicking the selected day must not rewrite the value').toBe(before);
          expect(fixture.componentInstance.isCalendarVisible(), 'a blocked deselect must keep the panel open for another pick').toBe(true);
        });
      });

      it('should clear value when the selected day is clicked again with canNull true', async () => {
        // Arrange: Component with an externally loaded value; clicking that value's own day must
        // DETECT the same day and deselect it (canNull is true) instead of treating it as a new
        // pick.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15), canNull: true });
          await openPanel(fixture);

          // Act: Click the value's own day.
          const day15 = findCell(fixture, 2026, 0, 15);
          expect(day15, 'precondition: 15 January should be on the opened grid').not.toBeNull();
          day15?.click();
          fixture.detectChanges();

          // Assert: The deselect clears the value and closes the panel.
          expect(fixture.componentInstance.value(), 'deselecting the selected day must clear the value').toBeNull();
          expect(getInput(fixture).value, 'input should be empty after deselect').toBe('');
          expect(fixture.componentInstance.isCalendarVisible(), 'panel should close after the deselect').toBe(false);
          expect(document.activeElement, 'focus should return to input after the deselect').toBe(getInput(fixture));
        });
      });

      it('should deselect the picked day on re-click within a session when canNull', async () => {
        // Arrange: Create deselectable component with empty value, opened at 15 January 2026,
        // and spy on touch output.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null, canNull: true });
          const touchSpy = vi.fn();
          fixture.componentInstance.touch.subscribe(touchSpy);

          // Act: Pick day 20 in the first session...
          await openPanel(fixture);
          findCell(fixture, 2026, 0, 20)?.click();
          fixture.detectChanges();
          expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'precondition: first session should commit 20 January').toBe('2026-01-20');

          // Act: ...then reopen (the view follows the picked day) and re-click the same day.
          await openPanel(fixture);
          const day20 = findCell(fixture, 2026, 0, 20);
          expect(day20, 'precondition: reopened grid should show 20 January').not.toBeNull();
          day20?.click();
          fixture.detectChanges();

          // Assert: The re-click discards the in-session pick - value cleared, panel closed,
          // focus back on the input internally, so no touch is reported.
          expect(fixture.componentInstance.value(), 're-clicking the picked day with canNull should clear the value').toBeNull();
          expect(fixture.componentInstance.isCalendarVisible(), 'panel should close after the deselect').toBe(false);
          expect(document.activeElement, 'focus should return to input after the deselect').toBe(getInput(fixture));
          expect(touchSpy, 'internal refocus should not emit touch').not.toHaveBeenCalled();
        });
      });

      it('should move keyboard cursor to the day pressed with mouse before the click lands', async () => {
        // Arrange: Component opened at 15 January 2026, so the cursor is seeded there. The
        // browser paints between mousedown and click, so the focus ring must already jump to the
        // PRESSED day before the click commits it - otherwise the ring flashes on the stale
        // seeded day while the button is held.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null });
          await openPanel(fixture);
          const day10 = findCell(fixture, 2026, 0, 10);
          expect(day10, 'precondition: 10 January should be on the opened grid').not.toBeNull();

          // Act: Dispatch mousedown only (no click).
          day10?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          fixture.detectChanges();

          // Assert: Cursor, aria-activedescendant and focus ring all follow the pressed day.
          expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'mousedown should move the keyboard cursor to the pressed day').toBe('2026-01-10');
          const grid = fixture.nativeElement.querySelector('.calendar-grid');
          expect(grid.getAttribute('aria-activedescendant'), 'activedescendant should reference the pressed day').toBe(day10?.id);
          expect(day10?.classList.contains('focused'), 'pressed day should carry the focus ring').toBe(true);
          expect(fixture.nativeElement.querySelector('.day.focused'), 'exactly the pressed day should carry the focus ring').toBe(day10);
        });
      });

      it('should prevent default on mousedown on a header navigation button', async () => {
        // Arrange: Create component and open the panel.
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);
        const headerButton = fixture.nativeElement.querySelector('[data-testid="test-date_monthPlus"]');

        // Act: Dispatch a real cancelable mousedown on the month-forward button.
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        headerButton.dispatchEvent(event);

        // Assert: The button chrome is not focusable - cancelled default keeps focus where it
        // was instead of parking it on <body> (which would close the panel as a leaving blur).
        expect(event.defaultPrevented, 'mousedown on header navigation button should be default-prevented').toBe(true);
      });

      it('should ignore day selection when disabled', async () => {
        // Arrange: Create component with value, open it so the cell model is built, then disable
        // it (the disabling effect closes the panel, which unmounts the grid content - so, unlike
        // before, there is no hidden cell left to click). The disabled guard is therefore driven
        // through the cell's pick handler directly, same precedent as `handleClick` below: the
        // browser cannot deliver an event to something that is not rendered.
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15) });
        await openPanel(fixture);
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const before = fixture.componentInstance.value();

        // Act: Pick 10 January through the handler the cell click would call.
        const cell = fixture.componentInstance.calendarCells().find(
          (candidate) => candidate.type === EnCalendarCellType.Date && candidate.year === 2026 && candidate.month === 0 && candidate.day === 10,
        );
        expect(cell, 'precondition: 10 January should be in the built cell model').toBeDefined();
        fixture.componentInstance.selectCell(cell!);
        fixture.detectChanges();

        // Assert: Value is untouched by the disabled pick.
        expect(fixture.componentInstance.value(), 'disabled component should not change value').toBe(before);
        expect(fixture.componentInstance.isCalendarVisible(), 'disabled component should stay closed').toBe(false);
      });

      it('should not open panel on click when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeDatePicker({ disabled: true });

        // Act: Click the input, then call the click handler directly
        // (browsers do not deliver clicks to disabled inputs, so guard is checked directly too).
        getInput(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.componentInstance.handleClick();

        // Assert: Panel stays closed.
        expect(fixture.componentInstance.isCalendarVisible(), 'disabled component should not open on click').toBe(false);
      });

      it('should ignore input keyboard events when disabled', async () => {
        // Arrange: Create disabled but deselectable component carrying a value (so a failed
        // disabled guard would actually clear it and fail the assertion).
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15), canNull: true, disabled: true });

        // Act: Dispatch keydown directly (disabled inputs are not focusable for real keystrokes).
        getInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        getInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        getInput(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Panel stays closed and the clear key is ignored too.
        expect(fixture.componentInstance.isCalendarVisible(), 'disabled component should not open via keyboard').toBe(false);
        expect(fixture.componentInstance.value(), 'disabled component should not clear its value via Backspace').not.toBeNull();
      });

      it('should ignore grid keyboard events when disabled', async () => {
        // Arrange: Create disabled but deselectable component with a seeded keyboard cursor
        // (canNull enabled so the disabled guard - not canNull - is the only reason nothing moves).
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 10), canNull: true, disabled: true });
        fixture.componentInstance.focusedDate.set(utcDate(2026, 0, 15));
        const before = fixture.componentInstance.value();

        // Act: Dispatch keydown directly on the grid (it stays in the DOM, hidden).
        const grid = fixture.componentInstance.calendarGridRef().nativeElement;
        grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
        grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Cursor, viewed month and value are all untouched.
        expect(fixture.componentInstance.focusedDate(), 'disabled component should not move the keyboard cursor').toEqual(utcDate(2026, 0, 15));
        expect(fixture.componentInstance.value(), 'disabled component should not change its value').toBe(before);
        expect(fixture.componentInstance.isCalendarVisible(), 'disabled component should stay closed').toBe(false);
      });

      it('should not emit touch when hidePanelAndRefocus returns focus to the input', async () => {
        // Arrange: Create component and open panel.
        const fixture = await arrangeDatePicker();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        await openPanel(fixture);

        // Act: Close through the shared refocus helper (the Escape-from-grid and pick paths).
        fixture.componentInstance.hidePanelAndRefocus();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Focus stayed inside the component, so no touch is reported.
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should close').toBe(false);
        expect(document.activeElement, 'helper should refocus the input').toBe(getInput(fixture));
        expect(touchSpy, 'internal refocus should not emit touch').not.toHaveBeenCalled();
      });

      registerSubPickerCoreTests(subPickerDriver);
    });

    describe('positioning', () => {
      /** Driver wiring the shared positioning suite to DatePicker. */
      const positioningDriver: PositioningDriver = {
        popup: 'panel',
        subject: 'input',
        fittedRight: 'auto',
        fittedPhrase: 'stay left-aligned when it fits horizontally',
        arrange: async () => {
          const fixture = await arrangeDatePicker();
          return {
            popup: () => getPanel(fixture),
            open: () => openPanel(fixture),
            close: () => closePanel(fixture),
            stubAnchor: (top) => {
              const anchor = fixture.nativeElement.querySelector('.picker-date');
              vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
            },
          };
        },
      };

      registerPositioningTests(positioningDriver);
    });

    describe('invalid value', () => {
      /** Date the parser rejects: every UTC accessor on it returns NaN. */
      const invalidDate = new Date('not-a-date');

      it('should show empty value instead of NaN when value is an invalid Date', async () => {
        // Arrange: Create component fed an invalid Date (e.g. parsed from garbage input).
        const fixture = await arrangeDatePicker({ value: invalidDate });

        // Assert: Input stays empty so the placeholder shows - no NaN leaks into the field.
        expect(getInput(fixture).value, 'input must not show NaN for an invalid Date').toBe('');
      });

      it('should seed keyboard cursor from current date when value is an invalid Date', async () => {
        // Arrange: Create component fed an invalid Date and open the panel.
        const fixture = await arrangeDatePicker({ value: invalidDate });
        await openPanel(fixture);

        // Assert: Cursor lands on a real rendered day (the current date), never on a NaN index.
        const focused = fixture.componentInstance.focusedDate();
        expect(focused, 'cursor should be seeded despite the corrupt value').not.toBeNull();
        expect(Number.isNaN(focused!.getTime()), 'cursor must not be an Invalid Date').toBe(false);
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        const focusedCell = fixture.nativeElement.querySelector('.day.focused');
        expect(grid.getAttribute('aria-activedescendant'), 'activedescendant must reference the highlighted current day').toBe(focusedCell.id);
      });

      it('should heal an invalid value when a day pick commits', async () => {
        // Arrange: Create component fed an invalid Date, opened at 15 January 2026.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: invalidDate });
          await openPanel(fixture);

          // Act: Click day 20 - the pick commits on the first click.
          const day20 = findCell(fixture, 2026, 0, 20);
          expect(day20, 'precondition: 20 January should be on the opened grid').not.toBeNull();
          day20?.click();
          fixture.detectChanges();

          // Assert: The corrupt value is replaced with a valid Date carrying the picked day.
          const healed = fixture.componentInstance.value();
          expect(healed !== null && !Number.isNaN(healed.getTime()), 'value must become a valid Date once a day is picked').toBe(true);
          expect(healed?.toISOString(), 'healed value must carry the picked day at midnight UTC').toBe('2026-01-20T00:00:00.000Z');
        });
      });

      it('should clear an invalid value with Backspace from the input when canNull', async () => {
        // Arrange: Component fed an invalid Date (a non-null corrupt value), deselectable,
        // input focused with panel closed; touch must stay silent.
        const user = userEvent.setup();
        const fixture = await arrangeDatePicker({ value: invalidDate, canNull: true });
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
        expect(fixture.componentInstance.isCalendarVisible(), 'clearing from the input should keep the panel closed').toBe(false);
        expect(document.activeElement, 'focus should stay on the input').toBe(input);
        expect(touchSpy, 'clearing without focus movement should not emit touch').not.toHaveBeenCalled();
      });

      it('should clear an invalid value with Delete from the calendar grid and close the panel when canNull', async () => {
        // Arrange: The input clears the value on Delete/Backspace, and the open grid is where
        // the keyboard actually sits, so the grid must offer the same clear. Dispatched directly
        // on the grid so the key lands on the grid's own keydown handler.
        const fixture = await arrangeDatePicker({ value: invalidDate, canNull: true });
        await openPanel(fixture);

        // Act: Press Delete on the grid.
        fixture.componentInstance.calendarGridRef().nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Corrupt value cleared, completing exactly like a normal clear - panel closes
        // and focus returns to the input internally.
        expect(fixture.componentInstance.value(), 'Delete with canNull must clear an invalid value').toBeNull();
        expect(fixture.componentInstance.isCalendarVisible(), 'clearing should complete the interaction and close the panel').toBe(false);
        expect(document.activeElement, 'focus should return to the input').toBe(getInput(fixture));
      });
    });
  });

  describe('i18n', () => {
    it('should update placeholder, labels and calendar text on language switch', async () => {
      // Arrange: Create component with English translations registered before creation.
      const fixture = await arrangeDatePicker({
        value: null,
        translations: {
          dateTimePicker: {
            placeholder: { date: 'yyyy-mm-dd' },
            date: 'Date',
            datePicker: 'Date picker',
            month: { 0: 'January' },
            dayOfWeek: { mon: 'Mon' },
            yearMinus: 'Previous year',
            monthMinus: 'Previous month',
            monthPlus: 'Next month',
            yearPlus: 'Next year',
          },
        },
      });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('pl', {
        dateTimePicker: {
          placeholder: { date: 'rrrr-mm-dd' },
          date: 'Data',
          datePicker: 'Wybór daty',
          month: { 0: 'Styczeń' },
          dayOfWeek: { mon: 'pon' },
          yearMinus: 'Poprzedni rok',
          monthMinus: 'Poprzedni miesiąc',
          monthPlus: 'Następny miesiąc',
          yearPlus: 'Następny rok',
        },
      });
      expect(getInput(fixture).getAttribute('placeholder'), 'precondition: placeholder should show English text').toBe('yyyy-mm-dd');

      // Act: Open the calendar at a mocked 15 January 2026 so the header shows a known month,
      // then activate Polish while the component is alive.
      await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
        await openPanel(fixture);
      });
      expect(fixture.nativeElement.querySelector('.header-title').textContent?.trim(), 'precondition: header should show English month').toBe('2026 January');
      expect(getNavButton(fixture, 'monthPlus').getAttribute('aria-label'), 'precondition: nav button should carry the English label').toBe('Next month');
      await firstValueFrom(translateService.use('pl'));
      await fixture.whenStable();
      fixture.detectChanges();

      // Assert: Placeholder follows the language; the precomputed labels (input fallback, dialog
      // name, header month, weekday, nav buttons) prove they all update together.
      expect(getInput(fixture).getAttribute('placeholder'), 'placeholder should switch to Polish text').toBe('rrrr-mm-dd');
      expect(getInput(fixture).getAttribute('aria-label'), 'input fallback should switch to Polish text').toBe('Data');
      expect(getPanel(fixture).getAttribute('aria-label'), 'dialog label should switch to Polish text').toBe('Wybór daty');
      expect(fixture.nativeElement.querySelector('.header-title').textContent?.trim(), 'header month should switch to Polish text').toBe('2026 Styczeń');
      expect(fixture.nativeElement.querySelector('.weekday').textContent, 'weekday header should switch to Polish text').toContain('pon');
      expect(getNavButton(fixture, 'yearMinus').getAttribute('aria-label'), 'previous-year button should switch to Polish text').toBe('Poprzedni rok');
      expect(getNavButton(fixture, 'monthMinus').getAttribute('aria-label'), 'previous-month button should switch to Polish text').toBe('Poprzedni miesiąc');
      expect(getNavButton(fixture, 'monthPlus').getAttribute('aria-label'), 'next-month button should switch to Polish text').toBe('Następny miesiąc');
      expect(getNavButton(fixture, 'yearPlus').getAttribute('aria-label'), 'next-year button should switch to Polish text').toBe('Następny rok');
    });

    it('should update per-cell aria-labels on language switch', async () => {
      // Arrange: Create component with English month translation, open at a known date. Cell
      // names are precomputed into the cells now (no impure translate pipe in the template),
      // so this guards that they stay reactive to language switches anyway.
      const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
        const created = await arrangeDatePicker({ translations: { dateTimePicker: { month: { 0: 'January' } } } });
        await openPanel(created);
        return created;
      });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('pl', { dateTimePicker: { month: { 0: 'Styczeń' } } });
      expect(findCell(fixture, 2026, 0, 15)?.getAttribute('aria-label'), 'precondition: cell should be named with the English month').toBe('2026 January 15');

      // Act: Activate Polish while the component is alive and panel is open.
      await firstValueFrom(translateService.use('pl'));
      await fixture.whenStable();
      fixture.detectChanges();

      // Assert: The opened grid shows the month name in the new language.
      expect(findCell(fixture, 2026, 0, 15)?.getAttribute('aria-label'), 'cell aria-label should switch to Polish text').toBe('2026 Styczeń 15');
    });
  });

  describe('accessibility', () => {
    describe('aria', () => {
      it('should have combobox role and aria-haspopup dialog on input', async () => {
        // Arrange: Create component.
        const fixture = await arrangeDatePicker();
        const input = getInput(fixture);

        // Assert: Combobox semantics present; popup announced as dialog because aria-controls
        // references the role=dialog panel, not the grid directly.
        expect(input.getAttribute('role'), 'should have combobox role').toBe('combobox');
        expect(input.getAttribute('aria-haspopup'), 'should have dialog popup').toBe('dialog');
      });

      it('should link aria-controls to panel id', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeDatePicker({ ident: 'my-date' });

        // Assert: aria-controls matches panel element id.
        const input = fixture.nativeElement.querySelector('[data-testid="my-date_input"]');
        const panel = fixture.nativeElement.querySelector('[data-testid="my-date_panel"]');
        expect(input.getAttribute('aria-controls'), 'aria-controls should reference panel id').toBe('my-date_panel');
        expect(panel.getAttribute('id'), 'panel id should follow ident pattern').toBe('my-date_panel');
        expect(input.getAttribute('aria-controls'), 'aria-controls should equal actual panel id').toBe(panel.getAttribute('id'));
      });

      it('should have dialog role and no aria-modal on panel', async () => {
        // Arrange: Create component.
        const fixture = await arrangeDatePicker();
        const panel = getPanel(fixture);

        // Assert: Panel is a non-modal dialog - Tab intentionally leaves the component, so
        // claiming modality would tell AT the background is inert when it is not.
        expect(panel.getAttribute('role'), 'panel should have dialog role').toBe('dialog');
        expect(panel.hasAttribute('aria-modal'), 'panel should not claim to be modal').toBe(false);
      });

      it('should expose the header navigation controls as real non-tabbable buttons', async () => {
        // Arrange: Create component - the header only renders inside the panel markup, which is
        // always in the DOM (hidden via display:none), so no open is needed for the semantics.
        const fixture = await arrangeDatePicker();

        // Act: Read the four header controls back through their testids.
        const navButtons = (['yearMinus', 'monthMinus', 'monthPlus', 'yearPlus'] as const).map((name) =>
          getNavButton(fixture, name) as HTMLButtonElement,
        );

        // Assert: Native <button> gives them the button role (an aria-label on a role-less <div>
        // is a prohibited name on the generic role, so AT never exposed them as controls), while
        // tabindex="-1" keeps them out of the tab order - NavUtils.FocusNext/FocusPrev skip
        // button[tabindex="-1"], so the input -> grid -> next control hand-off must not change.
        expect(navButtons.every((button) => button.tagName === 'BUTTON'), 'every nav control should be a native button').toBe(true);
        expect(navButtons.every((button) => button.getAttribute('type') === 'button'), 'nav controls must never submit a form').toBe(true);
        expect(navButtons.every((button) => button.getAttribute('tabindex') === '-1'), 'nav controls must stay out of the tab order').toBe(true);
        expect(
          navButtons.every((button) => (button.getAttribute('aria-label') ?? '').length > 0),
          'every nav control should carry its accessible name',
        ).toBe(true);
      });

      it('should have grid role and tabindex on the calendar grid, silent before the panel opens', async () => {
        // Arrange: Create component with closed panel.
        const fixture = await arrangeDatePicker();
        const grid = fixture.nativeElement.querySelector('.calendar-grid');

        // Assert: While closed the grid carries tabindex=-1, keeping it out of focusable lists -
        // a hidden tab stop would poison programmatic traversal (NavUtils.FocusPrev/FocusNext
        // used by the neighbouring pickers' Tab handoff) by absorbing a step onto a
        // display:none element. Before the open seeds a cursor there is no active cell to announce.
        expect(grid.getAttribute('role'), 'calendar grid should have grid role').toBe('grid');
        expect(grid.getAttribute('tabindex'), 'closed grid must stay out of focusable lists').toBe('-1');
        expect(grid.hasAttribute('aria-activedescendant'), 'activedescendant must be absent before the cursor is seeded').toBe(false);

        // Act: Open the panel.
        await openPanel(fixture);

        // Assert: The open grid becomes the activedescendant-managed tab stop.
        expect(grid.getAttribute('tabindex'), 'open grid should be a tab stop').toBe('0');
      });

      it('should nest every cell in a role=row owned by the grid', async () => {
        // Arrange: Open the panel - rows only render while the grid has content.
        const fixture = await arrangeDatePicker();
        await openPanel(fixture);
        const grid = fixture.nativeElement.querySelector('.calendar-grid');

        // Act: Read the rendered row/cell hierarchy.
        const rows = [...grid.children].filter((child) => child.getAttribute('role') === 'row');
        const cells = [...grid.querySelectorAll('[role="gridcell"], [role="columnheader"]')] as HTMLElement[];

        // Assert: ARIA requires grid -> row -> gridcell/columnheader (the axe rules
        // aria-required-children and aria-required-parent run ENABLED in the e2e suite, so a
        // flat grid with cells hanging directly off role="grid" fails there).
        expect(rows.length, 'grid should own one weekday row plus six week rows').toBe(7);
        expect(cells.length, 'grid should hold 7 column headers plus 42 day cells').toBe(49);
        expect(
          cells.every((cell) => cell.parentElement?.getAttribute('role') === 'row'),
          'every cell must sit inside a role=row wrapper',
        ).toBe(true);
        expect(
          grid.querySelector('[role="gridcell"]')?.parentElement?.parentElement,
          'the row wrappers must be owned by the grid itself',
        ).toBe(grid);
      });

      it('should label the grid with the header text when open', async () => {
        // Arrange: Create component with month translations, opened at 15 January 2026.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ translations: { dateTimePicker: { month: { 0: 'January' } } } });
          await openPanel(created);
          return created;
        });

        // Assert: The grid announces the same text the visible header shows, so a screen reader
        // user hears which month the grid contains.
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        const header = fixture.nativeElement.querySelector('.header-title');
        expect(grid.getAttribute('aria-label'), 'grid should be labelled with the header text').toBe(header.textContent?.trim());
        expect(grid.getAttribute('aria-label'), 'grid label should name the viewed month').toBe('2026 January');
      });

      it('should set aria-activedescendant to the focused cell after keyboard open', async () => {
        // Arrange: Create component and focus the input without auto-open.
        const user = userEvent.setup();
        const fixture = await arrangeDatePicker();
        focusInputWithoutOpening(fixture);

        // Act: Open the panel via keyboard.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Keyboard open seeds the cursor and the grid references the exact cell that
        // carries the focus ring - the whole activedescendant contract.
        expect(fixture.componentInstance.focusedDate(), 'keyboard open should seed the keyboard cursor').not.toBeNull();
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        const focusedCell = fixture.nativeElement.querySelector('.day.focused');
        expect(focusedCell, 'seeded cursor cell should carry the focus ring').not.toBeNull();
        expect(grid.getAttribute('aria-activedescendant'), 'grid should reference the focused cell after keyboard open').toBe(focusedCell.id);
      });

      it('should set aria-selected only on the selected day', async () => {
        // Arrange: Pick day 20 in the first session (selection state lives in the component),
        // then reopen so the grid renders the pick.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null });
          await openPanel(fixture);
          findCell(fixture, 2026, 0, 20)?.click();
          fixture.detectChanges();
          await openPanel(fixture);

          // Assert: Only the picked day is announced as selected; neighbours are explicitly not.
          const picked = findCell(fixture, 2026, 0, 20);
          const neighbour = findCell(fixture, 2026, 0, 21);
          expect(picked, 'precondition: picked day should be on the reopened grid').not.toBeNull();
          expect(picked?.getAttribute('aria-selected'), 'picked day should be aria-selected').toBe('true');
          expect(neighbour?.getAttribute('aria-selected'), 'other day must not be aria-selected').toBe('false');
        });
      });

      it('should set aria-current on today\u2019s day mirroring the today class', async () => {
        // Arrange: Component opened at a mocked 15 January 2026 - assistive technology must be
        // able to hear which cell is today without scanning for a CSS class.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker();
          await openPanel(created);
          return created;
        });
        const root: HTMLElement = fixture.nativeElement;
        const currents = root.querySelectorAll('.day[aria-current]');

        // Assert: Exactly one day exposes aria-current="date" and it is the today-marked cell.
        expect(currents.length, 'exactly one day should expose aria-current').toBe(1);
        expect(currents[0].getAttribute('aria-current'), 'aria-current should use the date token').toBe('date');
        expect(currents[0], 'aria-current should sit on the today-marked cell').toBe(root.querySelector('.day.today'));
        expect(root.querySelector('[data-testid="test-date_14"]')?.hasAttribute('aria-current'), 'non-current day must not expose aria-current').toBe(false);
      });

      it('should never expose aria-current on week-number cells', async () => {
        // Arrange: Week numbers share the grid with day cells, so the today marker must never
        // leak onto a cell that does not carry a date.
        const fixture = await arrangeDatePicker({ showWeeks: true });
        await openPanel(fixture);
        const root: HTMLElement = fixture.nativeElement;

        // Assert: No week cell claims to be current, and every current cell is a day.
        expect(root.querySelectorAll('.week-num[aria-current]').length, 'week-number cells must not expose aria-current').toBe(0);
        expect(
          Array.from(root.querySelectorAll('[aria-current]')).every((element) => element.classList.contains('day')),
          'only day cells may expose aria-current',
        ).toBe(true);
      });

      it('should mark today with aria-current when today renders as an adjacent-month padding day', async () => {
        // Arrange: The grid views January 2026 (seeded from the value) while "today" is
        // 1 February 2026, so today lands in the trailing padding of the January grid.
        const fixture = await withMockedNow(utcDate(2026, 1, 1, 12), async () => {
          const created = await arrangeDatePicker({ value: utcDate(2026, 0, 20) });
          await openPanel(created);
          return created;
        });
        const root: HTMLElement = fixture.nativeElement;
        const paddingToday = findCell(fixture, 2026, 1, 1);

        // Assert: The cell really is an adjacent-month day, and ARIA mirrors the visual
        // `.today` mark wherever today renders, so assistive tech hears the same cell that
        // sighted users see highlighted.
        expect(paddingToday, 'precondition: 1 February 2026 should render as padding of January').not.toBeNull();
        expect(paddingToday?.classList.contains('not-current'), 'precondition: the cell must sit outside the viewed month').toBe(true);
        expect(paddingToday?.classList.contains('today'), 'padding cell should carry the today mark').toBe(true);
        expect(paddingToday?.getAttribute('aria-current'), 'padding cell should expose aria-current').toBe('date');
        expect(root.querySelectorAll('[aria-current]').length, 'exactly one cell should expose aria-current').toBe(1);
      });

      it('should set cell ids following the ident_cell pattern', async () => {
        // Arrange: Create component with custom ident and open the panel.
        const fixture = await arrangeDatePicker({ ident: 'my-date' });
        await openPanel(fixture);
        const cell = fixture.nativeElement.querySelector('[data-testid="my-date_10"]');

        // Assert: Cell id follows the pattern used by aria-activedescendant references.
        expect(cell.getAttribute('id'), 'cell id should follow the ident_cell pattern').toMatch(/^my-date_cell_\d+$/);
      });

      it('should name days with a full date aria-label and keep role gridcell', async () => {
        // Arrange: Create component with month translation, opened at 15 January 2026.
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ translations: { dateTimePicker: { month: { 0: 'January' } } } });
          await openPanel(created);
          return created;
        });

        // Assert: The cell's visible text is just the day number, so its accessible name must
        // carry the full date (a screen reader user tabbing the grid hears "2026 January 15").
        const cell = findCell(fixture, 2026, 0, 15);
        expect(cell, 'precondition: 15 January should be on the grid').not.toBeNull();
        expect(cell?.getAttribute('role'), 'day cell should have gridcell role').toBe('gridcell');
        expect(cell?.getAttribute('aria-label'), 'day cell should be named with its full date').toBe('2026 January 15');
        expect(cell?.textContent?.trim(), 'day cell should show the bare day number').toBe('15');
      });

      it('should set data-testid from ident on input and panel', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeDatePicker({ ident: 'my-date' });

        // Assert: Input and panel use ident-based testids.
        expect(fixture.nativeElement.querySelector('[data-testid="my-date_input"]'), 'input testid should follow ident pattern').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="my-date_panel"]'), 'panel testid should follow ident pattern').not.toBeNull();
      });

      it('should set aria-labelledby on input from label input', async () => {
        // Arrange: Create component with label reference.
        const fixture = await arrangeDatePicker({ label: 'my-label' });

        // Assert: Input is labelled by the given label reference.
        expect(getInput(fixture).getAttribute('aria-labelledby'), 'aria-labelledby should match label input').toBe('my-label');
      });

      it('should append the qualifier id to aria-labelledby when qualifyLabel is set', async () => {
        // Arrange: Create labelled component asking for the datetime-mode qualifier.
        const fixture = await arrangeDatePicker({ label: 'my-label', qualifyLabel: true });

        // Assert: Name is the label first (visible label stays a prefix) then the qualifier.
        expect(getInput(fixture).getAttribute('aria-labelledby'), 'aria-labelledby should list label then qualifier').toBe('my-label test-date_qualifier');
        expect(getInput(fixture).hasAttribute('aria-label'), 'labelled input must not carry an aria-label fallback').toBe(false);
      });

      it('should render the qualifier as a hidden element with translated text', async () => {
        // Arrange: Create qualified component with translations registered before creation.
        const fixture = await arrangeDatePicker({
          label: 'my-label',
          qualifyLabel: true,
          translations: { dateTimePicker: { date: 'Date' } },
        });

        // Assert: Qualifier exists, carries the translated sub-field name and is visually hidden.
        const qualifier = getQualifier(fixture);
        expect(qualifier, 'qualifier element should be rendered').not.toBeNull();
        expect(qualifier?.textContent?.trim(), 'qualifier should carry the translated date name').toBe('Date');
        expect(qualifier?.className, 'qualifier should use the visually hidden class').toBe('picker-name-qualifier');
      });

      it('should not render the qualifier when qualifyLabel is not set', async () => {
        // Arrange: Create labelled component without the qualifier flag.
        const fixture = await arrangeDatePicker({ label: 'my-label', qualifyLabel: false });

        // Assert: Single name source, no orphan qualifier element.
        expect(getInput(fixture).getAttribute('aria-labelledby'), 'aria-labelledby should stay a single id').toBe('my-label');
        expect(getQualifier(fixture), 'qualifier must not render without qualifyLabel').toBeNull();
      });

      it('should not render the qualifier or aria-labelledby when label is empty even with qualifyLabel set', async () => {
        // Arrange: Create component qualified but without a label reference.
        const fixture = await arrangeDatePicker({ label: '', qualifyLabel: true });

        // Assert: Input falls back to aria-label; an orphan qualifier id would be unreferenced.
        expect(getInput(fixture).hasAttribute('aria-labelledby'), 'aria-labelledby must be absent without label').toBe(false);
        expect(getInput(fixture).getAttribute('aria-label'), 'input should fall back to the dedicated date key').toBe('dateTimePicker.date');
        expect(getQualifier(fixture), 'qualifier must not render without label').toBeNull();
      });

      it('should not set aria-labelledby when label is empty', async () => {
        // Arrange: Create component without label reference.
        const fixture = await arrangeDatePicker({ label: '' });

        // Assert: aria-labelledby is absent.
        expect(getInput(fixture).hasAttribute('aria-labelledby'), 'aria-labelledby should be absent without label').toBe(false);
      });

      it('should set aria-label fallback on input when no label is given', async () => {
        // Arrange: Create component without label reference (no translations registered, so the
        // translation key is rendered).
        const fixture = await arrangeDatePicker({ label: '' });

        // Assert: Input is named by the dedicated fallback key, not by the placeholder.
        expect(getInput(fixture).getAttribute('aria-label'), 'input should fall back to the dedicated date key').toBe('dateTimePicker.date');
      });

      it('should use translated aria-label fallback when translations are provided', async () => {
        // Arrange: Create component with translations registered before creation.
        const fixture = await arrangeDatePicker({
          label: '',
          translations: { dateTimePicker: { date: 'Date' } },
        });

        // Assert: Fallback name is resolved via translation.
        expect(getInput(fixture).getAttribute('aria-label'), 'input fallback should be translated').toBe('Date');
      });

      it('should not set aria-label on input when label is given', async () => {
        // Arrange: Create component with label reference.
        const fixture = await arrangeDatePicker({ label: 'my-label' });

        // Assert: aria-labelledby is the only name source - an aria-label would shadow a native
        // <label for> (accname gives aria-label precedence over native labelling).
        expect(getInput(fixture).hasAttribute('aria-label'), 'aria-label must be absent when a label is given').toBe(false);
        expect(getInput(fixture).getAttribute('aria-labelledby'), 'aria-labelledby should still name the input').toBe('my-label');
      });

      it('should warn in dev mode when the label id matches no element', async () => {
        // Arrange: Spy on console.warn; label reference deliberately left dangling.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          // Act: Create the component - its dev-only effect checks the reference on first CD.
          await arrangeDatePicker({ label: 'ghost-label', resolveLabel: false });

          // Assert: The dangling id is reported, naming this component.
          const messages = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
          expect(messages, 'dangling label id should be reported in dev mode').toContain('ghost-label');
          expect(messages, 'warning should name the emitting component').toContain('[date-picker]');
        } finally { // cleanup
          warnSpy.mockRestore();
        }
      });

      it('should not warn when the label id resolves to an element', async () => {
        // Arrange: Spy on console.warn; arrange creates the referenced label element.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          // Act: Create the component - its dev-only effect checks the reference on first CD.
          await arrangeDatePicker({ label: 'my-label' });

          // Assert: Resolvable reference is not a defect.
          const messages = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
          expect(messages, 'resolvable label id must not warn').not.toContain('[date-picker]');
        } finally { // cleanup
          warnSpy.mockRestore();
        }
      });

      it('should label the dialog with a dedicated key instead of the placeholder', async () => {
        // Arrange: Create component (no translations registered, so keys are rendered).
        const fixture = await arrangeDatePicker();
        const panel = getPanel(fixture);

        // Assert: Dialog is named by its own key - the placeholder is a format hint.
        expect(panel.getAttribute('aria-label'), 'dialog should use the dedicated datePicker key').toBe('dateTimePicker.datePicker');
        expect(panel.getAttribute('aria-label'), 'dialog must not be named after the placeholder key').not.toBe('dateTimePicker.placeholder.date');
      });

      it('should set aria-required on input from required input', async () => {
        // Arrange: Create required component.
        const fixture = await arrangeDatePicker({ required: true });

        // Assert: aria-required reports required state.
        expect(getInput(fixture).getAttribute('aria-required'), 'aria-required should be true when required').toBe('true');
      });

      it('should not set aria-required when required is false', async () => {
        // Arrange: Create component without required.
        const fixture = await arrangeDatePicker({ required: false });

        // Assert: aria-required is absent.
        expect(getInput(fixture).hasAttribute('aria-required'), 'aria-required should be absent when not required').toBe(false);
      });

      it('should mark days outside dateMin/dateMax as aria-disabled and ignore their clicks', async () => {
        // Arrange: Create component bounded to 10-20 January, opened at 15 January 2026.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null, dateMin: utcDate(2026, 0, 10), dateMax: utcDate(2026, 0, 20) });
          await openPanel(fixture);

          // Assert: Out-of-range days are marked disabled for AT and styling; boundary days
          // (min/max themselves) stay pickable.
          const before = fixture.nativeElement.querySelector('[data-testid="test-date_5"]');
          const minBoundary = findCell(fixture, 2026, 0, 10);
          const inRange = findCell(fixture, 2026, 0, 15);
          const after = findCell(fixture, 2026, 0, 25);
          expect(before.getAttribute('aria-disabled'), 'day before dateMin should be aria-disabled').toBe('true');
          expect(before.classList.contains('disabled'), 'day before dateMin should carry the disabled class').toBe(true);
          expect(minBoundary?.hasAttribute('aria-disabled'), 'dateMin boundary day must stay pickable').toBe(false);
          expect(inRange?.hasAttribute('aria-disabled'), 'in-range day must stay pickable').toBe(false);
          expect(after?.getAttribute('aria-disabled'), 'day after dateMax should be aria-disabled').toBe('true');

          // Act: Click both out-of-range days (the guards are checked through events).
          before.click();
          after?.click();
          fixture.detectChanges();

          // Assert: Disabled days neither write the value nor close the panel; a valid pick
          // still works.
          expect(fixture.componentInstance.value(), 'out-of-range clicks must not write the value').toBeNull();
          expect(fixture.componentInstance.isCalendarVisible(), 'out-of-range clicks must keep the panel open').toBe(true);
          inRange?.click();
          fixture.detectChanges();
          expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'an in-range day should still commit').toBe('2026-01-15');
        });
      });

      it('should treat dateMin as the local calendar day so dateMin = new Date() keeps its own day pickable', async () => {
        // Arrange: Clock pinned to 15 January 2026 midday, dateMin passed as "now" the way a
        // consumer would pass it. The bound's time-of-day must not shift the boundary day.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null, dateMin: new Date() });
          await openPanel(fixture);

          // Assert: The bound resolves to its calendar day (15 January): the day before stays
          // disabled, the min day itself stays pickable.
          const yesterday = findCell(fixture, 2026, 0, 14);
          const today = findCell(fixture, 2026, 0, 15);
          expect(yesterday?.getAttribute('aria-disabled'), 'day before the min day should be aria-disabled').toBe('true');
          expect(today?.hasAttribute('aria-disabled'), 'dateMin = new Date() must keep its own day pickable').toBe(false);

          // Act: Click the min day itself.
          today?.click();
          fixture.detectChanges();

          // Assert: The boundary day commits.
          expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'the min day itself should commit').toBe('2026-01-15');
        });
      });

      it('should treat dateMax as the local calendar day so dateMax = new Date() keeps its own day pickable', async () => {
        // Arrange: Clock pinned to 15 January 2026 midday, dateMax passed as "now".
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const fixture = await arrangeDatePicker({ value: null, dateMax: new Date() });
          await openPanel(fixture);

          // Assert: The bound resolves to its calendar day (15 January): its own day stays
          // pickable, the next day becomes disabled.
          const today = findCell(fixture, 2026, 0, 15);
          const tomorrow = findCell(fixture, 2026, 0, 16);
          expect(today?.hasAttribute('aria-disabled'), 'dateMax = new Date() must keep its own day pickable').toBe(false);
          expect(tomorrow?.getAttribute('aria-disabled'), 'day after the max day should be aria-disabled').toBe('true');

          // Act: Click the max day itself.
          today?.click();
          fixture.detectChanges();

          // Assert: The boundary day commits.
          expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'the max day itself should commit').toBe('2026-01-15');
        });
      });

      it('should keep the local today pickable under dateMax = new Date() right after local midnight', async () => {
        // Arrange: Clock at 15 January 2026, 00:30 Warsaw time - the local calendar day is
        // 15 January while the UTC date is still 14 January, so the raw timestamp of
        // "dateMax = new Date()" sits BEFORE today's cell (15 January 00:00 UTC).
        await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
          const fixture = await arrangeDatePicker({ value: null, dateMax: new Date() });
          await openPanel(fixture);

          // Assert: The local today is the last pickable day - the timestamp's UTC date
          // (14 January) must not become the boundary.
          const today = findCell(fixture, 2026, 0, 15);
          const tomorrow = findCell(fixture, 2026, 0, 16);
          expect(today?.hasAttribute('aria-disabled'), 'local today must stay pickable when dateMax = new Date() right after local midnight').toBe(false);
          expect(tomorrow?.getAttribute('aria-disabled'), 'the day after local today should be aria-disabled').toBe('true');

          // Act: Click the local today.
          today?.click();
          fixture.detectChanges();

          // Assert: The local today commits.
          expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'the local today should commit').toBe('2026-01-15');
        });
      });

      it('should bound the next day when dateMax is an end-of-day local timestamp', async () => {
        // Arrange: dateMax built the way consumers build it - end of the local day of
        // 15 January 2026 (23:59:59.999 local), not a UTC-midnight date.
        await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const now = new Date();
          const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          const fixture = await arrangeDatePicker({ value: null, dateMax: endOfToday });
          await openPanel(fixture);

          // Assert: The bound resolves to its local calendar day: 15 January pickable,
          // 16 January disabled.
          const today = findCell(fixture, 2026, 0, 15);
          const tomorrow = findCell(fixture, 2026, 0, 16);
          expect(today?.hasAttribute('aria-disabled'), 'the end-of-day max must keep its own day pickable').toBe(false);
          expect(tomorrow?.getAttribute('aria-disabled'), 'the day after an end-of-day local max should be aria-disabled').toBe('true');
        });
      });

      it('should commit the keyboard-picked boundary day when the cursor carries a time from the value', async () => {
        // Arrange: Value at 14:30 on 14 January with dateMax on 15 January. The keyboard cursor
        // is seeded from the value and arrow navigation copies its time along, so the cursor
        // lands on "15 January 14:30" - a timestamp past the raw midnight max, while the cell
        // itself renders pickable.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({ value: utcDate(2026, 0, 14, 14, 30), dateMax: utcDate(2026, 0, 15) }, utcDate(2026, 0, 15, 11));

        // Act: Move the cursor one day right (onto the max boundary day) and pick with Enter.
        await user.keyboard('{ArrowRight}');
        await user.keyboard('{Enter}');
        await flush(fixture);

        // Assert: The boundary day commits - the carried time must not block the pick.
        expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'boundary day picked via keyboard should commit despite the carried time').toBe('2026-01-15');
      });
    });

    describe('keyboard: input', () => {
      it('should open the panel on Enter, Space and ArrowDown and close it on Escape', async () => {
        // Arrange: Create component and focus the input without triggering focus-open. The
        // handoff of DOM focus into the grid is a separate contract (asserted
        // in the open/close suite), so this test only tracks panel state and focus ownership.
        const user = userEvent.setup();
        const fixture = await arrangeDatePicker();
        const input = focusInputWithoutOpening(fixture);
        expect(fixture.componentInstance.isCalendarVisible(), 'suppressed focus should not open the panel').toBe(false);

        // Act: Press Enter.
        await user.keyboard('{Enter}');
        await flush(fixture);

        // Assert: Panel open.
        expect(fixture.componentInstance.isCalendarVisible(), 'Enter should open the panel').toBe(true);

        // Act: Escape closes the panel.
        await user.keyboard('{Escape}');
        await flush(fixture);

        // Assert: Panel closed and focus still owned by the input.
        expect(fixture.componentInstance.isCalendarVisible(), 'Escape should close the panel').toBe(false);
        expect(document.activeElement, 'Escape should return focus to the input').toBe(input);

        // Act: Press Space.
        await user.keyboard(' ');
        await flush(fixture);

        // Assert: Space opens the panel like Enter.
        expect(fixture.componentInstance.isCalendarVisible(), 'Space should open the panel').toBe(true);

        // Act: Close again and press ArrowDown.
        await user.keyboard('{Escape}');
        await flush(fixture);
        await user.keyboard('{ArrowDown}');
        await flush(fixture);

        // Assert: ArrowDown opens the panel as well.
        expect(fixture.componentInstance.isCalendarVisible(), 'ArrowDown should open the panel').toBe(true);
      });

      it('should seed the keyboard cursor from the current date on keyboard open when no value', async () => {
        // Arrange: Component without value, input focused without auto-open, system clock pinned
        // to 15 January 2026 - the whole arrange runs under the mocked clock because the seed
        // reads the clock at open time.
        const user = userEvent.setup();
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ value: null, translations: { dateTimePicker: { month: { 0: 'January' } } } });
          focusInputWithoutOpening(created);
          await user.keyboard('{Enter}');
          await flush(created);
          return created;
        });

        // Assert: Keyboard open seeds the cursor on the current date and the grid views its month.
        const focused = fixture.componentInstance.focusedDate();
        expect(focused, 'keyboard open should seed the keyboard cursor').not.toBeNull();
        expect(focused?.getUTCFullYear(), 'seeded cursor should carry the current year').toBe(2026);
        expect(focused?.getUTCMonth(), 'seeded cursor should carry the current month').toBe(0);
        expect(focused?.getUTCDate(), 'seeded cursor should carry the current day').toBe(15);
        const header = fixture.nativeElement.querySelector('.header-title');
        expect(header.textContent?.trim(), 'the viewed month should be the current month').toBe('2026 January');
      });

      it('should clear the value with Backspace and Delete when canNull, keeping focus and panel state', async () => {
        // Arrange: Deselectable component with value, input focused and panel closed; touch must
        // stay silent - clearing is not a blur.
        const user = userEvent.setup();
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15, 9, 30), canNull: true });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const input = focusInputWithoutOpening(fixture);

        // Act: Press Backspace.
        await user.keyboard('{Backspace}');
        await flush(fixture);

        // Assert: Value cleared; focus and panel untouched.
        expect(fixture.componentInstance.value(), 'Backspace with canNull should clear the value').toBeNull();
        expect(fixture.componentInstance.isCalendarVisible(), 'clearing from the input should keep the panel closed').toBe(false);
        expect(document.activeElement, 'focus should stay on the input').toBe(input);
        expect(touchSpy, 'clearing without focus movement should not emit touch').not.toHaveBeenCalled();

        // Act: Seed a value again and press Delete.
        fixture.componentInstance.value.set(utcDate(2026, 0, 20, 14, 5));
        fixture.detectChanges();
        await user.keyboard('{Delete}');
        await flush(fixture);

        // Assert: Delete clears exactly like Backspace.
        expect(fixture.componentInstance.value(), 'Delete with canNull should clear the value').toBeNull();

        // Act: Press Backspace once more on the already-null value.
        await user.keyboard('{Backspace}');
        await flush(fixture);

        // Assert: Repeat clear is a harmless no-op.
        expect(fixture.componentInstance.value(), 'clearing an already-null value should stay null').toBeNull();
        expect(fixture.componentInstance.isCalendarVisible(), 'no-op clear should keep the panel closed').toBe(false);
        expect(touchSpy, 'repeated clearing should still not emit touch').not.toHaveBeenCalled();
      });

      it('should keep the value on Backspace when canNull is false and still prevent the default', async () => {
        // Arrange: Component with value but canNull disabled.
        const fixture = await arrangeDatePicker({ value: utcDate(2026, 0, 15, 9, 30), canNull: false });

        // Act: Dispatch a cancelable Backspace keydown directly (userEvent does not expose the event object).
        const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        getInput(fixture).dispatchEvent(event);
        await flush(fixture);

        // Assert: Value untouched, but the key is swallowed anyway - a readonly input must never
        // hand Backspace to the browser's legacy history-back handling (Firefox).
        expect(fixture.componentInstance.value(), 'Backspace without canNull should keep the value').not.toBeNull();
        expect(event.defaultPrevented, 'Backspace should be default-prevented even when canNull is false').toBe(true);
      });
    });

    describe('keyboard: date grid', () => {
      it('should move the cursor one day with ArrowLeft/ArrowRight and one week with ArrowUp/ArrowDown', async () => {
        // Arrange: Open grid at 15 January 2026 with DOM focus placed on the grid; the cursor
        // is seeded from the current date.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'open should seed the cursor at 15 January')
          .toBe('2026-01-15');

        // Act: ArrowRight.
        await user.keyboard('{ArrowRight}');
        await flush(fixture);

        // Assert: One day forward.
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'ArrowRight should advance the cursor one day').toBe('2026-01-16');

        // Act: ArrowDown.
        await user.keyboard('{ArrowDown}');
        await flush(fixture);

        // Assert: One week down.
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'ArrowDown should advance the cursor one week').toBe('2026-01-23');

        // Act: ArrowUp.
        await user.keyboard('{ArrowUp}');
        await flush(fixture);

        // Assert: One week back up.
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'ArrowUp should move the cursor back one week').toBe('2026-01-16');

        // Act: ArrowLeft.
        await user.keyboard('{ArrowLeft}');
        await flush(fixture);

        // Assert: Back at the seeded day - the whole walk stayed inside the viewed month.
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'ArrowLeft should move the cursor back one day').toBe('2026-01-15');
        expect(fixture.componentInstance.viewDate()?.toISOString().slice(0, 10), 'arrow navigation inside the month must not change the view').toBe('2026-01-15');
      });

      it('should show the target month when navigation crosses a month boundary', async () => {
        // Arrange: Open grid at 15 January 2026 with month translations, cursor moved to the
        // first of the month so one step crosses the year boundary.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({ translations: { dateTimePicker: { month: { 0: 'January', 11: 'December' } } } }, utcDate(2026, 0, 15, 11));
        fixture.componentInstance.focusedDate.set(utcDate(2026, 0, 1));

        // Act: Step back across the year boundary.
        await user.keyboard('{ArrowLeft}');
        await flush(fixture);

        // Assert: Cursor landed on 31 December 2025, the view follows it into December and the
        // header names the new month.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'ArrowLeft from 1 January should land on 31 December').toBe('2025-12-31T00:00:00.000Z');
        expect(fixture.componentInstance.viewDate()?.toISOString(), 'the viewed month should follow the cursor across the boundary').toBe('2025-12-01T00:00:00.000Z');
        const header = fixture.nativeElement.querySelector('.header-title');
        expect(header.textContent?.trim(), 'header should name the followed month').toBe('2025 December');
        expect(findCell(fixture, 2025, 11, 31), 'the cursor day should be rendered on the new grid').not.toBeNull();
      });

      it('should jump the cursor to the first and last day of the viewed month on Home and End', async () => {
        // Arrange: Open grid at 15 January 2026 with the cursor seeded mid-month.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

        // Act: Home.
        await user.keyboard('{Home}');
        await flush(fixture);

        // Assert: First day of the viewed month.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'Home should jump to the first day of the viewed month').toBe('2026-01-01T00:00:00.000Z');

        // Act: End.
        await user.keyboard('{End}');
        await flush(fixture);

        // Assert: Last day of the viewed month.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'End should jump to the last day of the viewed month').toBe('2026-01-31T00:00:00.000Z');
      });

      it('should move the cursor and the viewed month by one month on PageDown and PageUp', async () => {
        // Arrange: Open grid at 15 January 2026 with the cursor parked mid-month.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        fixture.componentInstance.focusedDate.set(utcDate(2026, 0, 15));

        // Act: PageDown.
        await user.keyboard('{PageDown}');
        await flush(fixture);

        // Assert: Cursor and view both moved into February.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'PageDown should move the cursor one month forward').toBe('2026-02-15T00:00:00.000Z');
        expect(fixture.componentInstance.viewDate()?.toISOString(), 'PageDown should show the target month').toBe('2026-02-01T00:00:00.000Z');

        // Act: PageUp.
        await user.keyboard('{PageUp}');
        await flush(fixture);

        // Assert: Back in January.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'PageUp should move the cursor one month back').toBe('2026-01-15T00:00:00.000Z');
        expect(fixture.componentInstance.viewDate()?.toISOString(), 'PageUp should show the target month').toBe('2026-01-01T00:00:00.000Z');
      });

      it('should clamp the cursor to the last day of the target month on PageDown and PageUp', async () => {
        // Arrange: The month step must clamp the day: 31 January + 1 month is 28 February (2026
        // is not a leap year) - an unclamped setUTCMonth would land on "Feb 31" = 3 March, i.e.
        // outside the shown month, and the cursor's cell (and therefore aria-activedescendant)
        // would disappear. The PageUp leg shares the same clamp (31 March - 1 month overflows the
        // same way).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        fixture.componentInstance.focusedDate.set(utcDate(2026, 0, 31));

        // Act: PageDown from the last day of January.
        await user.keyboard('{PageDown}');
        await flush(fixture);

        // Assert: Cursor clamps onto the last day of February and stays on the shown grid.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'PageDown from 31 January should clamp to 28 February').toBe('2026-02-28T00:00:00.000Z');
        expect(fixture.componentInstance.activeDescendantId(), 'the clamped cursor must stay on the shown grid').not.toBeUndefined();

        // Act: Move the view forward to March, park the cursor at its end and page back.
        fixture.componentInstance.changeMonth(1);
        fixture.componentInstance.focusedDate.set(utcDate(2026, 2, 31));
        await user.keyboard('{PageUp}');
        await flush(fixture);

        // Assert: Cursor clamps onto the last day of February on the way back too.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'PageUp from 31 March should clamp to 28 February').toBe('2026-02-28T00:00:00.000Z');
      });

      it('should move the cursor and the viewed year by one year on Shift+PageDown and Shift+PageUp', async () => {
        // Arrange: Open grid at 15 January 2026 with the cursor parked mid-month.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        fixture.componentInstance.focusedDate.set(utcDate(2026, 0, 15));

        // Act: Shift+PageDown.
        await user.keyboard('{Shift>}{PageDown}{/Shift}');
        await flush(fixture);

        // Assert: Cursor and view both moved one year forward, keeping month and day.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'Shift+PageDown should move the cursor one year forward').toBe('2027-01-15T00:00:00.000Z');
        expect(fixture.componentInstance.viewDate()?.toISOString(), 'Shift+PageDown should show the target year').toBe('2027-01-01T00:00:00.000Z');

        // Act: Shift+PageUp.
        await user.keyboard('{Shift>}{PageUp}{/Shift}');
        await flush(fixture);

        // Assert: Back in 2026.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'Shift+PageUp should move the cursor one year back').toBe('2026-01-15T00:00:00.000Z');
        expect(fixture.componentInstance.viewDate()?.toISOString(), 'Shift+PageUp should show the target year').toBe('2026-01-01T00:00:00.000Z');
      });

      it('should clamp the cursor to 29 February when stepping a year across a leap day', async () => {
        // Arrange: 29 February exists only in leap years - a year step must clamp onto 28 February
        // of the target year instead of overflowing into March, which would park the cursor outside
        // the shown grid and drop its aria-activedescendant (same rationale as the month clamp).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2024, 1, 15, 11));
        fixture.componentInstance.focusedDate.set(utcDate(2024, 1, 29));

        // Act: Step one year forward from the leap day.
        await user.keyboard('{Shift>}{PageDown}{/Shift}');
        await flush(fixture);

        // Assert: Cursor clamps onto 28 February 2025 and stays on the shown grid.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'Shift+PageDown from 29 February 2024 should clamp to 28 February 2025').toBe('2025-02-28T00:00:00.000Z');
        expect(fixture.componentInstance.viewDate()?.toISOString(), 'the view should follow into February 2025').toBe('2025-02-01T00:00:00.000Z');
        expect(fixture.componentInstance.activeDescendantId(), 'the clamped cursor must stay on the shown grid').not.toBeUndefined();
        expect(findCell(fixture, 2025, 1, 28), 'the clamped day should be rendered on the new grid').not.toBeNull();

        // Act: Put the view and the leap-day cursor back and page a year back.
        fixture.componentInstance.changeYear(-1);
        fixture.componentInstance.focusedDate.set(utcDate(2024, 1, 29));
        await user.keyboard('{Shift>}{PageUp}{/Shift}');
        await flush(fixture);

        // Assert: Cursor clamps onto 28 February 2023 (also not a leap year) on the way back too.
        expect(fixture.componentInstance.focusedDate()?.toISOString(), 'Shift+PageUp from 29 February 2024 should clamp to 28 February 2023').toBe('2023-02-28T00:00:00.000Z');
        expect(fixture.componentInstance.activeDescendantId(), 'the clamped cursor must stay on the shown grid after paging back').not.toBeUndefined();
      });

      it('should only seed the cursor without navigating on Shift+PageDown when no cursor is set', async () => {
        // Arrange: Open grid at 15 January 2026 and drop the cursor (the reset-after-close state).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        fixture.componentInstance.focusedDate.set(null);

        // Act: First navigation key with no cursor to move.
        await user.keyboard('{Shift>}{PageDown}{/Shift}');
        await flush(fixture);

        // Assert: The key only seeds the cursor on the viewed date instead of jumping a year.
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'first navigation key should seed the cursor without moving it').toBe('2026-01-15');
        expect(fixture.componentInstance.viewDate()?.toISOString().slice(0, 10), 'seeding must not change the viewed month').toBe('2026-01-15');
      });

      it('should only seed the cursor without navigating on the first navigation key when no cursor is set', async () => {
        // Arrange: Open grid at 15 January 2026 and drop the cursor (the reset-after-close
        // state).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        fixture.componentInstance.focusedDate.set(null);

        // Act: First navigation key with no cursor to move.
        await user.keyboard('{ArrowRight}');
        await flush(fixture);

        // Assert: The key only seeds the cursor on the viewed date instead of advancing it.
        expect(fixture.componentInstance.focusedDate()?.toISOString().slice(0, 10), 'first navigation key should seed the cursor without moving it').toBe('2026-01-15');
      });

      it('should commit the focused day on Enter and close the panel', async () => {
        // Arrange: Open grid at 15 January 2026 with the cursor seeded at the current date.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

        // Act: Enter picks the focused day.
        await user.keyboard('{Enter}');
        await flush(fixture);

        // Assert: The day is committed as the value and the interaction completes.
        expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'Enter should commit the focused day').toBe('2026-01-15');
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should close after the pick').toBe(false);
      });

      it('should move focus to the next control and report touch when Enter commits the day', async () => {
        // Arrange: The time-picker contract for a committed pick: advance focus to the next
        // control and report touch (the leaving focusout). The handoff must anchor past the
        // calendar grid (tabindex=0, sitting between the input and the next control while the
        // panel is open) - an input-anchored step would resolve to the grid, focus would never
        // leave the component and no touch would ever be reported.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);

        try {
          // Act: Enter commits the focused day.
          await user.keyboard('{Enter}');
          await flush(fixture);

          // Assert: Focus advanced past the picker and the completed interaction is reported.
          expect(document.activeElement, 'Enter commit should move focus to the next control').toBe(nextControl);
          expect(touchSpy, 'focus leaving the component should report touch').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          nextControl.remove();
        }
      });

      it('should commit the focused day on Space and close the panel', async () => {
        // Arrange: Open grid at 15 January 2026 with the cursor seeded at the current date.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

        // Act: Space picks the focused day.
        await user.keyboard(' ');
        await flush(fixture);

        // Assert: Commit and close, exactly like Enter.
        expect(fixture.componentInstance.value()?.toISOString().slice(0, 10), 'Space should commit the focused day').toBe('2026-01-15');
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should close after the pick').toBe(false);
      });

      it('should clear the picked day with Enter when canNull, returning focus to the input internally', async () => {
        // Arrange: Deselectable component; pick 20 January with the mouse first, then reopen
        // with the cursor seeded on the pick. The time-picker contract for a CLEARED pick is
        // hidePanelAndRefocus: focus returns to the input INTERNALLY, so no touch is reported.
        // The cursor reset on close is asserted too (touch is checked for completeness).
        const user = userEvent.setup();
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ value: null, canNull: true });
          await openPanel(created);
          findCell(created, 2026, 0, 20)?.click();
          await flush(created);
          await openPanel(created);
          created.componentInstance.calendarGridRef().nativeElement.focus();
          created.detectChanges();
          return created;
        });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);

        // Act: Enter on the already picked day un-picks it.
        await user.keyboard('{Enter}');
        await flush(fixture);

        // Assert: Value cleared and panel closed...
        expect(fixture.componentInstance.value(), 'Enter with canNull should clear the value').toBeNull();
        expect(fixture.componentInstance.isCalendarVisible(), 'clearing should close the panel').toBe(false);
        // ...and focus came back to the input without leaving the component.
        expect(document.activeElement, 'clearing should return focus to the input internally').toBe(getInput(fixture));
        expect(touchSpy, 'internal focus move should not emit touch').not.toHaveBeenCalled();
        expect(fixture.componentInstance.focusedDate(), 'clearing should reset the keyboard cursor').toBeNull();
      });

      it('should keep value and panel on Enter when re-selecting the same day with canNull false', async () => {
        // Arrange: Pick 20 January with the mouse (selectedDate carries the day), then reopen
        // with the cursor seeded on the pick.
        const user = userEvent.setup();
        const fixture = await withMockedNow(utcDate(2026, 0, 15, 11), async () => {
          const created = await arrangeDatePicker({ value: null, canNull: false });
          await openPanel(created);
          findCell(created, 2026, 0, 20)?.click();
          await flush(created);
          await openPanel(created);
          created.componentInstance.calendarGridRef().nativeElement.focus();
          created.detectChanges();
          return created;
        });
        const before = fixture.componentInstance.value();

        // Act: Enter on the day that is already picked.
        await user.keyboard('{Enter}');
        await flush(fixture);

        // Assert: Nothing changed, so the pick is a no-op and the interaction is not completed.
        expect(fixture.componentInstance.value(), 're-Enter on the same day must keep the value instance').toBe(before);
        expect(fixture.componentInstance.isCalendarVisible(), 'no-op pick should keep the panel open').toBe(true);
      });

      it('should close the panel, return focus to the input and reset the cursor on Escape from the grid', async () => {
        // Arrange: Escape must close and refocus, and the cursor must reset on close - otherwise
        // the closed grid keeps aria-activedescendant pointing at a hidden cell (time-picker
        // resets its cursors the same way).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

        // Act: Escape from the grid.
        await user.keyboard('{Escape}');
        await flush(fixture);

        // Assert: Panel closed, focus back on the input, cursor state reset.
        expect(fixture.componentInstance.isCalendarVisible(), 'Escape should close the panel').toBe(false);
        expect(document.activeElement, 'Escape should return focus to the input').toBe(getInput(fixture));
        expect(fixture.componentInstance.focusedDate(), 'Escape should reset the keyboard cursor').toBeNull();
      });

      it('should close the panel, reset the cursor and move focus to the previous control on Shift+Tab from the grid', async () => {
        // Arrange: Shift+Tab from the grid must LEAVE the component: the press is
        // preventDefaulted and focus handed to the previous control via hidePanelAndFocusPrev.
        // The default traversal would land on the input (still inside the component), leaving
        // the panel open with the cursor unreset.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({ value: utcDate(2026, 0, 15, 9, 30) }, utcDate(2026, 0, 15, 11));
        const before = fixture.componentInstance.value();
        const prevControl = document.createElement('button');
        prevControl.setAttribute('data-testid', 'prev-control');
        document.body.insertBefore(prevControl, fixture.nativeElement);

        try {
          // Act: Shift+Tab moves backwards out of the picker.
          await user.keyboard('{Shift>}{Tab}{/Shift}');
          await flush(fixture);

          // Assert: Panel closed, cursor reset, value untouched, focus moved on.
          expect(fixture.componentInstance.isCalendarVisible(), 'panel should close on Shift+Tab').toBe(false);
          expect(fixture.componentInstance.focusedDate(), 'Shift+Tab should reset the keyboard cursor').toBeNull();
          expect(fixture.componentInstance.value(), 'Shift+Tab should not change value').toBe(before);
          expect(document.activeElement, 'focus should move to the previous focusable control').toBe(prevControl);
        } finally { // cleanup
          prevControl.remove();
        }
      });

      it('should close the panel and report touch when Tab leaves the grid forward', async () => {
        // Arrange: Open grid with a focusable control after the picker (native Tab target).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({ value: utcDate(2026, 0, 15, 9, 30) }, utcDate(2026, 0, 15, 11));
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const before = fixture.componentInstance.value();
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);

        try {
          // Act: Tab moves forward out of the picker - the default traversal is the contract
          // (no handler needed), and the focusout closes the panel and reports touch.
          await user.keyboard('{Tab}');
          await flush(fixture);

          // Assert: Panel closed, value untouched, focus moved on, blur reported.
          expect(fixture.componentInstance.isCalendarVisible(), 'panel should close when Tab leaves forward').toBe(false);
          expect(fixture.componentInstance.value(), 'Tab out should not change value').toBe(before);
          expect(document.activeElement, 'focus should move to the next focusable control').toBe(nextControl);
          expect(touchSpy, 'focus leaving the component forward should report touch').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          nextControl.remove();
        }
      });

      it('should clear the value with Delete from the grid, close the panel and refocus the input when canNull', async () => {
        // Arrange: The input clears its value on Delete/Backspace and the open grid is where the
        // keyboard focus actually sits, so onGridKeydown must offer the same clear (time-picker
        // clears, closes and refocuses from its listboxes).
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({ value: utcDate(2026, 0, 15, 9, 30), canNull: true }, utcDate(2026, 0, 15, 11));
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);

        // Act: Press Delete on the grid.
        await user.keyboard('{Delete}');
        await flush(fixture);

        // Assert: Value cleared, interaction completed, cursor reset, focus back on the input
        // internally (no touch).
        expect(fixture.componentInstance.value(), 'Delete with canNull should clear the value').toBeNull();
        expect(fixture.componentInstance.isCalendarVisible(), 'clearing should close the panel').toBe(false);
        expect(fixture.componentInstance.focusedDate(), 'clearing should reset the keyboard cursor').toBeNull();
        expect(document.activeElement, 'clearing should return focus to the input').toBe(getInput(fixture));
        expect(touchSpy, 'internal focus move should not emit touch').not.toHaveBeenCalled();
      });

      it('should keep value and panel on Delete when canNull is false', async () => {
        // Arrange: Component with value, canNull disabled, panel open and grid focused.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({ value: utcDate(2026, 0, 15, 9, 30), canNull: false }, utcDate(2026, 0, 15, 11));
        const before = fixture.componentInstance.value();

        // Act: Press Delete.
        await user.keyboard('{Delete}');
        await flush(fixture);

        // Assert: Nothing was cleared, so the interaction is not complete - panel and focus stay.
        expect(fixture.componentInstance.value(), 'Delete without canNull should keep the value').toBe(before);
        expect(fixture.componentInstance.isCalendarVisible(), 'panel should stay open when nothing was cleared').toBe(true);
        expect(document.activeElement, 'focus should stay in the calendar grid').toBe(fixture.componentInstance.calendarGridRef().nativeElement);
      });

      it('should track the cursor with the focused class and aria-activedescendant as it moves', async () => {
        // Arrange: Open grid at 15 January 2026 with the cursor seeded at the current date.
        const user = userEvent.setup();
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        const seededCell = findCell(fixture, 2026, 0, 15);
        const grid = fixture.nativeElement.querySelector('.calendar-grid');
        expect(seededCell, 'precondition: 15 January should be on the grid').not.toBeNull();
        expect(seededCell?.classList.contains('focused'), 'seeded cursor cell should carry the focus ring').toBe(true);
        expect(grid.getAttribute('aria-activedescendant'), 'grid should reference the seeded cursor cell').toBe(seededCell?.id);

        // Act: ArrowRight moves the cursor.
        await user.keyboard('{ArrowRight}');
        await flush(fixture);

        // Assert: The ring and the activedescendant follow the cursor to the next day.
        const movedCell = findCell(fixture, 2026, 0, 16);
        expect(movedCell, 'precondition: 16 January should be on the grid').not.toBeNull();
        expect(movedCell?.classList.contains('focused'), 'moved cursor cell should carry the focus ring').toBe(true);
        expect(seededCell?.classList.contains('focused'), 'left-behind cell must lose the focus ring').toBe(false);
        expect(grid.getAttribute('aria-activedescendant'), 'activedescendant should follow the moved cursor').toBe(movedCell?.id);
      });

      it('should prevent the default browser behavior on navigation keys', async () => {
        // Arrange: Open grid with the cursor seeded.
        const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
        const grid = fixture.componentInstance.calendarGridRef().nativeElement;

        // Act: Dispatch cancelable keydowns directly (the event object is needed for the flag).
        const keys: { key: string; shiftKey?: boolean }[] = [
          { key: 'ArrowRight' },
          { key: 'Home' },
          { key: 'End' },
          { key: 'PageDown' },
          { key: 'PageUp' },
          { key: 'PageDown', shiftKey: true },
          { key: 'PageUp', shiftKey: true },
          { key: 'Escape' },
        ];
        const events = keys.map(({ key, shiftKey }) => {
          const event = new KeyboardEvent('keydown', { key, shiftKey: shiftKey ?? false, bubbles: true, cancelable: true });
          grid.dispatchEvent(event);
          return event;
        });
        await flush(fixture);

        // Assert: Every key is swallowed - native Home/End would move DOM focus and
        // PageUp/PageDown (with or without Shift) would scroll the page.
        events.forEach((event, index) => {
          const label = keys[index].shiftKey ? `Shift+${keys[index].key}` : keys[index].key;
          expect(event.defaultPrevented, `${label} should be default-prevented on the grid`).toBe(true);
        });
      });
    });
  });

  describe('header navigation', () => {
    /**
     * Press a calendar header navigation button the way a mouse press does: a cancelable
     * mousedown first (so the component's panel-chrome guard runs and, as in a browser,
     * cancelled default keeps DOM focus on the grid), then the click that navigates.
     * Dispatched manually instead of through user-event so the follow-up key presses in these
     * tests are guaranteed to reach the grid's own keydown handler.
     * @param fixture Fixture of the component.
     * @param name Button suffix: `yearMinus` | `monthMinus` | `monthPlus` | `yearPlus`.
     */
    async function pressNavButton(fixture: ComponentFixture<DatePicker>, name: 'yearMinus' | 'monthMinus' | 'monthPlus' | 'yearPlus'): Promise<void> {
      const button = getNavButton(fixture, name);
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      button.click();
      await flush(fixture);
    }

    it('should keep the keyboard cursor on the grid when a header button changes the viewed month', async () => {
      // Arrange: Open grid at 15 January 2026 with DOM focus on the grid and the cursor seeded
      // there - the state a user reaches by Tab-ing in and then reaching for the header buttons.
      const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
      const grid = fixture.componentInstance.calendarGridRef().nativeElement;

      // Act: Advance one month through the real header button.
      await pressNavButton(fixture, 'monthPlus');

      // Assert: The view AND the cursor moved together, so the cursor cell is rendered on the
      // shown grid - the focus ring and aria-activedescendant must survive the header click.
      expect(fixture.componentInstance.viewDate()?.toISOString(), 'monthPlus should show February').toBe('2026-02-01T00:00:00.000Z');
      expect(fixture.componentInstance.focusedDate()?.toISOString(), 'monthPlus should re-seat the cursor into February').toBe('2026-02-15T00:00:00.000Z');
      const cell = findCell(fixture, 2026, 1, 15);
      expect(cell, 'the re-seated cursor day should be rendered on the new grid').not.toBeNull();
      expect(grid.getAttribute('aria-activedescendant'), 'grid should reference the re-seated cursor cell').toBe(cell?.id);
    });

    it('should keep the view on the new month when an arrow key follows header navigation', async () => {
      // Arrange: Open grid at 15 January 2026 with the cursor seeded there.
      const user = userEvent.setup();
      const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

      // Act: Move to February with the header button, then continue with the keyboard.
      await pressNavButton(fixture, 'monthPlus');
      await user.keyboard('{ArrowRight}');
      await flush(fixture);

      // Assert: The arrow step continues from the cursor inside February - it must not drag the
      // view back to January, the month the cursor used to sit in before the header click.
      expect(fixture.componentInstance.focusedDate()?.toISOString(), 'ArrowRight should advance the February cursor').toBe('2026-02-16T00:00:00.000Z');
      expect(fixture.componentInstance.viewDate()?.toISOString(), 'the view must stay on the month the header showed').toBe('2026-02-01T00:00:00.000Z');
    });

    it('should clamp the cursor to the last day of the target month on header month navigation', async () => {
      // Arrange: Cursor parked on 31 January - the day a plain month step would overflow
      // (the same clamp the PageDown test above covers for the keyboard path).
      const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));
      fixture.componentInstance.focusedDate.set(utcDate(2026, 0, 31));
      fixture.detectChanges();

      // Act: Advance one month through the header button.
      await pressNavButton(fixture, 'monthPlus');

      // Assert: The cursor clamps onto 28 February (2026 is not a leap year) and stays on the
      // shown grid, so aria-activedescendant never dangles on a missing cell.
      expect(fixture.componentInstance.focusedDate()?.toISOString(), 'header month step should clamp 31 January to 28 February').toBe('2026-02-28T00:00:00.000Z');
      expect(fixture.componentInstance.activeDescendantId(), 'the clamped cursor must stay on the shown grid').not.toBeUndefined();
    });

    it('should keep the cursor in the shown month on header year navigation across a leap day', async () => {
      // Arrange: Cursor on 29 February 2024 - a year step must clamp instead of rolling over
      // into March, where the cursor cell would fall outside the shown grid.
      const fixture = await arrangeFocusedGrid({}, utcDate(2024, 1, 15, 11));
      fixture.componentInstance.focusedDate.set(utcDate(2024, 1, 29));
      fixture.detectChanges();

      // Act: Advance one year through the header button.
      await pressNavButton(fixture, 'yearPlus');

      // Assert: View and cursor both land in February 2025, cursor clamped to the 28th.
      expect(fixture.componentInstance.viewDate()?.toISOString(), 'yearPlus should show February 2025').toBe('2025-02-01T00:00:00.000Z');
      expect(fixture.componentInstance.focusedDate()?.toISOString(), 'header year step should clamp 29 February to 28 February').toBe('2025-02-28T00:00:00.000Z');
      expect(fixture.componentInstance.activeDescendantId(), 'the clamped cursor must stay on the shown grid').not.toBeUndefined();
    });

    it('should pick a day of the shown month when Enter follows header navigation', async () => {
      // Arrange: Open grid at 15 January 2026 with the cursor seeded there.
      const user = userEvent.setup();
      const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

      // Act: Move to February via the header, then commit with Enter.
      await pressNavButton(fixture, 'monthPlus');
      await user.keyboard('{Enter}');
      await flush(fixture);

      // Assert: The commit uses the cursor the user sees - a day of February, not the stale
      // January day the cursor sat on before the header click.
      expect(fixture.componentInstance.value()?.toISOString(), 'Enter should pick 15 February, the day shown under the cursor').toBe('2026-02-15T00:00:00.000Z');
    });
  });

  describe('focus', () => {
    registerSubPickerFocusTests(subPickerDriver);
  });

  describe('scrolling', () => {
    it('should not use scrollIntoView when opening the panel or navigating with the keyboard', async () => {
      // Arrange: Clear the shared scrollIntoView spy (stub installed in beforeAll). The grid is
      // fixed at six rows with no internal scrolling, so nothing here ever needs it.
      const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
      scrollSpy.mockClear();
      const user = userEvent.setup();
      const fixture = await arrangeFocusedGrid({}, utcDate(2026, 0, 15, 11));

      // Act: Navigate the grid with the keyboard.
      await user.keyboard('{ArrowRight}');
      await flush(fixture);
      await user.keyboard('{PageDown}');
      await flush(fixture);
      await user.keyboard('{Home}');
      await flush(fixture);

      // Assert: scrollIntoView aligns against the viewport, so it would also scroll every
      // scrollable ancestor - including the page - whenever the target is off-center.
      expect(scrollSpy, 'scrollIntoView must not be used because it scrolls page ancestors').not.toHaveBeenCalled();
    });

    it('should pass preventScroll when closing returns focus to the input', async () => {
      // Arrange: Open panel with a value and spy on the input focus.
      const user = userEvent.setup();
      const fixture = await arrangeFocusedGrid({ value: utcDate(2026, 0, 15, 9, 30) }, utcDate(2026, 0, 15, 11));
      const inputFocusSpy = vi.spyOn(getInput(fixture), 'focus');

      // Act: Leave the panel via Escape, which refocuses the input before hiding the panel.
      await user.keyboard('{Escape}');
      await flush(fixture);

      // Assert: The refocus passes preventScroll (it must not scroll the page back up to the
      // input after the user scrolled down to a below-the-fold panel) and landed on the input.
      expect(inputFocusSpy, 'Escape should refocus the input with preventScroll').toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement, 'Escape should return focus to the input').toBe(getInput(fixture));
    });
  });
});
