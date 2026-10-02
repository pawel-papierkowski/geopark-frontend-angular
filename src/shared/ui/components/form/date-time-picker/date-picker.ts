import { Component, effect, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef, DOCUMENT } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService, TranslatePipe } from '@ngx-translate/core';

import { TimeUtils } from '@/core/utils/TimeUtils';
import { NavUtils } from '@/core/utils/NavUtils';
import { WindowUtils, type PanelPlacement, type PanelInsets } from '@/core/utils/WindowUtils';
import { forRender } from '@/shared/utils/render/after-render';

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
 * CURRENTLY PLACEHOLDER.
 *
 * Features:
 * - Can select date.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows (open panel or change day/month), enter/space (pick date) and esc (close panel).
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Always provided by parent DateTimePicker, this component is not meant to be used alone.
 * - label - For `aria-labelledby`. Optional.
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
  imports: [ TranslatePipe ],
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
  /** Label reference. */
  public label = input<string>('');
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

  /** Indicates visibility of calendar panel. */
  public readonly isCalendarVisible = signal(false);

  /** Date under keyboard focus within the calendar grid. Set when panel opens, updated via arrow navigation. */
  public focusedDate = signal<Date | null>(null);
  /** Currently highlighted date in the grid. */
  public selectedDate = signal<Date | null>(null);
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

  constructor() {
    // Watch `disabled` field: close calendar panel when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isCalendarVisible()) this.hidePanel();
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
   * Find and set current date in the browser's local timezone.
   * Drives the `curr` marker (always), and - when no value is set - keyboard focus seed,
   * so opening the picker without a value pre-selects local date.
   * Values themselves stay timezone-agnostic (UTC-carried), see class doc.
   */
  private findViewDate() {
    //const date = new Date();
    // TODO
    //this.viewHour.set(date.getHours());
    //this.viewMinute.set(date.getMinutes());
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
   * TODO: verify it is even needed at all.
   * @param e Mouse event.
   */
  public handlePanelMousedown(e: MouseEvent) {
    const target = e.target;
    if (target instanceof Element && target.closest('.day') !== null) return;
    e.preventDefault();
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
   * Also resets the pick session.
   */
  public hidePanel() {
    if (!this.isCalendarVisible()) return; // already hidden

    this.isCalendarVisible.set(false);
    // TODO reset internals
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
   * Handle focus leaving the picker entirely (e.g. Tab out of grid). It closes calendar panel and,
   * unless focus only moved inside the component, reports the control as touched.
   * Note the panel visibility is intentionally not checked: internal helpers hide the panel before
   * or after focus moves, so a closed panel must still report touch when focus really left.
   * @param e Focus event.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // TODO
}
