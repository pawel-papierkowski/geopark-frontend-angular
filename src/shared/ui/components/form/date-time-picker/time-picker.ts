import { Component, effect, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService, TranslatePipe } from '@ngx-translate/core';

import { TimeUtils } from '@/core/utils/TimeUtils';
import { NavUtils } from '@/core/utils/NavUtils';
import { WindowUtils, type PanelPlacement, type PanelInsets } from '@/core/utils/WindowUtils';
import { afterRender } from '@/shared/utils/render/after-render';

/**
 * Placement of the clock panel relative to its input - single source of truth for both the
 * baseline reset on open and the flip decision (see `WindowUtils.resolvePanelPlacement`).
 * `flipY` anchors the panel's BOTTOM to the input's TOP (`bottom: 100%`), NOT `bottom: 0`:
 * `bottom: 0` would pin the panel's bottom to the input's bottom, so the panel would sit
 * ON TOP of the input and intercept its clicks.
 * Note: both flips rely on `.clock-container` having zero right/bottom margins
 * (`--datetimepicker-clock-offset` in styles/var/components-custom.css).
 */
const panelPlacement: PanelPlacement = {
  baseline: { top: '100%', bottom: 'auto', left: '0', right: 'auto' },
  flipX: { left: 'auto', right: '0' },
  flipY: { top: 'auto', bottom: '100%' },
};

/**
 * This is a time picker. Uses `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="time".
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Values are read/written through UTC accessors, but the default "current time" highlight and
 * keyboard/scroll seed (used when no value is set) come from the browser's local timezone.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Can select time.
 * - Can disable or mark as invalid.
 * - Keyboard navigation supported:
 *   - if clock panel closed, open it with enter, space or down arrow
 *   - change hour/minute
 *   - enter/space (pick hour/minute)
 *   - esc (close panel).
 * - Supports labelling through the `label` input (wired to `aria-labelledby`). When it is empty,
 *   the input gets an `aria-label` fallback from `dateTimePicker.time`. A native `<label for>`
 *   pointing at this input only reaches the accessible name when its id is ALSO passed via
 *   `label`; otherwise the fallback shadows it (accname gives aria-label precedence over native
 *   labelling). Plain `<label for>` pairing belongs to the parent DateTimePicker, whose label
 *   target is its own hidden button, not this input.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attributes of the input and panel (data-testid, aria-controls, aria-activedescendant etc.). Always provided by parent DateTimePicker, this component is not meant to be used alone.
 * - label - For `aria-labelledby`; when set, it names the input instead of the `aria-label` fallback. Optional.
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
  imports: [ TranslatePipe ],
  styleUrl: './time-picker.css',
  templateUrl: './time-picker.html',
})
export class TimePicker implements FormValueControl<Date | null> {
  private injector = inject(Injector);
  private readonly translateService = inject(TranslateService);

  /** Value held by component. */
  value = model<Date | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
  /** If true, allow deselecting date. */
  canNull = input<boolean>(false);
  /** Is component required? */
  readonly required = input<boolean>(false);
  /** Is component disabled? */
  readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component (focus left it), regardless of panel visibility. */
  touch = output<void>();

  /** Indicates visibility of clock panel. */
  isClockVisible = signal(false);
  /** Root focusable element. */
  pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to clock panel. */
  clockPanelRef = viewChild.required<ElementRef<HTMLDivElement>>('clockPanelRef');
  /** Reference to hour listbox. */
  hourRef = viewChild.required<ElementRef<HTMLDivElement>>('hourRef');
  /** Reference to minute listbox. */
  minuteRef = viewChild.required<ElementRef<HTMLDivElement>>('minuteRef');

  /** Keyboard-focus hour index. Set when panel opens, updated via arrow navigation. */
  focusedHour = signal<number | null>(null);
  /** Keyboard-focus minute index. Set when panel opens, updated via arrow navigation. */
  focusedMinute = signal<number | null>(null);
  /** Which listbox column currently has keyboard focus. */
  activeColumn = signal<'hour' | 'minute'>('hour');

  /** List of hours. We use full 24-hour clock. */
  hours = Array.from({ length: 24 }, (_, i) => i);
  /** List of minutes. */
  minutes = Array.from({ length: 60 }, (_, i) => i);

  /** Currently viewed hour. */
  viewHour = signal<number | null>(null);
  /** Currently viewed minute. */
  viewMinute = signal<number | null>(null);

  /**
   * Inline style of the clock panel (see `panelPlacement`). All four insets are managed
   * TOGETHER: the CSS default (`top: 100%`, `left: 0`) can be overridden inline, so a stale
   * inline `top: auto` from a previous upward flip would otherwise persist, and having both
   * `top` and `bottom` non-auto would over-constrain the absolutely positioned panel.
   * Reset to the baseline on every open before measuring.
   */
  containerStyle = signal<PanelInsets>(panelPlacement.baseline);

  // COMPUTED

  /** Currently selected hour. */
  selectedHour = computed(() => this.normalizedValue()?.getUTCHours() ?? null);
  /** Currently selected minute. */
  selectedMinute = computed(() => this.normalizedValue()?.getUTCMinutes() ?? null);

  /**
   * `value` when it carries a real time. An `Invalid Date` fed by the parent (e.g. failed
   * parsing of backend data) counts as "no time set": every UTC accessor on it returns `NaN`,
   * which would print `NaN:NaN`, seed a `NaN` keyboard cursor and propagate through selections.
   * Never mutates the model - the parent owns that value; interacting with the picker heals it.
   */
  normalizedValue = computed<Date | null>(() => {
    const value = this.value();
    return value !== null && !Number.isNaN(value.getTime()) ? value : null;
  });

  /** aria-activedescendant value for the hour listbox. */
  hourActiveDesc = computed(() => {
    if (this.focusedHour() === null) return undefined;
    return `${this.ident()}_opt_h${this.focusedHour()}`;
  });
  /** aria-activedescendant value for the minute listbox. */
  minuteActiveDesc = computed(() => {
    if (this.focusedMinute() === null) return undefined;
    return `${this.ident()}_opt_m${this.focusedMinute()}`;
  });

  /**
   * Compute currently displayed time value in time input. Always a string (never null), so the `[value]` binding never writes null into the input.
   * Deliberately plain text - a screen reader announces the input's VALUE, so a decorative glyph
   * baked in here would be read out ("clock face one-thirty") before the time. The clock glyph
   * is rendered outside the input as an `aria-hidden` span (see the template).
   */
  displayTimeValue = computed(() => TimeUtils.formatUTCTime(this.normalizedValue()));
  /**
   * Compute placeholder value for time input. Same rule as the value: no decorative glyph, so
   * the format hint is announced (and read) as plain `hh:mm`.
   */
  placeholderTimeValue = computed(() => this.translateService.instant('dateTimePicker.placeholder.time'));

  constructor() {
    // Watch `disabled` field: close clock panel when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isClockVisible()) this.hidePanel();
    });

    // Watch `isClockVisible` field: react on panel opening.
    effect(() => {
      if ( this.isClockVisible()) this.scrollToSelected();
    });
  }

  // GENERAL

  /** Toggle visibility of time picker panel. */
  async toggleTimePickerVisibility() {
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

      await afterRender(this.injector);

      // Adjust picker position if needed to prevent window overflow (measured under baseline).
      this.positionPanel();
      // Let the placement reach the DOM before focusing: focus() scrolls the focused
      // element into view, so focusing while the panel still renders at its baseline
      // (possibly below-the-fold) position makes the browser scroll the page to a spot
      // the panel is about to leave. That scroll moves the page under the user's cursor
      // and their next click can miss the label entirely (the click is retargeted to a
      // common ancestor, so the toggle is silently lost).
      await afterRender(this.injector);

      // Move keyboard focus into the panel (hour column) so user can navigate immediately.
      // preventScroll: placement guarantees the panel fits the viewport when either side
      // does, so there is nothing to reveal - and any focus-triggered page scroll would
      // race with the user's mouse.
      this.hourRef().nativeElement.focus({ preventScroll: true });
    }
  }

  /**
   * Resolve the clock panel placement so it does not overflow the viewport.
   * Runs once per open, right after the panel rendered under the baseline - the measurement
   * contract, viewport and margin details are documented on `WindowUtils.resolvePanelPlacement`.
   */
  private positionPanel(): void {
    this.containerStyle.set(WindowUtils.resolvePanelPlacement(this.clockPanelRef().nativeElement, panelPlacement));
  }

  /**
   * Find and set current time in the browser's local timezone.
   * Drives the `curr` marker (always), and - when no value is set - the scroll target and the
   * keyboard focus seed, so opening the picker without a value pre-selects local time.
   * Values themselves stay timezone-agnostic (UTC-carried), see class doc.
   */
  findViewTime() {
    const date = new Date();
    this.viewHour.set(date.getHours());
    this.viewMinute.set(date.getMinutes());
  }

  //

  /** Select hour. */
  selectHour(h: number | null) {
    if (this.disabled() || h === null) return;

    // Selection and the keyboard cursor must agree.
    this.focusedHour.set(h);

    const current = this.normalizedValue();

    // Selecting same hour.
    if (current && current.getUTCHours() === h) {
      if (this.canNull()) {
        this.value.set(null); // Deselect time.
        return;
      }
      this.value.set(this.clearSubMinute(current)); // Normalize stray seconds even when selection does not change.
      return;
    }

    const date = this.clearSubMinute(current ? new Date(current) : this.createSeedDate());
    date.setUTCHours(h);
    this.value.set(date);
  }

  /** Select minute. */
  selectMinute(m: number | null) {
    if (this.disabled() || m === null) return;

    const current = this.normalizedValue();

    // Selecting same minute.
    if (current && current.getUTCMinutes() === m) {
      if (this.canNull()) {
        this.value.set(null); // Deselect time.
        return;
      }
      this.value.set(this.clearSubMinute(current)); // Normalize stray seconds even when selection does not change.
      return;
    }

    const date = this.clearSubMinute(current ? new Date(current) : this.createSeedDate());
    date.setUTCMinutes(m);
    this.value.set(date);
  }

  /**
   * Return a Date with seconds and milliseconds zeroed. The picker only lets the user pick
   * hours and minutes (display shows `HH:mm`), so sub-minute parts must never leave the
   * component - otherwise values seeded with stray seconds would reach the backend untouched.
   * Returns the same instance when already clean, so untouched clean values keep their identity.
   * @param date Date to normalize.
   * @returns Date without seconds and milliseconds.
   */
  private clearSubMinute(date: Date): Date {
    if (date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) return date;
    const copy = new Date(date);
    copy.setUTCSeconds(0, 0);
    return copy;
  }

  /**
   * Base date for a selection made while no value is set: today's calendar date (taken from
   * `new Date()`, so the date part stays exactly as before) carrying the VIEWED local time as
   * UTC fields, with sub-minute parts zeroed.
   * Reading the UTC fields of a plain `new Date()` instead would seed `localHour - utcOffset`,
   * which contradicts the `curr` marker and the keyboard seed - both show the local time, so a
   * partial selection (hour only or minute only) must follow them, not the timezone-shifted
   * clock. The viewed time is frozen when the panel opened, exactly like the markers the user
   * is picking against. Falls back to the wall clock when nothing has been viewed yet (e.g.
   * programmatic selection without opening the panel), mirroring `findViewTime`.
   * @returns Date ready for the chosen hour/minute to be applied via UTC accessors.
   */
  private createSeedDate(): Date {
    const now = new Date();
    const date = new Date(now);
    date.setUTCHours(this.viewHour() ?? now.getHours(), this.viewMinute() ?? now.getMinutes(), 0, 0);
    return date;
  }

  /**
   * Scroll the given option to the vertical center of its own `.clock-column` container.
   * Deliberately avoids `Element.scrollIntoView()`: it aligns the option against the viewport and
   * therefore scrolls EVERY scrollable ancestor, including the page - opening the panel near a
   * viewport edge would jump the whole document (animated, because `html:focus-within` enables
   * smooth scrolling - see styles/general/reset.css). Writing `scrollTop` touches only the column.
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
  async scrollToSelected() {
    await afterRender(this.injector);

    // If time is not selected, use current time as scroll target.
    const targetClass = this.normalizedValue() === null ? '.curr' : '.selected';
    const selHourElement = this.hourRef().nativeElement.querySelector<HTMLElement>(targetClass);
    const selMinuteElement = this.minuteRef().nativeElement.querySelector<HTMLElement>(targetClass);
    if (selHourElement) this.centerOptionInColumn(this.hourRef().nativeElement, selHourElement);
    if (selMinuteElement) this.centerOptionInColumn(this.minuteRef().nativeElement, selMinuteElement);
  }

  /** Scroll hour listbox so given hour is visible. */
  async scrollHourIntoView(h: number | null) {
    if (h === null) return;
    await afterRender(this.injector);

    const column = this.hourRef().nativeElement;
    const el = column.querySelector<HTMLElement>(`[data-testid="${this.ident()}_h${h}"]`);
    if (el) this.centerOptionInColumn(column, el);
  }

  /** Scroll minute listbox so given minute is visible. */
  async scrollMinuteIntoView(m: number | null) {
    if (m === null) return;
    await afterRender(this.injector);

    const column = this.minuteRef().nativeElement;
    const el = column.querySelector<HTMLElement>(`[data-testid="${this.ident()}_m${m}"]`);
    if (el) this.centerOptionInColumn(column, el);
  }

  // EVENTS

  /** Tracks if the next focus event is caused by a mouse click (to avoid auto-open on click). Set only when a click-caused focus event is actually coming. */
  focusFromClick = false;

  /** True while a programmatic refocus (e.g. after closing the panel) must not auto-open the panel. */
  private suppressFocusOpen = false;

  /**
   * Handle mousedown on input: if focus is about to arrive (input not focused yet), mark it as
   * click-caused so auto-open is skipped. An already-focused input produces no focus event,
   * so nothing is marked - that is what keeps the flag from leaking (a stale flag would swallow
   * the auto-open of the next Tab into the input).
   * @param e Mouse event.
   */
  handleMousedown(e: MouseEvent) {
    this.focusFromClick = document.activeElement !== e.currentTarget;
  }

  /**
   * Guard mousedown on the clock panel. Its chrome (padding, border, gaps around the columns) is
   * not focusable, so the browser's focus fixup would move focus to <body>; the panel's focusout
   * handler would read that as "focus left the component" and close the panel while emitting a
   * spurious touch. Cancelling the default keeps focus where it was (inside a .clock-column).
   * Presses inside a .clock-column are left alone: they focus that column (already inside the
   * component) and must keep native scrollbar/text-drag behaviour.
   * @param e Mouse event.
   */
  handlePanelMousedown(e: MouseEvent) {
    const target = e.target;
    if (target instanceof Element && target.closest('.clock-column') !== null) return;
    e.preventDefault();
  }

  /** Handle focus arriving on the input (e.g. via Tab). */
  async handleInputFocus() {
    if (!this.focusFromClick && !this.suppressFocusOpen && !this.isClockVisible() && !this.disabled()) {
      await this.toggleTimePickerVisibility();
    }
    this.focusFromClick = false;
  }

  /** Handle click on the input. */
  async handleClick() {
    if (this.disabled()) return;
    this.focusFromClick = false; // Any click-caused focus already happened (focus precedes click) - never leave a stale flag behind.
    await this.toggleTimePickerVisibility();
  };

  /**
   * Handle click on a minute option: apply the selection and close the clock panel - picking a
   * minute completes the time, so the interaction ends here (hour clicks keep the panel open
   * because the minute still has to be picked). Focus returns to the input (the panel's focus
   * owner), so the resulting focusout stays internal and no touch is reported - touch fires only
   * when focus really leaves the component, same as on Escape. The panel also closes when the
   * click deselected the time (canNull toggle): either way the interaction is complete.
   * @param m Clicked minute.
   */
  handleMinuteClick(m: number) {
    if (this.disabled()) return;
    this.selectMinute(m);
    this.hidePanelAndRefocus(); // Focus moves to the input BEFORE the panel is hidden, so the focusout reads as an internal move.
  }

  /**
   * Handle focus leaving the picker entirely (e.g. Tab out of grid). It closes clock panel and,
   * unless focus only moved inside the component, reports the control as touched.
   * Note the panel visibility is intentionally not checked: internal helpers hide the panel before
   * or after focus moves, so a closed panel must still report touch when focus really left.
   * @param e Focus event.
   */
  handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget;
    if (next instanceof Node && this.pickerRef().nativeElement.contains(next)) return;
    // The wrapper's hidden label target (`.hidden-label-button`) is a sibling of this component -
    // it lives on the parent DateTimePicker's root - so containment misses it. Focus landing
    // there means label activation is about to redirect straight back into this component
    // (it always pairs focus with a click), so it reads as an internal move, not a user blur.
    if (next instanceof Element && next.classList.contains('hidden-label-button')) return;
    this.hidePanel();
    if (this.disabled()) return; // Programmatic close (disabled while focused), not a user blur.
    this.touch.emit();
  }

  // EVENTS: KEYBOARD HANDLERS

  /**
   * Handle keyboard on the input element.
   * @param e Keyboard event.
   */
  async onInputKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.isClockVisible()) await this.toggleTimePickerVisibility();
    } else if (e.key === 'Escape' && this.isClockVisible()) {
      e.preventDefault();
      this.hidePanel();
    }
  }

  /**
   * Handle keyboard on the hour listbox.
   * @param e Keyboard event.
   */
  async onHourKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusedHour.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : 23;
          return this.selectedHour() ?? this.viewHour() ?? 0;
        });
        this.scrollHourIntoView(this.focusedHour());
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusedHour.update((currVal) => {
          if (currVal !== null) return currVal < 23 ? currVal + 1 : 0;
          return this.selectedHour() ?? this.viewHour() ?? 0;
        });
        this.scrollHourIntoView(this.focusedHour());
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.keyPressSwitchColumn();
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        this.focusedHour.set(0);
        this.scrollHourIntoView(0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        this.focusedHour.set(23);
        this.scrollHourIntoView(23);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.keyPressSelectHour();
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
  async onMinuteKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.focusedMinute.update((currVal) => {
          if (currVal !== null) return currVal > 0 ? currVal - 1 : 59;
          return this.selectedMinute() ?? this.viewMinute() ?? 0;
        });
        this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.focusedMinute.update((currVal) => {
          if (currVal !== null) return currVal < 59 ? currVal + 1 : 0;
          return this.selectedMinute() ?? this.viewMinute() ?? 0;
        });
        this.scrollMinuteIntoView(this.focusedMinute());
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.keyPressSwitchColumn();
        break;
      case 'Home': // Jump to start of list.
        e.preventDefault();
        this.focusedMinute.set(0);
        this.scrollMinuteIntoView(0);
        break;
      case 'End': // Jump to end of list.
        e.preventDefault();
        this.focusedMinute.set(59);
        this.scrollMinuteIntoView(59);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.keyPressSelectMinute();
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
  async keyPressSwitchColumn() {
    if (this.focusedHour() === null || this.focusedMinute() === null) {
      // Just show focus without switching column.
      this.setupFocus(false);
      return;
    }

    if (this.activeColumn() === 'minute') {
      // Switch focus to hour column.
      this.activeColumn.set('hour');
      await afterRender(this.injector);
      this.hourRef().nativeElement.focus();
    } else {
      // Switch focus to minute column.
      this.activeColumn.set('minute');
      await afterRender(this.injector);
      this.minuteRef().nativeElement.focus();
    }
  }

  /** React to selecting hour via key press. */
  async keyPressSelectHour() {
    if (this.focusedHour() === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    this.selectHour(this.focusedHour());
    await afterRender(this.injector);

    // If time was deselected (canNull same-hour toggle), close panel.
    // Otherwise move focus to minute column.
    if (this.normalizedValue() === null) {
      this.hidePanelAndRefocus();
    } else {
      this.activeColumn.set('minute');
      if (this.focusedMinute() === null) {
        const val = this.normalizedValue()?.getUTCMinutes() ?? this.viewMinute();
        this.focusedMinute.set(val ?? null);
      }
      await afterRender(this.injector);
      this.minuteRef().nativeElement.focus();
    }
  }

  /** React to selecting minute via key press. */
  keyPressSelectMinute() {
    if (this.focusedMinute() === null) {
      // Just show focus without selecting anything.
      this.setupFocus(false);
      return;
    }

    this.selectMinute(this.focusedMinute());
    this.hidePanelAndFocusNext();
  }

  // UTILITIES

  /**
   * Show panel (if not already visible). Programmatic open for external controllers -
   * notably DateTimePicker, which will move between both sub-pickers once DatePicker is
   * functional. User-driven opens go through focus/click handlers instead.
   * Does nothing while disabled: opening would move focus into a disabled control's listbox.
   */
  async showPanel() {
    if (this.disabled()) return;
    if (!this.isClockVisible()) await this.toggleTimePickerVisibility();
  }

  /**
   * Hide clock panel with hours and minutes.
   */
  hidePanel() {
    if (!this.isClockVisible()) return; // already hidden

    this.isClockVisible.set(false);
    this.focusedHour.set(null);
    this.focusedMinute.set(null);
  }

  /**
   * Move DOM focus to the input - entry point used by DateTimePicker's label activation, which
   * has to redirect `<label for>` clicks into the sub-picker that actually owns the combobox.
   * Focusing the input auto-opens the panel (see `handleInputFocus`), so focus then continues
   * into the hour listbox like it does on Tab.
   * @returns The input that took focus, or null when there is none (e.g. disabled input).
   */
  focusInput(): HTMLElement | null {
    const inputEl = document.getElementById(`${this.ident()}_input`);
    if (inputEl === null || (inputEl instanceof HTMLInputElement && inputEl.disabled)) return null;
    inputEl.focus();
    return inputEl;
  }

  /**
   * Hide panel and return focus to the input.
   * Focus moves BEFORE the panel is hidden so the resulting focusout reports an internal move
   * (relatedTarget is the input) instead of a leaving blur - focus must stay inside the component,
   * so no touch is reported. The refocus is programmatic, so auto-open on focus is suppressed too.
   */
  hidePanelAndRefocus() {
    const inputEl = document.getElementById(`${this.ident()}_input`);
    this.suppressFocusOpen = true;
    inputEl?.focus(); // Focus dispatch is synchronous, so the focus handler skips auto-open while the flag is set.
    this.suppressFocusOpen = false;
    this.hidePanel();
  }

  /**
   * Hide panel and move focus to the next focusable element on page.
   * Focus moves BEFORE the panel is hidden: the focusout (handled by `handleFocusOut`) then sees
   * focus leaving the component, closes the panel and reports touch.
   */
  hidePanelAndFocusNext() {
    const inputEl = document.getElementById(`${this.ident()}_input`);
    NavUtils.FocusNext(inputEl);
    this.hidePanel();
  }

  /**
   * Hide panel and move focus to the previous focusable element on page.
   * Focus moves BEFORE the panel is hidden: the focusout (handled by `handleFocusOut`) then sees
   * focus leaving the component, closes the panel and reports touch.
   */
  hidePanelAndFocusPrev() {
    const inputEl = document.getElementById(`${this.ident()}_input`);
    NavUtils.FocusPrev(inputEl);
    this.hidePanel();
  }

  /**
   * Set up focus values.
   * @param force If true, will override focused values. If false, will set focused values only if these are null.
   */
  setupFocus(force: boolean) {
    if (force || this.focusedHour() === null) {
      const val = this.normalizedValue()?.getUTCHours() ?? this.viewHour();
      this.focusedHour.set(val ?? null);
    }
    if (force || this.focusedMinute() === null) {
      const val = this.normalizedValue()?.getUTCMinutes() ?? this.viewMinute();
      this.focusedMinute.set(val ?? null);
    }
  }

  /**
   * Resolve class of hour item.
   * @param h Hour.
   */
  resolveHourClass(h: number) {
    return {
      selected: this.selectedHour() === h,
      curr: this.viewHour() === h,
      focused: this.activeColumn() === 'hour' && this.focusedHour() === h,
    };
  }

  /**
   * Resolve class of minute item.
   * @param m Minute.
   */
  resolveMinuteClass(m: number) {
    return {
      selected: this.selectedMinute() === m,
      curr: this.viewMinute() === m,
      focused: this.activeColumn() === 'minute' && this.focusedMinute() === m,
    };
  }
}
