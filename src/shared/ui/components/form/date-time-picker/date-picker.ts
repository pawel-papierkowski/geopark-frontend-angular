import { Component, effect, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef, DOCUMENT } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService } from '@ngx-translate/core';

import { TimeUtils } from '@/core/utils/TimeUtils';
import { NavUtils } from '@/core/utils/NavUtils';
import { WindowUtils, type PanelPlacement, type PanelInsets } from '@/core/utils/WindowUtils';
import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';
import { forRender } from '@/shared/utils/render/after-render';

import { EnCalendarCellType, CalendarCell, CalendarCellView } from '@/shared/ui/other/types';

/**
 * Placement of the calendar panel relative to its input - single source of truth for both the
 * baseline reset on open and the flip decision (see `WindowUtils.resolvePanelPlacement`).
 * `flipY` anchors the panel's BOTTOM to the input's TOP (`bottom: 100%`), NOT `bottom: 0`:
 * `bottom: 0` would pin the panel's bottom to the input's bottom, so the panel would sit
 * ON TOP of the input and intercept its clicks.
 * The anchor is the picker root - it is the positioned ancestor the panel's `top/bottom`
 * percentages resolve against. When the panel fits on neither side of the root, it stays
 * below (baseline) so the user can scroll down to it.
 * Note: both flips rely on `.calendar-container` having zero right/bottom margins
 * (`--datetimepicker-calendar-offset` in styles/var/components-custom.css).
 */
const panelPlacement: PanelPlacement = {
  baseline: { top: '100%', bottom: 'auto', left: '0', right: 'auto' },
  flipX: { left: 'auto', right: '0' },
  flipY: { top: 'auto', bottom: '100%' },
};

/**
 * This is a date picker. Uses `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="date".
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Can select date.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows (open panel or change day/month), page up/down (change month, with shift change year), enter/space (pick date) and esc (close panel).
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Always provided by parent DateTimePicker, this component is not meant to be used alone.
 * - label - Id of an external element (usually `<label>`) used for `aria-labelledby`; when set, it names the input instead of the `aria-label` fallback. The id must match an element in the document - a dangling reference silently empties the input's name, so dev mode warns on the console (see `warnDanglingLabel`). Optional.
 * - qualifyLabel - If true and `label` is set, appends a hidden "Date" qualifier id to `aria-labelledby`, so both sub-fields stay distinguishable when DateTimePicker runs in `datetime` mode. Always provided by parent DateTimePicker. Optional, default false.
 * - labelTarget - The host's hidden label-activation target, which lives OUTSIDE this component's subtree (a sibling on the parent's root). Focus landing on it during label activation reads as an internal move instead of a blur. Always provided by parent DateTimePicker. Optional, default null.
 * - canNull - If true, allow deselecting date. Optional, default is false.
 * - showWeeks - If true, show weeks. Optional, default is false.
 * - dateMin - If not null, defines earliest allowed date. Optional, default is null.
 * - dateMax - If not null, defines latest allowed date. Optional, default is null.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 *
 * Special (set indirectly):
 * - required - If true, component is required. Default is false.
 * - disabled - If true, acts as disabled component. Default is false.
 * - invalid - If true, shows component as having invalid state. Visual only. Default is false.
 */
@Component({
  selector: 'date-picker',
  styleUrl: './date-picker.css',
  templateUrl: './date-picker.html',
})
export class DatePicker implements FormValueControl<Date | null> {
  private injector = inject(Injector);
  /** For programmatic translations. */
  private readonly translateService = inject(TranslateService);
  /** Injectable document, used for the global focus check in `handleMousedown`. */
  private readonly document = inject(DOCUMENT);

  /** Value held by component. */
  public value = model<Date | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Label reference: id of an external element (usually `<label>`) used for `aria-labelledby`. */
  public label = input<string>('');
  /** If true, append a hidden "Date" qualifier to the accessible name (see `nameRefs`). */
  public qualifyLabel = input<boolean>(false);
  /** Host's hidden label-activation target. */
  public labelTarget = input<Element | null>(null);
  /** If true, allow deselecting date. */
  public canNull = input<boolean>(false);
  /** If true, show weeks. */
  public showWeeks = input<boolean>(false);
  /** If not null, defines earliest allowed date. */
  public dateMin = input<Date | null>(null);
  /** If not null, defines latest allowed date. */
  public dateMax = input<Date | null>(null);
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  public touch = output<void>();

  /** Shortcuts for days of week used in lang keys. */
  public daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  // REFERENCES

  /** Root focusable element. */
  private pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to the text input. */
  private inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');
  /** Reference to calendar panel. */
  public calendarPanelRef = viewChild.required<ElementRef<HTMLDivElement>>('calendarPanelRef');
  /** Reference to calendar grid. Used for keyboard navigation. */
  public calendarGridRef = viewChild.required<ElementRef<HTMLDivElement>>('calendarGridRef');

  // SIGNALS

  /**
   * Value of the input's `aria-labelledby`: the external label id, plus (when `qualifyLabel`)
   * this sub-field's hidden qualifier id; null when no label is set (the input then falls back
   * to `aria-label`). The qualified name reads "<label> Date" - the label text stays a prefix,
   * so the visible label remains inside the accessible name (WCAG 2.5.3) for voice control.
   */
  public readonly nameRefs = computed<string | null>(() => {
    const label = this.label();
    if (label === '') return null;
    return this.qualifyLabel() ? `${label} ${this.ident()}_qualifier` : label;
  });

  /** Indicates visibility of calendar panel. */
  public readonly isCalendarVisible = signal(false);

  /** Date under keyboard focus within the calendar grid. Set when panel opens, updated via arrow navigation. */
  public focusedDate = signal<Date | null>(null);
  /**
   * Currently highlighted date in the grid - the display selection, derived from `value` so an
   * externally loaded value marks its day as selected. Read-only: picking writes `value`
   * (mirrors time-picker's `selectedHour`, which is likewise computed from `value`).
   */
  public selectedDate = computed<Date | null>(() => this.normalizedValue());
  /** Currently viewed date in the grid. */
  public viewDate = signal<Date | null>(null);

  /**
   * Inline style of the clock panel (see `panelPlacement`). All four insets are managed
   * TOGETHER: the CSS default (`top: 100%`, `left: 0`) can be overridden inline, so a stale
   * inline `top: auto` from a previous upward flip would otherwise persist, and having both
   * `top` and `bottom` non-auto would over-constrain the absolutely positioned panel.
   * Reset to the baseline on every open before measuring.
   */
  public containerStyle = signal<PanelInsets>(panelPlacement.baseline);

  // COMPUTED

  /** `value` when it carries a real date, otherwise null. Prevents showing NaN on invalid Date and similar bugs. */
  private normalizedValue = computed<Date | null>(() => {
    const value = this.value();
    return value !== null && !Number.isNaN(value.getTime()) ? value : null;
  });

  /**
   * Compute currently displayed date value in date input. Always a string (never null), so
   * the `[value]` binding never writes null into the input.
   */
  public displayDateValue = computed(() => TimeUtils.formatUTCDate(this.normalizedValue()));
  /**
   * Compute placeholder value for date input. Same rule as the value: no decorative glyph, so
   * the format hint is announced (and read) as plain date.
   */
  public placeholderDateValue = computed(() => this.translateService.instant('dateTimePicker.placeholder.date'));

  // Static chrome labels. Resolved through `instant` inside computeds instead of the impure
  // `translate` pipe: same output (including the raw-key fallback when a translation is missing)
  // and same language reactivity, but nothing is re-evaluated on change-detection passes that
  // don't touch the language. One computed per key, shared where the key is reused.

  /** Input `aria-label` fallback and hidden qualifier text (both carry the sub-field name). */
  public readonly dateLabel = computed(() => this.translateService.instant('dateTimePicker.date'));
  /** Accessible name of the calendar dialog. */
  public readonly panelLabel = computed(() => this.translateService.instant('dateTimePicker.datePicker'));
  /** Accessible name of the "previous year" header button. */
  public readonly yearMinusLabel = computed(() => this.translateService.instant('dateTimePicker.yearMinus'));
  /** Accessible name of the "previous month" header button. */
  public readonly monthMinusLabel = computed(() => this.translateService.instant('dateTimePicker.monthMinus'));
  /** Accessible name of the "next month" header button. */
  public readonly monthPlusLabel = computed(() => this.translateService.instant('dateTimePicker.monthPlus'));
  /** Accessible name of the "next year" header button. */
  public readonly yearPlusLabel = computed(() => this.translateService.instant('dateTimePicker.yearPlus'));

  /** Compute header text (year and name of month). */
  public headerText = computed(() => {
    const viewDate = this.viewDate();
    if (viewDate === null) return '';
    const monthIx = viewDate.getUTCMonth(); // Reminder that for some reason month is zero-indexed.
    return viewDate.getUTCFullYear() + ' ' + this.translateService.instant('dateTimePicker.month.' + monthIx);
  });

  /**
   * Weekday header labels with their day keys, translated ONCE per rebuild instead of through
   * the impure `translate` pipe on every change-detection pass. Reads `instant` inside a
   * computed, so it stays reactive to language switches (same pattern as `headerText`).
   */
  public readonly weekdayLabels = computed(() =>
    this.daysOfWeek.map((day) => ({ key: day, label: this.translateService.instant('dateTimePicker.dayOfWeek.' + day) })),
  );

  /** Find out amount of columns needed for calendar. */
  public gridColumns = computed(() => (this.showWeeks() ? 8 : 7));
  /** Find out grid style. */
  public gridStyle = computed(() => ({
    gridTemplateColumns: `repeat(${this.gridColumns() || 7}, 1fr)`,
  }));

  /**
   * Cells of the whole calendar grid (all six rows, week cells spliced in when `showWeeks`),
   * with presentation state precomputed (see `CalendarCellView`). All per-cell predicates that
   * the template used to run TWICE per cell on EVERY change-detection pass - method calls,
   * `new Date()` allocations for the today marker, and the impure `translate` pipe for the
   * aria-label - now run once here, only when something the cells depend on changes
   * (viewed month, selection, min/max range, ident, language).
   */
  public calendarCells = computed<CalendarCellView[]>(() => {
    const cells = this.calcCalendarCells();
    // "Today" is sampled once per rebuild. Cells rebuild on every open (`findViewDate` writes a
    // fresh `viewDate`), so the marker always reflects the clock when the panel opens; while it
    // stays open past midnight the marker no longer moves - the old per-render `new Date()` did,
    // but at the cost of two Date allocations per cell per pass.
    const now = new Date();
    const selected = this.selectedDate();
    return cells.map((cell, index) => this.buildCellView(cell, index, now, selected));
  });

  /**
   * Index of the keyboard-focused cell within `calendarCells`, or -1 when no date is focused
   * or the focused date is not on the grid. Backs both the `.focused` class and
   * `activeDescendantId`, so focus styling and aria stay in sync with a single `findIndex`.
   * Padding-month dates intentionally match: the cursor may sit on a day from the adjacent
   * month that is visible in the grid.
   */
  public readonly focusedIndex = computed<number>(() => {
    const focused = this.focusedDate();
    if (focused === null) return -1;
    const day = focused.getUTCDate();
    const month = focused.getUTCMonth();
    const year = focused.getUTCFullYear();
    return this.calendarCells().findIndex(
      (cell) => cell.type === EnCalendarCellType.Date && cell.day === day && cell.month === month && cell.year === year,
    );
  });

  /** Compute ID of the focused cell for aria-activedescendant. */
  public activeDescendantId = computed(() => {
    const index = this.focusedIndex();
    return index >= 0 ? `${this.ident()}_cell_${index}` : undefined;
  });

  constructor() {
    // Watch `disabled` field: close calendar panel when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isCalendarVisible()) this.hidePanel();
    });

    // Dev-only: catch a `label` id that matches no element. A dangling aria-labelledby leaves
    // this input without an accessible name (its aria-label fallback is suppressed whenever
    // label is set), which no assertion would catch. Re-runs whenever label or ident changes.
    effect(() => {
      warnDanglingLabel(this.document, this.label(), this.ident(), 'date-picker');
    });
  }

  // GENERAL

  /** Toggle visibility of date picker panel (calendar). */
  private async toggleDatePickerVisibility() {
    if (this.isCalendarVisible()) {
      this.hidePanel();
    } else {
      // Reset placement to the baseline (below the input, left-aligned) BEFORE the panel renders.
      // The measurement below then always runs under this known alignment - measuring the panel
      // as left over from the previous open would judge alignment by the OLD placement.
      this.containerStyle.set(panelPlacement.baseline);
      this.isCalendarVisible.set(true);
      this.findViewDate();

      // Seed keyboard focus state on EVERY open. Focus always moves into the calendar grid,
      // so the active option must exist right away.
      this.setupFocus(true);

      await forRender(this.injector);

      // Adjust picker position if needed to prevent window overflow (measured under baseline).
      this.positionPanel();

      // Move keyboard focus into the panel (calendar grid) so navigation keys work right away.
      // preventScroll: the panel was just placed to fit the viewport (or deliberately left below
      // the fold when it fits on neither side), so there is nothing to reveal - and a
      // focus-triggered page scroll would race with the user's mouse.
      this.calendarGridRef().nativeElement.focus({ preventScroll: true });
    }
  }

  /**
   * Resolve the calendar panel placement so it does not overflow the viewport.
   * Runs once per open, right after the panel rendered under the baseline - the measurement
   * contract, viewport and margin details are documented on `WindowUtils.resolvePanelPlacement`.
   */
  private positionPanel(): void {
    this.containerStyle.set(WindowUtils.resolvePanelPlacement(this.pickerRef().nativeElement, this.calendarPanelRef().nativeElement, panelPlacement));
  }

  /**
   * Find and set the date shown in the grid.
   * Follows the selection when one exists (the user sees their date), otherwise seeds from the
   * LOCAL calendar date so opening without a value pre-selects today's day. The seed is anchored
   * at UTC midnight of the local date: grid cells are built from the UTC parts of `viewDate`,
   * while "today" itself stays local (see `buildCellView`). Values stay timezone-agnostic
   * (UTC-carried), see class doc.
   */
  private findViewDate() {
    const selected = this.selectedDate();
    if (selected !== null) {
      this.viewDate.set(new Date(selected));
      return;
    }
    const now = new Date();
    this.viewDate.set(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }

  //

  /**
   * Calculate cells for calendar.
   * @returns Array of cells for entire calendar.
   */
  private calcCalendarCells(): CalendarCell[] {
    const cells: CalendarCell[] = this.calcDays();

    // The grid content only renders while the panel is open (and `findViewDate` seeds a month
    // before that), so the template never sees an empty day list - but `calendarCells` is still
    // read directly before any month has been viewed (e.g. tests calling `findCell` on a
    // never-opened picker), where there are no rows to attach week numbers to. Skip the week
    // pass instead of reading `cells[0]` of an empty array.
    if (this.showWeeks() && cells.length > 0) {
      // Insert week number cells, always six weeks.
      for (let i = 0; i < 6; i++) {
        const dayIx = i * 8; // Always on monday, will be used for splicing at the end.
        const firstDayOfWeek: CalendarCell = cells[dayIx]!;
        // Show week number properly at week common for both years depending on which year is in focus.
        // For example, last week of December will be (usually) 53rd week, while the first week of January
        // (exactly same week as last week of December) is always 1st week.
        const dayOfWeekIx = this.viewDate()?.getUTCFullYear() === firstDayOfWeek.year ? dayIx : dayIx + 6;
        const lastDayOfWeek: CalendarCell = cells[dayOfWeekIx]!;

        const weekNumber = TimeUtils.getWeekNumber(lastDayOfWeek.year, lastDayOfWeek.month, lastDayOfWeek.day);
        const weekCell: CalendarCell = {
          testid: `${this.ident()}_w${weekNumber}`,
          type: EnCalendarCellType.Week,
          day: weekNumber,
          month: 0,
          year: 0,
          isCurrentMonth: false,
        };
        cells.splice(dayIx, 0, weekCell);
      }
    }
    return cells;
  }

  /**
   * Build the render-ready view of one structural cell: all per-cell predicates the template
   * used to evaluate on every change-detection pass are resolved here, once per cells rebuild.
   * @param cell Structural cell built by `calcCalendarCells`.
   * @param index Position of the cell in the final grid (matches `$index` in the template and
   * drives the element id, which `aria-activedescendant` points at).
   * @param now Current LOCAL date sampled once per rebuild (drives the `today` marker).
   * @param selected Selected date, or null.
   * @returns Cell ready for plain-data template binding.
   */
  private buildCellView(cell: CalendarCell, index: number, now: Date, selected: Date | null): CalendarCellView {
    if (cell.type === EnCalendarCellType.Week) {
      return {
        ...cell,
        id: undefined,
        ariaLabel: undefined,
        ariaSelected: undefined,
        ariaDisabled: undefined,
        ariaCurrent: null,
        isWeek: true,
        notCurrent: false,
        today: false,
        selected: false,
        disabled: false,
      };
    }

    const disabled = !this.canPick(this.calendarCellToDate(cell));
    // Selection is carried in UTC parts (values are timezone-agnostic), the today marker compares
    // LOCAL calendar numbers against the cell's (UTC-carried) ones, so a day only matches when it
    // really is today for the user (see `findViewDate`).
    const isSelected = selected !== null && cell.day === selected.getUTCDate() && cell.month === selected.getUTCMonth() && cell.year === selected.getUTCFullYear();
    const isToday = cell.day === now.getDate() && cell.month === now.getMonth() && cell.year === now.getFullYear();
    return {
      ...cell,
      id: `${this.ident()}_cell_${index}`,
      // Same key the template used to resolve via the translate pipe: month names come from
      // `('dateTimePicker.month.' + month)`.
      ariaLabel: `${cell.year} ${this.translateService.instant('dateTimePicker.month.' + cell.month)} ${cell.day}`,
      ariaSelected: isSelected,
      ariaDisabled: disabled ? true : undefined,
      ariaCurrent: isToday ? 'date' : null,
      isWeek: false,
      notCurrent: !cell.isCurrentMonth,
      today: isToday,
      selected: isSelected,
      disabled,
    };
  }

  /**
   * Calculate days for calendar.
   * @returns Array of day cells.
   */
  private calcDays(): CalendarCell[] {
    const viewDate = this.viewDate();
    if (viewDate === null) return [];
    const year = viewDate.getUTCFullYear();
    const month = viewDate.getUTCMonth();

    const firstDay = TimeUtils.getUTCFirstDayOfMonth(year, month);
    const daysInMonth = TimeUtils.getUTCDaysInMonth(year, month);

    const days: CalendarCell[] = [];
    let ix = 0;

    // Padding for previous month. Note that if a month has the first day on Monday, the entire previous week will be shown.
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(year, month, -i));
      days.push({
        testid: `${this.ident()}_${ix}`,
        type: EnCalendarCellType.Date,
        day: d.getUTCDate(),
        month: d.getUTCMonth(),
        year: d.getUTCFullYear(),
        isCurrentMonth: false,
      });
      ix++;
    }

    // Current month days.
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        testid: `${this.ident()}_${ix}`,
        type: EnCalendarCellType.Date,
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
      });
      ix++;
    }

    // Padding for next month.
    const remainingCells = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(Date.UTC(year, month + 1, i));
      days.push({
        testid: `${this.ident()}_${ix}`,
        type: EnCalendarCellType.Date,
        day: d.getUTCDate(),
        month: d.getUTCMonth(),
        year: d.getUTCFullYear(),
        isCurrentMonth: false,
      });
      ix++;
    }

    return days;
  }

  /**
   * Change current month.
   * @param delta How to change month.
   */
  public changeMonth(delta: number) {
    const viewDate = this.viewDate();
    if (viewDate === null) return;
    const newDateTime = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + delta, 1));
    this.viewDate.set(newDateTime);
  }

  /**
   * Change current year.
   * @param delta How to change year.
   */
  public changeYear(delta: number) {
    const viewDate = this.viewDate();
    if (viewDate === null) return;
    const newDateTime = new Date(Date.UTC(viewDate.getUTCFullYear() + delta, viewDate.getUTCMonth(), 1));
    this.viewDate.set(newDateTime);
  }

  //

  /**
   * Converts pickable calendar cell to Date (only year, month, day).
   * @param pickableCell Pickable calendar cell.
   * @returns Date.
   */
  private calendarCellToDate(pickableCell: CalendarCell): Date {
    return new Date(Date.UTC(pickableCell.year, pickableCell.month, pickableCell.day, 0, 0, 0, 0));
  }

  /**
   * Apply one date pick to `value` (shared by click and keyboard). NEVER touches the panel -
   * callers complete the interaction (close/refocus) based on the returned outcome, because
   * mouse and keyboard finish a pick differently (see `selectCell` and `keyPressSelectDate`).
   * @param date Date to select.
   * @returns True when the value actually changed (a pick or a deselect), false on a no-op
   * (same day with `canNull` off, out-of-range day, disabled component).
   */
  private selectDate(date: Date): boolean {
    if (this.disabled()) return false;
    if (!this.canPick(date)) return false;

    const newDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const current = this.normalizedValue();

    if (
      current !== null &&
      current.getUTCFullYear() === newDate.getUTCFullYear() &&
      current.getUTCMonth() === newDate.getUTCMonth() &&
      current.getUTCDate() === newDate.getUTCDate()
    ) {
      // Selected same date again, deselect date.
      if (!this.canNull()) return false;
      this.value.set(null);
      return true;
    }

    // Select new date without touching time.
    if (current !== null) {
      newDate.setUTCHours(current.getUTCHours());
      newDate.setUTCMinutes(current.getUTCMinutes());
      newDate.setUTCSeconds(current.getUTCSeconds());
      newDate.setUTCMilliseconds(current.getUTCMilliseconds());
    }
    this.value.set(newDate);
    return true;
  }

  /**
   * User clicks cell in calendar.
   * @param calendarCell Calendar cell that was clicked.
   */
  public selectCell(calendarCell: CalendarCell) {
    if (calendarCell.type !== EnCalendarCellType.Date) return;
    // A mouse pick completes the interaction right away: close the panel and return focus to
    // the input internally (no touch - the pointer never left the component).
    if (this.selectDate(this.calendarCellToDate(calendarCell))) this.hidePanelAndRefocus();
  }

  /**
   * Check if can pick given date.
   * @param date Date.
   * @returns True if can pick, otherwise false.
   */
  private canPick(date: Date): boolean {
    if (this.dateMin() != null && date < this.dateMin()!) return false;
    if (this.dateMax() != null && date > this.dateMax()!) return false;
    return true;
  }

  // EVENTS: MOUSE HANDLERS

  /** Tracks if the next focus event is caused by a mouse click (to avoid auto-open on click). Set only when a click-caused focus event is actually coming. */
  private focusFromClick = false;

  /** True while a programmatic refocus (e.g. after closing the panel) must not auto-open the panel. */
  private suppressFocusOpen = false;

  /**
   * Handle mousedown on input: if focus is about to arrive (input not focused yet), mark it as
   * click-caused so auto-open is skipped. An already-focused input produces no focus event,
   * so nothing is marked - that is what keeps the flag from leaking (a stale flag would swallow
   * the auto-open of the next Tab into the input).
   * @param e Mouse event.
   */
  public handleMousedown(e: MouseEvent) {
    this.focusFromClick = this.document.activeElement !== e.currentTarget;
  }

  /**
   * Guard mousedown on the calendar panel. Its chrome (padding, border, gaps around the cells) is
   * not focusable, so the browser's focus fixup would move focus to <body>; the panel's focusout
   * handler would read that as "focus left the component" and close the panel while emitting a
   * spurious touch. Cancelling the default keeps focus where it was.
   * @param e Mouse event.
   */
  public handlePanelMousedown(e: MouseEvent) {
    const target = e.target;
    if (target instanceof Element && target.closest('.day') !== null) return;
    e.preventDefault();
  }

  /**
   * Handle mousedown on a calendar cell: seed the keyboard cursor onto the pressed day BEFORE
   * the click lands. The browser paints between mousedown and mouseup, so without this the
   * `.focused` ring and aria-activedescendant would flash on the stale seeded day while the
   * button is held (mirrors time-picker's `handleMousedownOption`).
   * @param calendarCell Calendar cell that was pressed.
   */
  public handleCellMousedown(calendarCell: CalendarCell): void {
    if (this.disabled()) return;
    if (calendarCell.type !== EnCalendarCellType.Date) return;
    this.focusedDate.set(this.calendarCellToDate(calendarCell));
  }

  /** Handle focus arriving on the input (e.g. via Tab). */
  public handleInputFocus() {
    if (!this.focusFromClick && !this.suppressFocusOpen && !this.isCalendarVisible() && !this.disabled()) {
      // Panel opening waits for renders internally; template event bindings never await the
      // handler, so the work is deliberately fire-and-forget (`void` marks it as such).
      void this.toggleDatePickerVisibility();
    }
    this.focusFromClick = false;
  }

  /** Handle click on the input. */
  public handleClick() {
    if (this.disabled()) return;
    this.focusFromClick = false; // Any click-caused focus already happened (focus precedes click) - never leave a stale flag behind.
    void this.toggleDatePickerVisibility();
  }

  // EVENTS: KEYBOARD HANDLERS

  /**
   * Handle keyboard on the input element.
   * @param e Keyboard event.
   */
  public onInputKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.isCalendarVisible()) void this.toggleDatePickerVisibility();
    } else if (e.key === 'Escape' && this.isCalendarVisible()) {
      e.preventDefault();
      this.hidePanel();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Default is prevented unconditionally: on a readonly input Backspace must never reach
      // the browser's legacy history-back handling (Firefox), even when canNull forbids the clear.
      e.preventDefault();
      this.keyPressClear();
    }
  }

  /** Handle keyboard on the calendar grid. */
  onGridKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    // If no focus is set yet (panel opened via click), set it now without doing anything else.
    if (this.focusedDate() === null) {
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.key === 'PageUp' ||
        e.key === 'PageDown' ||
        e.key === 'Enter' ||
        e.key === ' '
      ) {
        e.preventDefault();
        this.setupFocus(false);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.shiftFocus(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.shiftFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.shiftFocus(-7);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.shiftFocus(7);
        break;
      case 'Home': // Go to first day of month.
        e.preventDefault();
        this.focusedDate.set(new Date(Date.UTC(this.viewDate()!.getUTCFullYear(), this.viewDate()!.getUTCMonth(), 1)));
        break;
      case 'End': // Go to last day of month.
        e.preventDefault();
        this.focusedDate.set(new Date(
          Date.UTC(
            this.viewDate()!.getUTCFullYear(),
            this.viewDate()!.getUTCMonth(),
            TimeUtils.getUTCDaysInMonth(this.viewDate()!.getUTCFullYear(), this.viewDate()!.getUTCMonth()),
          ),
        ));
        break;
      case 'PageUp': // Move to previous month, or previous year when Shift is held.
        e.preventDefault();
        if (e.shiftKey) {
          this.changeYear(-1);
          this.shiftFocusedMonth(-12);
        } else {
          this.changeMonth(-1);
          this.shiftFocusedMonth(-1);
        }
        break;
      case 'PageDown': // Move to next month, or next year when Shift is held.
        e.preventDefault();
        if (e.shiftKey) {
          this.changeYear(1);
          this.shiftFocusedMonth(12);
        } else {
          this.changeMonth(1);
          this.shiftFocusedMonth(1);
        }
        break;
      case 'Tab':
        // Only Shift+Tab needs handling: native backward traversal would land on the input
        // (still inside the component) instead of leaving it. Forward Tab keeps the native
        // traversal - the grid is the last focusable element inside the picker.
        if (e.shiftKey) {
          e.preventDefault();
          this.hidePanelAndFocusPrev();
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        void this.keyPressSelectDate();
        break;
      case 'Escape':
        e.preventDefault();
        this.hidePanelAndRefocus();
        break;
      case 'Delete':
      case 'Backspace': // Clears date if allowed.
        e.preventDefault();
        if (this.keyPressClear()) this.hidePanelAndRefocus();
        break;
    }
  }

  /**
   * Helper to shift focusedDate by a number of days.
   * @param days Number of days to move by.
   */
  shiftFocus(days: number) {
    const newDate = new Date(this.focusedDate()!);
    newDate.setUTCDate(newDate.getUTCDate() + days);
    this.ensureViewShows(newDate);
    this.focusedDate.set(newDate);
  }

  /**
   * Helper to shift focusedDate by whole months, clamping the day to the target month's length.
   *
   * A plain `setUTCMonth` would overflow the day (31 January + 1 month becomes 2/3 March via
   * "Feb 31"), parking the cursor outside the shown grid - its cell and therefore the grid's
   * aria-activedescendant would disappear. The day is anchored on the 1st first so the month
   * step itself can never overflow either.
   * @param delta Month step (sign of the move). May be 12/-12 to step a whole year - the month
   * arithmetic rolls over into neighbouring years and the same clamp handles 29 February.
   */
  private shiftFocusedMonth(delta: number): void {
    const focused = this.focusedDate();
    if (focused === null) return;
    const day = focused.getUTCDate();
    const stepped = new Date(focused);
    stepped.setUTCDate(1);
    stepped.setUTCMonth(stepped.getUTCMonth() + delta);
    stepped.setUTCDate(Math.min(day, TimeUtils.getUTCDaysInMonth(stepped.getUTCFullYear(), stepped.getUTCMonth())));
    this.focusedDate.set(stepped);
  }

  /**
   * If navigation moves to a different month, update viewDate to show that month.
   * @param date The date to ensure is visible.
   */
  ensureViewShows(date: Date) {
    const viewYear = this.viewDate()!.getUTCFullYear();
    const viewMonth = this.viewDate()!.getUTCMonth();
    if (date.getUTCFullYear() !== viewYear || date.getUTCMonth() !== viewMonth) {
      this.viewDate.set(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    }
  }

  //

  /** React to selecting date via key press. */
  async keyPressSelectDate() {
    if (!this.focusedDate()) return;

    // No change (same day with canNull off): the pick is a no-op - keep the panel open for
    // another try, exactly like a blocked mouse re-click.
    if (!this.selectDate(this.focusedDate()!)) return;

    await forRender(this.injector);

    if (this.value() === null) {
      // Cleared pick: the contract is an INTERNAL refocus on the input (no touch - focus
      // never left the component).
      this.hidePanelAndRefocus();
    } else {
      // Committed pick: the interaction is complete - hand focus to the next control and let
      // the resulting focusout report the real blur (touch).
      this.hidePanelAndFocusNext();
    }
  }

  /**
   * Clear the value via Delete/Backspace.
   * Note: we test `value`, not `normalizedValue` so we can clear corrupted `Date`.
   * @returns True when a value was actually cleared.
   */
  private keyPressClear(): boolean {
    if (this.disabled() || !this.canNull() || this.value() === null) return false;
    this.value.set(null);
    return true;
  }

  /**
   * Set up focus values. Seeds from the DISPLAY selection, falling back to the viewed local date.
   * @param force If true, will override focused values. If false, will set focused values only if these are null.
   */
  private setupFocus(force: boolean) {
    if (force || this.focusedDate() === null) {
      this.focusedDate.set(this.selectedDate() ?? this.viewDate() ?? null);
    }
  }

  // UTILITIES

  /**
   * Show the calendar panel when it is closed (no-op when already visible).
   */
  public async showPanel() {
    if (this.disabled()) return;
    if (this.isCalendarVisible()) return;
    await this.toggleDatePickerVisibility();
  }

  /**
   * Hide calendar panel.
   * Also resets the pick session: the keyboard cursor drops so the closed grid does not keep
   * aria-activedescendant pointing at a hidden cell, and the next open re-seeds it from the
   * (possibly changed) selection (mirrors time-picker's cursor reset in its `hidePanel`).
   */
  public hidePanel() {
    if (!this.isCalendarVisible()) return; // already hidden

    this.isCalendarVisible.set(false);
    this.focusedDate.set(null);
  }

  /**
   * Focusing the input auto-opens the panel (see `handleInputFocus`).
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the input.
   * @returns The input that took focus, or null when the input is disabled.
   */
  public focusInput(options?: FocusOptions): HTMLElement | null {
    const inputEl = this.inputRef().nativeElement;
    if (inputEl.disabled) return null;
    inputEl.focus(options);
    return inputEl;
  }

  /**
   * Focus the control on behalf of the signal-forms `Field` directive (the optional
   * `FormUiControl.focus` contract - e.g. "focus first invalid field"). Delegates to
   * `focusInput`, so the behavior mirrors Tab: the input takes focus and its focus handler
   * auto-opens the calendar panel. No-op when disabled (the input refuses focus).
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the input.
   */
  public focus(options?: FocusOptions): void {
    this.focusInput(options);
  }

  /**
   * Hide panel and return focus to the input.
   * Focus moves BEFORE the panel is hidden so the resulting focusout reports an internal move
   * (relatedTarget is the input) instead of a leaving blur - focus must stay inside the component,
   * so no touch is reported. The refocus is programmatic, so auto-open on focus is suppressed too.
   */
  public hidePanelAndRefocus() {
    this.suppressFocusOpen = true;
    // Focus dispatch is synchronous, so the focus handler skips auto-open while the flag is set.
    // preventScroll: after a close (minute pick, Escape, deselect) the page must stay where the
    // user put it - scrolling back up to the input would yank the viewport away right after a
    // click that landed on a below-the-fold panel. Tradeoff: when the user HAS scrolled the
    // input out of view, focus lands off-screen; page position stays user-controlled (same
    // contract as the open-path focus in `toggleTimePickerVisibility`), and the next Tab
    // scrolls normally.
    this.inputRef().nativeElement.focus({ preventScroll: true });
    this.suppressFocusOpen = false;
    this.hidePanel();
  }

  /**
   * Hide panel and move focus to the next focusable element on page.
   * Focus moves BEFORE the panel is hidden: the focusout (handled by `handleFocusOut`) then sees
   * focus leaving the component, closes the panel and reports touch.
   * Anchored on the GRID, not the input: while the panel is open the input is followed by the
   * grid itself (tabindex=0), so an input-anchored step would resolve to the grid, focus would
   * never leave the component and no touch would ever be reported.
   */
  private hidePanelAndFocusNext() {
    NavUtils.FocusNext(this.calendarGridRef().nativeElement);
    this.hidePanel();
  }

  /**
   * Hide panel and move focus to the previous focusable element on page.
   * Focus moves BEFORE the panel is hidden: the focusout (handled by `handleFocusOut`) then sees
   * focus leaving the component, closes the panel and reports touch.
   */
  private hidePanelAndFocusPrev() {
    NavUtils.FocusPrev(this.inputRef().nativeElement);
    this.hidePanel();
  }

  /**
   * Handle focus leaving the picker entirely (e.g. Tab out of grid). It closes calendar panel and,
   * unless focus only moved inside the component, reports the control as touched.
   * Note the panel visibility is intentionally not checked: internal helpers hide the panel before
   * or after focus moves, so a closed panel must still report touch when focus really left.
   * @param e Focus event.
   */
  public handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget;
    if (next instanceof Node && this.pickerRef().nativeElement.contains(next)) return;
    // The host's hidden label target (forwarded through the `labelTarget` input) is a sibling of
    // this component - it lives on the parent DateTimePicker's root - so containment misses it.
    // Focus landing there means label activation is about to redirect straight back into this
    // component (it always pairs focus with a click), so it reads as an internal move, not a
    // user blur. Identity comparison keeps other components' hidden-label buttons (same class,
    // different control) counting as a real blur.
    if (next instanceof Element && next === this.labelTarget()) return;
    this.hidePanel();
    if (this.disabled()) return; // Programmatic close (disabled while focused), not a user blur.
    this.touch.emit();
  }
}
