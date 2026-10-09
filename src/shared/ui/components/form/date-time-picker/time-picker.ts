import { Component, effect, inject, signal, computed, viewChildren, ElementRef, Signal, WritableSignal } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { TimeUtils } from '@/shared/utils/time/time-utils';
import { forRender } from '@/shared/utils/render/after-render';
import { popupPanelPlacement } from '@/shared/ui/components/form/popup-panel/popup-panel-placement';
import { PopupInputBase } from '@/shared/ui/components/form/popup-panel/popup-input-base';

/**
 * Page size used for PageUp/PageDown when the column cannot be measured (no layout yet, so
 * the visible-height division below yields 0/NaN). Keeps paging usable instead of degrading
 * to a no-op; real browsers always measure successfully while the panel is open.
 */
const fallbackPageStep = 5;

/**
 * Session state of a single clock column while the panel is open:
 * - a number - the option picked in THIS session;
 * - `'untouched'` - no pick yet, so the column highlights the committed value's part (if any);
 * - `'discarded'` - the user un-picked their own pick (re-click, canNull only), i.e. cleared the column.
 * The committed `value` never changes while the panel is open - it is written only when both
 * columns resolve (see `TimePicker.tryCommit`).
 */
type ColumnSession = number | 'untouched' | 'discarded';

/**
 * What applying one pick did (see `TimePicker.applyPick`):
 * - `'committed'` - both columns are picked, so `value` was written;
 * - `'cleared'` - both columns are discarded, so `value` was set to null;
 * - `'picked'` / `'unpicked'` - only the pressed column changed, the session stays partial;
 * - `null` - nothing happened (component disabled).
 */
type PickOutcome = 'committed' | 'cleared' | 'picked' | 'unpicked' | null;

/** Identifies one of the two clock columns: the left (hours) or the right (minutes) listbox. */
type ColumnKey = 'hour' | 'minute';

/**
 * Everything that differs between the hour and the minute column. The pick, keyboard, scroll
 * and render logic is written once and parameterized by this descriptor (see
 * `TimePicker.columns`), so a rule (wrap, paging, focus flow) can never exist in only one
 * column and silently drift apart in the other.
 */
interface ClockColumn {
  /** Identifies the column in handlers, `activeColumn` and the session state. */
  readonly key: ColumnKey;
  /** Last option value: 23 for hours, 59 for minutes - bounds every cursor move. */
  readonly max: number;
  /** Element-id / data-testid suffix of the options: `_opt_h14` vs `_opt_m30`. */
  readonly suffix: 'h' | 'm';
  /** Column-specific class on every option (test/styling hook, e.g. `.time-minute`). */
  readonly optionClass: string;
  /** Option values in display order. */
  readonly items: readonly number[];
  /** Column header text and the listbox's accessible name (same translation key). */
  readonly label: Signal<string>;
  /** Keyboard-focus cursor of the column. */
  readonly focused: WritableSignal<number | null>;
  /** Currently viewed (local-time) part driving the `curr` marker. */
  readonly view: WritableSignal<number | null>;
  /** Highlighted option: this session's pick ?? the committed value's part; null when discarded. */
  readonly selected: Signal<number | null>;
  /** aria-activedescendant of the listbox; undefined while the column is not the active one. */
  readonly activeDesc: Signal<string | undefined>;
  /** Arrow key that moves keyboard focus to the OTHER column (the mirrored pair). */
  readonly switchKey: 'ArrowRight' | 'ArrowLeft';
  /** The scrollable listbox element. */
  readonly element: () => HTMLElement;
}

/**
 * Derive a column's highlighted option from its session and the committed value's part.
 * @param session The column's session state.
 * @param committed The committed value's hour/minute, or null when no value is set.
 * @returns Highlighted option, or null when the column was discarded/empty.
 */
function highlightOf(session: ColumnSession, committed: number | null): number | null {
  if (typeof session === 'number') return session;
  if (session === 'discarded') return null;
  return committed;
}

/**
 * This is a time picker. Uses the `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="time".
 * Note it is timezone-agnostic. It is up to you to adjust the result to a timezone etc. as needed.
 * Values are read/written through UTC accessors, but the default "current time" highlight and
 * keyboard/scroll seed (used when no value is set) come from the browser's local timezone, and
 * a time picked with no prior value is written onto the LOCAL calendar date (UTC-anchored), so
 * it always lands on the day the user sees as today.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Can select time: hour and minute are picked SEPARATELY, in any order, in one panel session.
 *   The panel closes as soon as BOTH columns are picked (or, with canNull, both are un-picked)
 *   and only that completed selection commits the value - until then the input keeps showing
 *   the previous time. Closing with a partial pick (Escape, outside press, focusout) discards
 *   the pick; an incomplete session never changes the value.
 * - Can disable or mark as invalid.
 * - Keyboard navigation supported:
 *   - if clock panel closed, open it with enter, space or down arrow
 *   - change hour/minute via arrows
 *   - home/end: jump to beginning/end of list
 *   - page up/down: jump a whole visible page, clamping at the list ends and wrapping to the
 *     opposite end only when already standing on the end item
 *   - enter/space (pick hour/minute; the panel closes when the pick completes the time)
 *   - delete/backspace: clear the value (only when canNull)
 *   - esc (close panel).
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attributes of the input and panel (data-testid, aria-controls, aria-activedescendant etc.). Always provided by parent DateTimePicker, this component is not meant to be used alone.
 * - label - Id of an external element (usually `<label>`) used for `aria-labelledby`; when set, it names the input instead of the `aria-label` fallback. The id must match an element in the document - a dangling reference silently empties the input's name, so dev mode warns on the console (see `warnDanglingLabel`). Optional.
 * - qualifyLabel - If true and `label` is set, appends a hidden "Time" qualifier id to `aria-labelledby`, so both sub-fields stay distinguishable when DateTimePicker runs in `datetime` mode. Always provided by parent DateTimePicker. Optional, default false.
 * - container - Root element of the host DateTimePicker wrapper. It holds this sub-picker, the sibling sub-picker and the wrapper's hidden label-activation target, so it is the real component boundary: focus moving to anything inside it reads as an internal move instead of a blur. Always provided by parent DateTimePicker. Optional, default null.
 * - canNull - If true, allow deselecting time. Optional, default is false.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component (focus left it), regardless of panel visibility.
 *
 * Special (set indirectly):
 * - required - If true, component is required. Default is false.
 * - disabled - If true, acts as disabled component. Default is false.
 * - invalid - If true, shows component as having invalid state. Visual only. Default is false.
 */
@Component({
  selector: 'time-picker',
  styleUrl: './time-picker.css',
  templateUrl: './time-picker.html',
})
export class TimePicker extends PopupInputBase<Date> {
  /** For programmatic translations. */
  private readonly translateService = inject(TranslateService);

  /** List of hours. We use a full 24-hour clock. */
  public hours = Array.from({ length: 24 }, (_, i) => i);
  /** List of minutes. */
  public minutes = Array.from({ length: 60 }, (_, i) => i);

  // REFERENCES

  /**
   * Template refs of the two clock listboxes, collected in creation order (hour first, minute
   * second - the order of `columnList`). Both listboxes render from the single column block in
   * the template, so they share one ref name; `hourRef`/`minuteRef` re-expose them positionally.
   */
  private readonly columnElements = viewChildren<ElementRef<HTMLDivElement>>('colRef');

  /**
   * Reference to the hour listbox (first column). Throws when the view is not rendered yet,
   * the same contract the previous `viewChild.required` had.
   */
  public hourRef = computed(() => this.columnElementAt(0));
  /** Reference to the minute listbox (second column); see `hourRef`. */
  public minuteRef = computed(() => this.columnElementAt(1));

  /**
   * The listbox element ref of a column by its display position (0 = hour, 1 = minute).
   * @param index Position of the column in `columnList`.
   * @returns The element ref of that column.
   */
  private columnElementAt(index: number): ElementRef<HTMLDivElement> {
    const ref = this.columnElements()[index];
    if (ref === undefined) throw new Error('TimePicker: clock column is not rendered yet.');
    return ref;
  }

  // SIGNALS

  /** Indicates visibility of clock panel; domain-named alias of the shared `panelVisible`. */
  public readonly isClockVisible = this.panelVisible;
  /** Keyboard-focus hour index. Set when panel opens, updated via arrow navigation. */
  public focusedHour = signal<number | null>(null);
  /** Keyboard-focus minute index. Set when panel opens, updated via arrow navigation. */
  public focusedMinute = signal<number | null>(null);
  /** Which listbox column currently has keyboard focus. */
  public activeColumn = signal<ColumnKey>('hour');

  /** Currently viewed hour. */
  public viewHour = signal<number | null>(null);
  /** Currently viewed minute. */
  public viewMinute = signal<number | null>(null);

  /**
   * Pick made in each column during the CURRENT panel session (see `ColumnSession`).
   * Starts `'untouched'` on open and is reset in `hidePanel`, so a close without a complete
   * selection silently discards the pick - `value` is only written when both columns resolve.
   */
  private readonly sessions: Record<ColumnKey, WritableSignal<ColumnSession>> = {
    hour: signal<ColumnSession>('untouched'),
    minute: signal<ColumnSession>('untouched'),
  };

  // COMPUTED

  /**
   * Currently highlighted hour in the column: this session's pick when one was made, the
   * committed value's hour while the column is `'untouched'`, nothing after it was discarded.
   * Drives `.selected`/`aria-selected`, the scroll target on open and the keyboard seeds.
   */
  public selectedHour = computed<number | null>(() =>
    highlightOf(this.sessions.hour(), this.normalizedValue()?.getUTCHours() ?? null));

  /** Currently highlighted minute in the column; mirrors `selectedHour`. */
  public selectedMinute = computed<number | null>(() =>
    highlightOf(this.sessions.minute(), this.normalizedValue()?.getUTCMinutes() ?? null));

  /**
   * Compute currently displayed time value in time input. Always a string (never null), so
   * the `[value]` binding never writes null into the input.
   */
  public displayTimeValue = computed(() => TimeUtils.formatUTCTime(this.normalizedValue()));
  /**
   * Compute placeholder value for time input. Same rule as the value: no decorative glyph, so
   * the format hint is announced (and read) as plain `hh:mm`.
   */
  public placeholderTimeValue = computed(() => this.translateService.instant('dateTimePicker.placeholder.time'));

  // Static chrome labels. Resolved through `instant` inside computeds instead of the impure
  // `translate` pipe: same output (including the raw-key fallback when a translation is missing)
  // and same language reactivity, but nothing is re-evaluated on change-detection passes that
  // don't touch the language. One computed per key, shared where the key is reused.

  /** Input `aria-label` fallback and hidden qualifier text (both carry the sub-field name). */
  public readonly timeLabel = computed(() => this.translateService.instant('dateTimePicker.time'));
  /** Accessible name of the clock dialog. */
  public readonly panelLabel = computed(() => this.translateService.instant('dateTimePicker.timePicker'));
  /** Hour column header text and the hour listbox's accessible name (same key). */
  public readonly hourLabel = computed(() => this.translateService.instant('dateTimePicker.hour'));
  /** Minute column header text and the minute listbox's accessible name (same key). */
  public readonly minuteLabel = computed(() => this.translateService.instant('dateTimePicker.minute'));

  /** Name of this component for dev-only diagnostics (see `PopupInputBase.componentName`). */
  protected readonly componentName = 'time-picker';

  // COLUMNS

  /**
   * Single source of truth for the two clock columns: option lists, keyboard bounds, id
   * suffixes and the per-column signals every shared handler is parameterized by. The template
   * renders both listboxes from `columnList` (the same objects, in display order), so the
   * columns can only differ where this descriptor says they do.
   */
  private readonly columns: Record<ColumnKey, ClockColumn> = {
    hour: {
      key: 'hour',
      max: 23,
      suffix: 'h',
      optionClass: 'time-hour',
      items: this.hours,
      label: this.hourLabel,
      focused: this.focusedHour,
      view: this.viewHour,
      selected: this.selectedHour,
      activeDesc: computed(() => this.activeDescFor('hour')),
      switchKey: 'ArrowRight',
      element: () => this.hourRef().nativeElement,
    },
    minute: {
      key: 'minute',
      max: 59,
      suffix: 'm',
      optionClass: 'time-minute',
      items: this.minutes,
      label: this.minuteLabel,
      focused: this.focusedMinute,
      view: this.viewMinute,
      selected: this.selectedMinute,
      activeDesc: computed(() => this.activeDescFor('minute')),
      switchKey: 'ArrowLeft',
      element: () => this.minuteRef().nativeElement,
    },
  };

  /** Clock columns in display order (hours, minutes) - what the template iterates over. */
  public readonly columnList: readonly ClockColumn[] = [this.columns.hour, this.columns.minute];

  constructor() {
    super(popupPanelPlacement);

    // Watch `isClockVisible` field: react on panel opening.
    effect(() => {
      if (this.isClockVisible()) void this.scrollToSelected();
    });
  }

  // PANEL HOOKS (PopupInputBase)

  /**
   * Seed the viewed local time and the keyboard cursor on every open, before the panel first
   * renders: focus always moves into the hour listbox (see `focusPanelTarget`), so the active
   * option must exist right away.
   */
  protected prepareOpen(): void {
    this.findViewTime();
    this.setupFocus(true);
    this.activeColumn.set('hour');
  }

  /** Keyboard focus enters the hour listbox so the user can navigate immediately. */
  protected focusPanelTarget(): HTMLElement {
    return this.hourRef().nativeElement;
  }

  /**
   * Reset the clock session when the panel hides: cursors drop so the closed panel does not
   * keep aria-activedescendant pointing at hidden options, an incomplete pick is silently
   * discarded (the session is what commits, see `tryCommit`), and the next open re-seeds from
   * the (possibly changed) selection. The visible flag is already cleared by `hidePanel`.
   */
  protected resetOnClose(): void {
    for (const col of Object.values(this.columns)) {
      col.focused.set(null);
      this.sessions[col.key].set('untouched');
      col.view.set(null);
    }
  }

  // GENERAL

  /**
   * Find and set current time in the browser's local timezone.
   * Drives the `curr` marker (always), and - when no value is set - the scroll target and the
   * keyboard focus seed, so opening the picker without a value pre-selects local time.
   * Values themselves stay timezone-agnostic (UTC-carried), see class doc.
   */
  private findViewTime() {
    const date = new Date();
    this.viewHour.set(date.getHours());
    this.viewMinute.set(date.getMinutes());
  }

  /**
   * The column opposite to the given one (the picker has exactly two).
   * @param column Starting column.
   * @returns The other column's key.
   */
  private otherColumn(column: ColumnKey): ColumnKey {
    return column === 'hour' ? 'minute' : 'hour';
  }

  /**
   * aria-activedescendant value for a listbox. Gated on `activeColumn`: the attribute belongs
   * only to the listbox that holds DOM focus (mirrors the `.focused` ring gating in the
   * template), otherwise the inactive column would keep announcing an active option.
   * @param column Which listbox to compute the attribute for.
   * @returns The active option's id, or undefined when the column is not keyboard-active.
   */
  private activeDescFor(column: ColumnKey): string | undefined {
    const col = this.columns[column];
    if (this.activeColumn() !== column || col.focused() === null) return undefined;
    return `${this.ident()}_opt_${col.suffix}${col.focused()}`;
  }

  /**
   * Apply one pick (click or Enter) to the given column's session and, when it completes the
   * session, commit `value` via `tryCommit`. NEVER writes `value` for a partial pick - the
   * input keeps showing the previous time until both columns resolve.
   * Own-pick rules: from `'untouched'` any option is picked (even one equal to the value's
   * part - re-picking the existing value counts, so changing the time stays a two-click
   * action); pressing the option equal to the column's OWN pick toggles it to `'discarded'`
   * when `canNull`, otherwise it is a no-op. A `'discarded'` column re-picks normally.
   * Also keeps the keyboard cursor in agreement with the pick (covers clicks that arrive
   * without a prior mousedown on the option, e.g. synthesized/touch events).
   * @param column Which column the pick belongs to.
   * @param picked Hour or minute value of the picked option.
   * @returns What the pick did; null when the component is disabled.
   */
  private applyPick(column: ColumnKey, picked: number): PickOutcome {
    if (this.disabled()) return null;

    const col = this.columns[column];
    col.focused.set(picked);

    const session = this.sessions[column];
    const next: ColumnSession = session() === picked && this.canNull() ? 'discarded' : picked;
    session.set(next);

    const completed = this.tryCommit();
    if (completed !== null) return completed;
    return next === 'discarded' ? 'unpicked' : 'picked';
  }

  /**
   * Commit `value` when the session is complete and report the outcome.
   * Completes on TWO PICKS (any order) - writes the chosen hour and minute onto the current
   * value's date (or, when no value is set, onto the LOCAL calendar date anchored at UTC
   * midnight - the same convention as `DatePicker.findViewDate`, so a time picked on the
   * user's today never lands on the already-passed/next UTC date), zeroing sub-minute parts;
   * an unchanged result keeps the value's identity so the form is not notified spuriously.
   * Completes on TWO DISCARDS (both columns un-picked, only reachable with canNull) - writes
   * null. A partial session returns null and leaves `value` untouched: the panel stays open,
   * and any close without completion (Escape, outside press, focusout, disabling) resets the
   * session in `hidePanel` without committing. This is the ONLY place a pick changes `value`.
   * @returns `'committed'`/`'cleared'` when `value` was written, null when still partial.
   */
  private tryCommit(): 'committed' | 'cleared' | null {
    const h = this.sessions.hour();
    const m = this.sessions.minute();

    if (typeof h === 'number' && typeof m === 'number') {
      const current = this.normalizedValue();
      // Seed the date from the LOCAL calendar date, never from the UTC calendar date of the
      // current instant: `setUTCHours` below keeps the base's UTC date, and near local midnight
      // that is the previous/next day for the user. The calendar's `today` marker and its
      // `findViewDate` seed both work off the local day, so a UTC-based seed would make the
      // committed date disagree with the day the user sees as today.
      const localToday = new Date();
      const date = current !== null ? new Date(current) : new Date(Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate()));
      date.setUTCHours(h, m, 0, 0); // Also zeroes seconds/milliseconds: sub-minute parts must never leave the component.
      if (current === null || date.getTime() !== current.getTime()) this.value.set(date);
      return 'committed';
    }

    if (h === 'discarded' && m === 'discarded') {
      if (this.value() !== null) this.value.set(null);
      return 'cleared';
    }

    return null;
  }

  /**
   * Scroll the given option to the vertical center of its own `.clock-column` container.
   * Deliberately avoids `Element.scrollIntoView()`: it aligns the option against the viewport and
   * therefore scrolls EVERY scrollable ancestor, including the page - opening the panel near a
   * viewport edge would jump the whole document out from under the user. Writing `scrollTop`
   * touches only the column.
   * @param column The scrollable clock column containing the option.
   * @param option The option element to center.
   */
  private centerOptionInColumn(column: HTMLElement, option: HTMLElement): void {
    const columnRect = column.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();

    // Option's offset within the column's content; adding the current scroll keeps it valid
    // regardless of where the column is currently scrolled to.
    const optionTop = column.scrollTop + (optionRect.top - columnRect.top);
    const centeredTop = optionTop + option.offsetHeight / 2 - column.clientHeight / 2;

    column.scrollTop = Math.max(0, centeredTop); // Upper bound is clamped natively by the browser.
  }

  /** Scroll to selected hour and minute. */
  private async scrollToSelected() {
    await forRender(this.injector);

    // If time is not selected, use current time as scroll target.
    const targetClass = this.normalizedValue() === null ? '.curr' : '.selected';
    for (const col of Object.values(this.columns)) {
      const column = col.element();
      const option = column.querySelector<HTMLElement>(targetClass);
      if (option) this.centerOptionInColumn(column, option);
    }
  }

  /**
   * Scroll the given column so the option with the given value is revealed (centered).
   * @param column Which column to scroll.
   * @param value Hour or minute to reveal, or null to do nothing.
   */
  private async scrollColumnIntoView(column: ColumnKey, value: number | null) {
    if (value === null) return;
    await forRender(this.injector);

    const col = this.columns[column];
    const element = col.element();
    const option = element.querySelector<HTMLElement>(`[id="${this.ident()}_opt_${col.suffix}${value}"]`);
    if (option) this.centerOptionInColumn(element, option);
  }

  /**
   * Page size, in options, for one PageUp/PageDown press: how many options fit in the column's
   * visible height, minus one so the edge of the previous page stays visible as context.
   * @param column The scrollable clock column.
   * @returns Number of options a page press moves, always at least 1.
   */
  private pageStep(column: HTMLElement): number {
    const optionHeight = column.querySelector<HTMLElement>('.time-item')?.offsetHeight ?? 0;
    const visible = Math.floor(column.clientHeight / optionHeight);

    if (!Number.isFinite(visible) || visible <= 0) return fallbackPageStep;
    return Math.max(1, visible - 1);
  }

  /**
   * Move a listbox keyboard cursor by one page with boundary wrap.
   * The move always clamps to the list ends first: a press that reaches an end stops there,
   * and only the NEXT press - cursor already standing on the end item - wraps to the opposite
   * end, landing exactly on it rather than on a step-aligned value.
   * Step example with 5 cells visible: step is 4, so 1 2 [3] 4 5 becomes 4 5 [6] 7 8 - one
   * cell of the previous page stays visible as context, and no values are skipped.
   * Clamp example with step 12 on minutes: 30 -> 42 -> 54 -> 59 (clamp) -> 0 (wrap) -> 12.
   * A null cursor is only seeded (no movement), mirroring how the Arrow-key cases treat it.
   * @param current Current cursor value, or null when nothing is focused yet.
   * @param direction 1 to page down, -1 to page up.
   * @param max Last index of the column (23 for hours, 59 for minutes).
   * @param step Page size coming from `pageStep`.
   * @param seed Value used when `current` is null (selected ?? viewed).
   * @returns New cursor value.
   */
  private pageMove(current: number | null, direction: 1 | -1, max: number, step: number, seed: number | null): number {
    if (current === null) return seed ?? 0;

    const clamped = Math.min(max, Math.max(0, current + direction * step));
    if (clamped !== current) return clamped;

    // Already on the boundary: wrap straight to the opposite end.
    return direction > 0 ? 0 : max;
  }

  // EVENTS: MOUSE HANDLERS

  /**
   * Handle mousedown on an hour/minute option: seed the keyboard cursor onto the pressed
   * option and mark its column active BEFORE the click lands. The browser's default mousedown
   * action focuses the column (flipping `activeColumn`) and the page can paint in the gap up
   * to mouseup, so without this the `.focused` ring and `aria-activedescendant` would flash on
   * the stale cursor (previous selection, or the seeded default when no value is set). Runs
   * before the column's focus handler, which then re-asserts the same active column.
   * @param column Which column the option belongs to.
   * @param value Hour or minute value of the pressed option.
   */
  public handleMousedownOption(column: ColumnKey, value: number): void {
    if (this.disabled()) return;
    this.activeColumn.set(column);
    this.columns[column].focused.set(value);
  }

  /**
   * Guard mousedown on the clock panel. Its chrome (padding, border, gaps around the columns) is
   * not focusable, so the browser's focus fixup would move focus to <body>; the panel's focusout
   * handler would read that as "focus left the component" and close the panel while emitting a
   * spurious touch. Cancelling the default keeps focus where it was (inside a .clock-column).
   * Presses inside a .clock-column are left alone: they focus that column (already inside the
   * component) and must keep native scrollbar/text-drag behaviour.
   * The column header sits ABOVE the scroller (outside the .clock-column), so a press on it gets
   * no native column focus: the default is cancelled here and the header's own column is focused
   * instead - same outcome as before the header moved out of the scroller.
   * @param e Mouse event.
   */
  public handlePanelMousedown(e: MouseEvent) {
    const target = e.target;
    if (target instanceof Element && target.closest('.clock-column') !== null) return;
    e.preventDefault();

    const header = target instanceof Element ? target.closest('.column-header') : null;
    // preventScroll: the default was cancelled above, so nothing native would scroll either -
    // this programmatic focus must not move the page right after the user's press (the panel
    // can sit below the fold, see the open-path focus in `togglePanel`).
    header?.closest('.clock-column-group')?.querySelector<HTMLElement>('.clock-column')?.focus({ preventScroll: true });
  }

  /**
   * Handle click on an hour/minute option: apply the pick to the session and close the clock
   * panel ONLY when the pick completes the session (both columns picked in any order, or both
   * un-picked with canNull). A partial pick keeps the panel open - the other column still has
   * to be picked; a close WITHOUT completion (Escape, outside press, focusout) silently
   * discards it. Focus returns to the input (the panel's focus owner) before the panel is
   * hidden, so the resulting focusout stays internal and no touch is reported - touch fires
   * only when focus really leaves the component, same as on Escape.
   * @param column Which column the pick belongs to.
   * @param value Clicked hour or minute.
   */
  public handleOptionClick(column: ColumnKey, value: number) {
    if (this.disabled()) return;
    const outcome = this.applyPick(column, value);
    if (outcome === 'committed' || outcome === 'cleared') this.hidePanelAndRefocus();
  }

  // EVENTS: KEYBOARD HANDLERS

  /**
   * Handle keyboard on a clock listbox. The column's descriptor carries everything that
   * differs between hours and minutes (cursor bounds, keyboard seed, scroll target, the arrow
   * key that crosses to the other column), so navigation, paging, picking and the
   * clear/escape/tab behaviour exist once for both columns.
   * @param column Which listbox received the key press.
   * @param e Keyboard event.
   */
  public onColumnKeydown(column: ColumnKey, e: KeyboardEvent) {
    if (this.disabled()) return;
    const col = this.columns[column];

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        col.focused.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : col.max;
          return col.selected() ?? col.view() ?? 0;
        });
        void this.scrollColumnIntoView(column, col.focused());
        break;
      case 'ArrowDown':
        e.preventDefault();
        col.focused.update((currVal) => {
          if (currVal !== null) return currVal < col.max ? currVal + 1 : 0;
          return col.selected() ?? col.view() ?? 0;
        });
        void this.scrollColumnIntoView(column, col.focused());
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        // Only the column's own switch key acts (hour: ArrowRight, minute: ArrowLeft - the
        // mirrored pair); the other arrow key stays a no-op without preventDefault, exactly
        // as before the two handlers were merged.
        if (e.key === col.switchKey) {
          e.preventDefault();
          void this.keyPressSwitchColumn();
        }
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        col.focused.set(0);
        void this.scrollColumnIntoView(column, 0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        col.focused.set(col.max);
        void this.scrollColumnIntoView(column, col.max);
        break;
      case 'PageDown': // Page forward; wraps to the top only when already standing on the last item.
        e.preventDefault(); // Without it the browser scrolls the column natively, leaving the cursor behind.
        col.focused.set(this.pageMove(col.focused(), 1, col.max,
          this.pageStep(col.element()), col.selected() ?? col.view() ?? 0));
        void this.scrollColumnIntoView(column, col.focused());
        break;
      case 'PageUp': // Page backward; wraps to the bottom only when already standing on the first item.
        e.preventDefault();
        col.focused.set(this.pageMove(col.focused(), -1, col.max,
          this.pageStep(col.element()), col.selected() ?? col.view() ?? 0));
        void this.scrollColumnIntoView(column, col.focused());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        void this.keyPressSelect(column);
        break;
      case 'Delete':
      case 'Backspace': // Clearing completes the interaction, so the panel closes.
        e.preventDefault();
        if (this.keyPressClear()) this.hidePanelAndRefocus();
        break;
      case 'Escape':
        e.preventDefault();
        this.hidePanelAndRefocus();
        break;
      case 'Tab':
        // One backwards press must leave the whole component (mirrors forward Tab, which skips
        // the input because it sits behind the panel).
        if (e.shiftKey) {
          e.preventDefault();
          this.hidePanelAndFocusPrev();
        }
        break;
    }
  }

  /** React to column change via key press. */
  private async keyPressSwitchColumn() {
    if (this.focusedHour() === null || this.focusedMinute() === null) {
      // Just show focus without switching column.
      this.setupFocus(false);
      return;
    }

    const next = this.otherColumn(this.activeColumn());
    this.activeColumn.set(next);
    await forRender(this.injector);
    // preventScroll: same reasoning as the open-path focus in `togglePanel` - the panel may
    // sit below the fold, and revealing it is the USER's job, not focus's. Reveal inside the
    // column is handled by `scrollColumnIntoView` (column scrollTop only), so nothing here
    // needs a viewport scroll.
    this.columns[next].element().focus({ preventScroll: true });
  }

  /**
   * React to selecting the focused option of a column via Enter/space.
   * A completing pick/discard closes the panel - a committed time moves focus on to the next
   * element, a cleared value returns to the input. A partial pick hands focus to the OTHER
   * column so the flow can continue there (either column may be the completing pick, selection
   * order is free); a partial discard stays in the pressed column being managed.
   * @param column Which column the selection key was pressed in.
   */
  private async keyPressSelect(column: ColumnKey) {
    const col = this.columns[column];
    const focused = col.focused();
    if (focused === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    const outcome = this.applyPick(column, focused);
    await forRender(this.injector);

    if (outcome === 'committed') {
      this.hidePanelAndFocusNext();
      return;
    }
    if (outcome === 'cleared') {
      this.hidePanelAndRefocus();
      return;
    }
    if (outcome === null || outcome === 'unpicked') return;

    // Partial pick: continue the flow in the other column.
    const other = this.columns[this.otherColumn(column)];
    this.activeColumn.set(other.key);
    if (other.focused() === null) {
      other.focused.set(other.selected() ?? other.view() ?? null);
    }
    await forRender(this.injector);
    // preventScroll: same reasoning as in `keyPressSwitchColumn` - a below-the-fold panel must
    // not drag the viewport when a pick advances the flow.
    other.element().focus({ preventScroll: true });
  }

  /**
   * Set up focus values on both columns. Seeds from the DISPLAY selection (session pick ??
   * committed value), falling back to the viewed local time.
   * @param force If true, will override focused values. If false, will set focused values only if these are null.
   */
  private setupFocus(force: boolean) {
    for (const col of Object.values(this.columns)) {
      if (force || col.focused() === null) {
        col.focused.set(col.selected() ?? col.view() ?? null);
      }
    }
  }
}
