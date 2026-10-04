import { Component, effect, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef, DOCUMENT } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService } from '@ngx-translate/core';

import { TimeUtils } from '@/core/utils/TimeUtils';
import { NavUtils } from '@/core/utils/NavUtils';
import { WindowUtils, type PanelPlacement, type PanelInsets } from '@/core/utils/WindowUtils';
import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';
import { forRender } from '@/shared/utils/render/after-render';

/**
 * Placement of the clock panel relative to its input - single source of truth for both the
 * baseline reset on open and the flip decision (see `WindowUtils.resolvePanelPlacement`).
 * `flipY` anchors the panel's BOTTOM to the input's TOP (`bottom: 100%`), NOT `bottom: 0`:
 * `bottom: 0` would pin the panel's bottom to the input's bottom, so the panel would sit
 * ON TOP of the input and intercept its clicks.
 * The anchor is the picker root - it is the positioned ancestor the panel's `top/bottom`
 * percentages resolve against. When the panel fits on neither side of the root, it stays
 * below (baseline) so the user can scroll down to it.
 * Note: both flips rely on `.clock-container` having zero right/bottom margins
 * (`--datetimepicker-clock-offset` in styles/var/components-custom.css).
 */
const panelPlacement: PanelPlacement = {
  baseline: { top: '100%', bottom: 'auto', left: '0', right: 'auto' },
  flipX: { left: 'auto', right: '0' },
  flipY: { top: 'auto', bottom: '100%' },
};

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

/**
 * This is a time picker. Uses `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="time".
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Values are read/written through UTC accessors, but the default "current time" highlight and
 * keyboard/scroll seed (used when no value is set) come from the browser's local timezone.
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
 * - labelTarget - The host's hidden label-activation target, which lives OUTSIDE this component's subtree (a sibling on the parent's root). Focus landing on it during label activation reads as an internal move instead of a blur. Always provided by parent DateTimePicker. Optional, default null.
 * - canNull - If true, allow deselecting date. Optional, default is false.
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
export class TimePicker implements FormValueControl<Date | null> {
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
  /** If true, append a hidden "Time" qualifier to the accessible name (see `nameRefs`). */
  public qualifyLabel = input<boolean>(false);
  /** Host's hidden label-activation target. */
  public labelTarget = input<Element | null>(null);
  /** If true, allow deselecting: re-clicking the picked option un-picks its column; the value is cleared (and the panel closes) once both columns are un-picked. */
  public canNull = input<boolean>(false);
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component (focus left it), regardless of panel visibility. */
  public touch = output<void>();

  /** List of hours. We use full 24-hour clock. */
  public hours = Array.from({ length: 24 }, (_, i) => i);
  /** List of minutes. */
  public minutes = Array.from({ length: 60 }, (_, i) => i);

  // REFERENCES

  /** Root focusable element. */
  private pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to the text input. */
  private inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');
  /** Reference to clock panel. */
  public clockPanelRef = viewChild.required<ElementRef<HTMLDivElement>>('clockPanelRef');
  /** Reference to hour listbox. */
  public hourRef = viewChild.required<ElementRef<HTMLDivElement>>('hourRef');
  /** Reference to minute listbox. */
  public minuteRef = viewChild.required<ElementRef<HTMLDivElement>>('minuteRef');

  // SIGNALS

  /**
   * Value of the input's `aria-labelledby`: the external label id, plus (when `qualifyLabel`)
   * this sub-field's hidden qualifier id; null when no label is set (the input then falls back
   * to `aria-label`). The qualified name reads "<label> Time" - the label text stays a prefix,
   * so the visible label remains inside the accessible name (WCAG 2.5.3) for voice control.
   */
  public readonly nameRefs = computed<string | null>(() => {
    const label = this.label();
    if (label === '') return null;
    return this.qualifyLabel() ? `${label} ${this.ident()}_qualifier` : label;
  });

  /** Indicates visibility of clock panel. */
  public readonly isClockVisible = signal(false);
  /** Keyboard-focus hour index. Set when panel opens, updated via arrow navigation. */
  public focusedHour = signal<number | null>(null);
  /** Keyboard-focus minute index. Set when panel opens, updated via arrow navigation. */
  public focusedMinute = signal<number | null>(null);
  /** Which listbox column currently has keyboard focus. */
  public activeColumn = signal<'hour' | 'minute'>('hour');

  /** Currently viewed hour. */
  public viewHour = signal<number | null>(null);
  /** Currently viewed minute. */
  public viewMinute = signal<number | null>(null);

  /**
   * Pick made in the hour column during the CURRENT panel session (see `ColumnSession`).
   * Starts `'untouched'` on open and is reset in `hidePanel`, so a close without a complete
   * selection silently discards the pick - `value` is only written when both columns resolve.
   */
  private hourSession = signal<ColumnSession>('untouched');
  /** Pick made in the minute column during the CURRENT panel session; see `hourSession`. */
  private minuteSession = signal<ColumnSession>('untouched');

  /**
   * Inline style of the clock panel (see `panelPlacement`). All four insets are managed
   * TOGETHER: the CSS default (`top: 100%`, `left: 0`) can be overridden inline, so a stale
   * inline `top: auto` from a previous upward flip would otherwise persist, and having both
   * `top` and `bottom` non-auto would over-constrain the absolutely positioned panel.
   * Reset to the baseline on every open before measuring.
   */
  public containerStyle = signal<PanelInsets>(panelPlacement.baseline);

  // COMPUTED

  /** `value` when it carries a real time, otherwise null. Prevents showing NaN on invalid Date and similar bugs. */
  private normalizedValue = computed<Date | null>(() => {
    const value = this.value();
    return value !== null && !Number.isNaN(value.getTime()) ? value : null;
  });

  /**
   * Currently highlighted hour in the column: this session's pick when one was made, the
   * committed value's hour while the column is `'untouched'`, nothing after it was discarded.
   * Drives `.selected`/`aria-selected`, the scroll target on open and the keyboard seeds.
   */
  public selectedHour = computed<number | null>(() => {
    const session = this.hourSession();
    if (typeof session === 'number') return session;
    if (session === 'discarded') return null;
    return this.normalizedValue()?.getUTCHours() ?? null;
  });

  /** Currently highlighted minute in the column; mirrors `selectedHour`. */
  public selectedMinute = computed<number | null>(() => {
    const session = this.minuteSession();
    if (typeof session === 'number') return session;
    if (session === 'discarded') return null;
    return this.normalizedValue()?.getUTCMinutes() ?? null;
  });

  /**
   * aria-activedescendant value for the hour listbox. Gated on `activeColumn`: the attribute
   * belongs only to the listbox that holds DOM focus (mirrors the `.focused` ring gating in
   * the template), otherwise the inactive column would keep announcing an active option.
   */
  public hourActiveDesc = computed(() => {
    if (this.activeColumn() !== 'hour' || this.focusedHour() === null) return undefined;
    return `${this.ident()}_opt_h${this.focusedHour()}`;
  });
  /**
   * aria-activedescendant value for the minute listbox. Gated on `activeColumn`, see
   * `hourActiveDesc`.
   */
  public minuteActiveDesc = computed(() => {
    if (this.activeColumn() !== 'minute' || this.focusedMinute() === null) return undefined;
    return `${this.ident()}_opt_m${this.focusedMinute()}`;
  });

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

  constructor() {
    // Watch `disabled` field: close clock panel when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isClockVisible()) this.hidePanel();
    });

    // Dev-only: catch a `label` id that matches no element. A dangling aria-labelledby leaves
    // this input without an accessible name (its aria-label fallback is suppressed whenever
    // label is set), which no assertion would catch. Re-runs whenever label or ident changes.
    effect(() => {
      warnDanglingLabel(this.document, this.label(), this.ident(), 'time-picker');
    });

    // Watch `isClockVisible` field: react on panel opening.
    effect(() => {
      if ( this.isClockVisible()) void this.scrollToSelected();
    });
  }

  // GENERAL

  /** Toggle visibility of time picker panel (clock). */
  private async toggleTimePickerVisibility() {
    if (this.isClockVisible()) {
      this.hidePanel();
    } else {
      // Reset placement to the baseline (below the input, left-aligned) BEFORE the panel renders.
      // The measurement below then always runs under this known alignment - measuring the panel
      // as left over from the previous open would judge alignment by the OLD placement.
      this.containerStyle.set(panelPlacement.baseline);
      this.isClockVisible.set(true);
      this.findViewTime();

      // Seed keyboard focus state on EVERY open. Focus always moves into the hour listbox below,
      // so the active option must exist right away.
      this.setupFocus(true);
      this.activeColumn.set('hour');

      await forRender(this.injector);

      // Adjust picker position if needed to prevent window overflow (measured under baseline).
      this.positionPanel();

      // Let the placement reach the DOM before focusing: focus() scrolls the focused
      // element into view, so focusing while the panel still renders at its baseline
      // (possibly below-the-fold) position makes the browser scroll the page to a spot
      // the panel is about to leave. That scroll moves the page under the user's cursor
      // and their next click can miss the label entirely (the click is retargeted to a
      // common ancestor, so the toggle is silently lost).
      await forRender(this.injector);

      // Move keyboard focus into the panel (hour column) so user can navigate immediately.
      // preventScroll: whenever the panel fits on either side, placement puts it inside the
      // viewport, so there is nothing to reveal - and a focus-triggered page scroll would race
      // with the user's mouse. When it fits on neither side, the panel deliberately stays below
      // the fold (the user scrolls down to it), so we still must not yank the page around.
      this.hourRef().nativeElement.focus({ preventScroll: true });
    }
  }

  /**
   * Resolve the clock panel placement so it does not overflow the viewport.
   * Runs once per open, right after the panel rendered under the baseline - the measurement
   * contract, viewport and margin details are documented on `WindowUtils.resolvePanelPlacement`.
   */
  private positionPanel(): void {
    this.containerStyle.set(WindowUtils.resolvePanelPlacement(this.pickerRef().nativeElement, this.clockPanelRef().nativeElement, panelPlacement));
  }

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

  //

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
  private applyPick(column: 'hour' | 'minute', picked: number): PickOutcome {
    if (this.disabled()) return null;

    if (column === 'hour') {
      this.focusedHour.set(picked);
    } else {
      this.focusedMinute.set(picked);
    }

    const current = column === 'hour' ? this.hourSession() : this.minuteSession();
    const next: ColumnSession = current === picked && this.canNull() ? 'discarded' : picked;
    if (column === 'hour') {
      this.hourSession.set(next);
    } else {
      this.minuteSession.set(next);
    }

    const completed = this.tryCommit();
    if (completed !== null) return completed;
    return next === 'discarded' ? 'unpicked' : 'picked';
  }

  /**
   * Commit `value` when the session is complete and report the outcome.
   * Completes on TWO PICKS (any order) - writes the chosen hour and minute onto the current
   * value's date (or today's date when no value is set), zeroing sub-minute parts; an
   * unchanged result keeps the value's identity so the form is not notified spuriously.
   * Completes on TWO DISCARDS (both columns un-picked, only reachable with canNull) - writes
   * null. A partial session returns null and leaves `value` untouched: the panel stays open,
   * and any close without completion (Escape, outside press, focusout, disabling) resets the
   * session in `hidePanel` without committing. This is the ONLY place a pick changes `value`.
   * @returns `'committed'`/`'cleared'` when `value` was written, null when still partial.
   */
  private tryCommit(): 'committed' | 'cleared' | null {
    const h = this.hourSession();
    const m = this.minuteSession();

    if (typeof h === 'number' && typeof m === 'number') {
      const current = this.normalizedValue();
      const date = current !== null ? new Date(current) : new Date();
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
    const selHourElement = this.hourRef().nativeElement.querySelector<HTMLElement>(targetClass);
    const selMinuteElement = this.minuteRef().nativeElement.querySelector<HTMLElement>(targetClass);
    if (selHourElement) this.centerOptionInColumn(this.hourRef().nativeElement, selHourElement);
    if (selMinuteElement) this.centerOptionInColumn(this.minuteRef().nativeElement, selMinuteElement);
  }

  /**
   * Scroll hour listbox so given hour is visible.
   * @param h Hour to reveal, or null to do nothing.
   */
  private async scrollHourIntoView(h: number | null) {
    if (h === null) return;
    await forRender(this.injector);

    const column = this.hourRef().nativeElement;
    const el = column.querySelector<HTMLElement>(`[id="${this.ident()}_opt_h${h}"]`);
    if (el) this.centerOptionInColumn(column, el);
  }

  /**
   * Scroll minute listbox so given minute is visible.
   * @param m Minute to reveal, or null to do nothing.
   */
  private async scrollMinuteIntoView(m: number | null) {
    if (m === null) return;
    await forRender(this.injector);

    const column = this.minuteRef().nativeElement;
    const el = column.querySelector<HTMLElement>(`[id="${this.ident()}_opt_m${m}"]`);
    if (el) this.centerOptionInColumn(column, el);
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
   * Step example with 5 cells visible: 1 2 [3] 4 5 will be 6 7 [8] 9 10. So no overlap, but also no gaps in values.
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

  /** Tracks if the next focus event is caused by a mouse click (to avoid auto-open on click). Set only when a click-caused focus event is actually coming. */
  private focusFromClick = false;

  /** True while a programmatic refocus (e.g. after closing the panel) must not auto-open the panel. */
  private suppressFocusOpen = false;

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
  public handleMousedownOption(column: 'hour' | 'minute', value: number): void {
    if (this.disabled()) return;
    this.activeColumn.set(column);
    if (column === 'hour') {
      this.focusedHour.set(value);
    } else {
      this.focusedMinute.set(value);
    }
  }

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
    // can sit below the fold, see the open-path focus in `toggleTimePickerVisibility`).
    header?.closest('.clock-column-group')?.querySelector<HTMLElement>('.clock-column')?.focus({ preventScroll: true });
  }

  /** Handle focus arriving on the input (e.g. via Tab). */
  public handleInputFocus() {
    if (!this.focusFromClick && !this.suppressFocusOpen && !this.isClockVisible() && !this.disabled()) {
      // Panel opening waits for renders internally; template event bindings never await the
      // handler, so the work is deliberately fire-and-forget (`void` marks it as such).
      void this.toggleTimePickerVisibility();
    }
    this.focusFromClick = false;
  }

  /** Handle click on the input. */
  public handleClick() {
    if (this.disabled()) return;
    this.focusFromClick = false; // Any click-caused focus already happened (focus precedes click) - never leave a stale flag behind.
    void this.toggleTimePickerVisibility();
  }

  /**
   * Handle click on an hour option: apply the pick to the session and close the clock panel
   * ONLY when the pick completes the session (both columns picked in any order, or both
   * un-picked with canNull). A partial pick keeps the panel open - the other column still has
   * to be picked; a close WITHOUT completion (Escape, outside press, focusout) silently
   * discards it. Focus returns to the input (the panel's focus owner) before the panel is
   * hidden, so the resulting focusout stays internal and no touch is reported - touch fires
   * only when focus really leaves the component, same as on Escape.
   * @param h Clicked hour.
   */
  public handleHourClick(h: number) {
    if (this.disabled()) return;
    const outcome = this.applyPick('hour', h);
    if (outcome === 'committed' || outcome === 'cleared') this.hidePanelAndRefocus();
  }

  /**
   * Handle click on a minute option: apply the pick to the session and close the clock panel
   * ONLY when the pick completes the session - mirrors `handleHourClick`, since either column
   * may be the completing pick (selection order is free). A partial minute pick keeps the
   * panel open; focus handling on close is the same as for an hour pick.
   * @param m Clicked minute.
   */
  public handleMinuteClick(m: number) {
    if (this.disabled()) return;
    const outcome = this.applyPick('minute', m);
    if (outcome === 'committed' || outcome === 'cleared') this.hidePanelAndRefocus();
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
      if (!this.isClockVisible()) void this.toggleTimePickerVisibility();
    } else if (e.key === 'Escape' && this.isClockVisible()) {
      e.preventDefault();
      this.hidePanel();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Default is prevented unconditionally: on a readonly input Backspace must never reach
      // the browser's legacy history-back handling (Firefox), even when canNull forbids the clear.
      e.preventDefault();
      this.keyPressClear();
    }
  }

  /**
   * Handle keyboard on the hour listbox.
   * @param e Keyboard event.
   */
  public onHourKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusedHour.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : 23;
          return this.selectedHour() ?? this.viewHour() ?? 0;
        });
        void this.scrollHourIntoView(this.focusedHour());
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusedHour.update((currVal) => {
          if (currVal !== null) return currVal < 23 ? currVal + 1 : 0;
          return this.selectedHour() ?? this.viewHour() ?? 0;
        });
        void this.scrollHourIntoView(this.focusedHour());
        break;
      case 'ArrowRight':
        e.preventDefault();
        void this.keyPressSwitchColumn();
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        this.focusedHour.set(0);
        void this.scrollHourIntoView(0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        this.focusedHour.set(23);
        void this.scrollHourIntoView(23);
        break;
      case 'PageDown': // Page forward; wraps to the top only when already standing on the last hour.
        e.preventDefault(); // Without it the browser scrolls the column natively, leaving the cursor behind.
        this.focusedHour.set(this.pageMove(this.focusedHour(), 1, 23,
          this.pageStep(this.hourRef().nativeElement), this.selectedHour() ?? this.viewHour() ?? 0));
        void this.scrollHourIntoView(this.focusedHour());
        break;
      case 'PageUp': // Page backward; wraps to the bottom only when already standing on the first hour.
        e.preventDefault();
        this.focusedHour.set(this.pageMove(this.focusedHour(), -1, 23,
          this.pageStep(this.hourRef().nativeElement), this.selectedHour() ?? this.viewHour() ?? 0));
        void this.scrollHourIntoView(this.focusedHour());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        void this.keyPressSelectHour();
        break;
      case 'Delete':
      case 'Backspace': // Clearing completes the interaction, so the panel closes (mirrors the minute path).
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

  /**
   * Handle keyboard on the minute listbox.
   * @param e Keyboard event.
   */
  public onMinuteKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusedMinute.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : 59;
          return this.selectedMinute() ?? this.viewMinute() ?? 0;
        });
        void this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusedMinute.update((currVal) => {
          if (currVal !== null) return currVal < 59 ? currVal + 1 : 0;
          return this.selectedMinute() ?? this.viewMinute() ?? 0;
        });
        void this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'ArrowLeft':
        e.preventDefault();
        void this.keyPressSwitchColumn();
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        this.focusedMinute.set(0);
        void this.scrollMinuteIntoView(0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        this.focusedMinute.set(59);
        void this.scrollMinuteIntoView(59);
        break;
      case 'PageDown': // Page forward; wraps to the top only when already standing on the last minute.
        e.preventDefault(); // Without it the browser scrolls the column natively, leaving the cursor behind.
        this.focusedMinute.set(this.pageMove(this.focusedMinute(), 1, 59,
          this.pageStep(this.minuteRef().nativeElement), this.selectedMinute() ?? this.viewMinute() ?? 0));
        void this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'PageUp': // Page backward; wraps to the bottom only when already standing on the first minute.
        e.preventDefault();
        this.focusedMinute.set(this.pageMove(this.focusedMinute(), -1, 59,
          this.pageStep(this.minuteRef().nativeElement), this.selectedMinute() ?? this.viewMinute() ?? 0));
        void this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        void this.keyPressSelectMinute();
        break;
      case 'Delete':
      case 'Backspace': // Clearing completes the interaction, so the panel closes (mirrors the hour path).
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

  //

  /** React to column change via key press. */
  private async keyPressSwitchColumn() {
    if (this.focusedHour() === null || this.focusedMinute() === null) {
      // Just show focus without switching column.
      this.setupFocus(false);
      return;
    }

    if (this.activeColumn() === 'minute') {
      // Switch focus to hour column.
      this.activeColumn.set('hour');
      await forRender(this.injector);
      // preventScroll: same reasoning as the open-path focus in `toggleTimePickerVisibility` -
      // the panel may sit below the fold, and revealing it is the USER's job, not focus's.
      // Reveal inside the column is handled by `scrollHourIntoView`/`scrollMinuteIntoView`
      // (column scrollTop only), so nothing here needs a viewport scroll.
      this.hourRef().nativeElement.focus({ preventScroll: true });
    } else {
      // Switch focus to minute column.
      this.activeColumn.set('minute');
      await forRender(this.injector);
      this.minuteRef().nativeElement.focus({ preventScroll: true }); // preventScroll: see the hour branch above.
    }
  }

  /**
   * React to selecting hour via key press.
   * A completing pick/discard closes the panel - a committed time moves focus on to the next
   * element (today's minute-Enter close), a cleared value returns to the input (today's
   * hour-Enter deselect close). A partial pick hands focus to the minute column so the flow
   * can continue there; a partial discard stays in the hour column being managed.
   */
  private async keyPressSelectHour() {
    const hour = this.focusedHour();
    if (hour === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    const outcome = this.applyPick('hour', hour);
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

    // Partial pick: continue the flow in the minute column (the mirror of
    // keyPressSelectMinute's partial-pick branch).
    this.activeColumn.set('minute');
    if (this.focusedMinute() === null) {
      this.focusedMinute.set(this.selectedMinute() ?? this.viewMinute() ?? null);
    }
    await forRender(this.injector);
    // preventScroll: same reasoning as the column switch in `keyPressSwitchColumn` - a
    // below-the-fold panel must not drag the viewport when the hour press advances the flow.
    this.minuteRef().nativeElement.focus({ preventScroll: true });
  }

  /**
   * React to selecting minute via key press. Mirrors `keyPressSelectHour` with the columns
   * swapped: a completing pick/discard closes the panel (a committed time moves focus on to
   * the next element, a cleared value returns to the input), a partial pick hands focus to
   * the hour column, a partial discard stays in the minute column.
   */
  private async keyPressSelectMinute() {
    const minute = this.focusedMinute();
    if (minute === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    const outcome = this.applyPick('minute', minute);
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

    // Partial pick: continue the flow in the hour column (mirrors keyPressSelectHour).
    this.activeColumn.set('hour');
    if (this.focusedHour() === null) {
      this.focusedHour.set(this.selectedHour() ?? this.viewHour() ?? null);
    }
    await forRender(this.injector);
    // preventScroll: same reasoning as in `keyPressSelectHour`.
    this.hourRef().nativeElement.focus({ preventScroll: true });
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
   * Set up focus values. Seeds from the DISPLAY selection (`selectedHour`/`selectedMinute` -
   * session pick ?? committed value), falling back to the viewed local time.
   * @param force If true, will override focused values. If false, will set focused values only if these are null.
   */
  private setupFocus(force: boolean) {
    if (force || this.focusedHour() === null) {
      this.focusedHour.set(this.selectedHour() ?? this.viewHour() ?? null);
    }
    if (force || this.focusedMinute() === null) {
      this.focusedMinute.set(this.selectedMinute() ?? this.viewMinute() ?? null);
    }
  }

  // UTILITIES

  /**
   * Show the clock panel when it is closed (no-op when already visible).
   */
  public async showPanel() {
    if (this.disabled()) return;
    if (this.isClockVisible()) return;
    await this.toggleTimePickerVisibility();
  }

  /**
   * Hide clock panel with hours and minutes.
   * Also resets internals.
   */
  public hidePanel() {
    if (!this.isClockVisible()) return; // already hidden

    this.isClockVisible.set(false);
    this.focusedHour.set(null);
    this.focusedMinute.set(null);
    this.hourSession.set('untouched');
    this.minuteSession.set('untouched');
    this.viewHour.set(null);
    this.viewMinute.set(null);
  }

  /**
   * Focusing the input auto-opens the panel (see `handleInputFocus`), so focus then continues
   * into the hour listbox like it does on Tab.
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
   * auto-opens the clock panel. No-op when disabled (the input refuses focus).
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
   */
  private hidePanelAndFocusNext() {
    NavUtils.FocusNext(this.inputRef().nativeElement);
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
   * Handle focus leaving the picker entirely (e.g. Tab out of grid). It closes clock panel and,
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
