import { Component, model, input, output, computed, inject, linkedSignal, signal, viewChild, DestroyRef, DOCUMENT, ElementRef } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { IdService } from '@/shared/utils/id/id-service';
import { enDateTimePickerMode } from '@/shared/ui/other/types';

import { DatePicker } from './date-picker';
import { TimePicker } from './time-picker';

/**
 * This is a date and time picker. Uses `Date` class for both input and output.
 * It is wrapper for two subcomponents: `DatePicker` and `TimePicker`.
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Values are read/written through UTC accessors, but the time sub-picker's default "current time"
 * highlight and keyboard/scroll seed (used when no value is set) come from the browser's local timezone.
 * Designed to be used with signal-based forms.
 *
 * Note: DatePicker sub-picker is still a placeholder (only its shell renders), so `mode="date"` and
 * the date part of `mode="datetime"` are not usable yet. `mode="time"` is fully functional.
 *
 * Features:
 * - Can select date, time or both date and time.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported (moving between subcomponents).
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional. If omitted, unique `date-time-picker-N` is generated; provide it explicitly for `<label for>` pairing or a stable test id.
 * - label - For `aria-labelledby`. Optional.
 * - mode - Mode of operation (both date and time, only date, only time). Optional, default is 'datetime'.
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
  selector: 'date-time-picker',
  imports: [ DatePicker, TimePicker ],
  styleUrl: './date-time-picker.css',
  templateUrl: './date-time-picker.html',
})
export class DateTimePicker implements FormValueControl<Date | null> {
  private readonly idService = inject(IdService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Value held by component. */
  public value = model<Date | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Resolved identifier: `ident` when provided, otherwise a generated `date-time-picker-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  public readonly resolvedIdent = linkedSignal(() => this.idService.next(this.ident(), 'date-time-picker'));
  /** Label reference. */
  public label = input<string>('');
  /** Mode of operation (both date and time, only date, only time). */
  public mode = input<enDateTimePickerMode>('datetime');
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

  /** Whether the current label activation's focus redirect just opened the panel; the click that
   * label activation forwards right after the focus must then be swallowed instead of toggling
   * the panel closed again. Mirrors combo-box `focusOpened`. */
  private focusOpened = signal(false);

  /** What this label activation's forwarded click decided. Engines disagree on label activation
   * order: Chromium/Firefox focus the hidden button first and forward the click second, WebKit
   * does the reverse - so the focus handler that runs AFTER the click (WebKit) must only restore
   * focus, never re-run the toggle the click already made. `none` until a forwarded click runs;
   * reset at the start of every pointer interaction, like `focusOpened`. */
  private labelClickDecision = signal<'none' | 'open' | 'closed'>('none');

  /** Date sub-picker component. Absent when `mode` does not render it, hence not `required`. */
  private datePicker = viewChild(DatePicker);
  /** Time sub-picker component. Absent when `mode` does not render it, hence not `required`. */
  private timePicker = viewChild(TimePicker);
  /** Root element of the wrapper - the containment boundary deciding whether a pointer press
   * landed "outside" the component (see the outside-press close in the constructor). */
  private rootRef = viewChild.required<ElementRef<HTMLDivElement>>('rootRef');

  /** Identifiers of sub-pickers, derived from resolved ident so they follow it when it changes. */
  public dateIdent = computed(() => `dateId_${this.resolvedIdent()}`);
  public timeIdent = computed(() => `timeId_${this.resolvedIdent()}`);

  constructor() {
    // A <label> is not focusable, so mousedown on it moves focus from the sub-picker input to
    // <body>; that blur closes the panel and reports a spurious touch, right before label
    // activation refocuses the input and reopens the panel. Canceling the default keeps focus in
    // place - label activation runs on the subsequent click, so redirecting focus still works.
    // Capture phase, so no other handler can swallow it first; mousedown (not pointerdown),
    // because canceling pointerdown would also suppress the click and break label activation.

    /**
     * Begin a fresh pointer interaction: cancel focus steal when the press lands on this
     * component's associated label, and close the open time panel when the press lands
     * outside the wrapper entirely.
     * Resetting `focusOpened` handles a focus-only activation that never received its click -
     * without it, that stale marker would swallow the next activation's toggle. Resetting
     * `labelClickDecision` equally clears the previous activation's click decision, so a fresh
     * activation is never judged by its predecessor. Reset happens before label activation's
     * focus (and its markers) of the interaction that follows.
     *
     * The outside-press close exists because focusout alone does not cover pointer presses:
     * WebKit does not reliably move focus on an outside press (buttons and other non-text
     * controls are not click-focused on macOS, and pressing non-focusable content does not
     * necessarily blur the focused element), so the focusout-only close leaves the panel open
     * there. The press handler closes unconditionally of focus - the focusout path stays for
     * Tab and other programmatic focus moves, and it (not this handler) reports `touch`.
     * @param e Mousedown event.
     */
    const handleDocumentMousedown = (e: Event) => {
      this.focusOpened.set(false);
      this.labelClickDecision.set('none');
      const target = e.target;
      const ident = this.resolvedIdent();
      const isOwnLabel = ident !== '' && target instanceof HTMLLabelElement && target.htmlFor === ident;

      // Prevent reopening panel when you click outside panel, but on label.
      if (isOwnLabel) {
        e.preventDefault();
        return;
      }

      const timePicker = this.timePicker();
      if (timePicker !== undefined && target instanceof Node && !this.rootRef().nativeElement.contains(target)) {
        timePicker.hidePanel();
      }
    };
    this.document.addEventListener('mousedown', handleDocumentMousedown, true);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('mousedown', handleDocumentMousedown, true));
  }

  // INTERACTIONS

  /**
   * Handle label activation focusing its hidden target (the wrapper's hidden button).
   * What it may do depends on the engine's label activation order:
   * - Focus first (Chromium/Firefox): panel state here predates this activation's click, so a
   *   closed panel means this is the open half - redirect focus into the sub-picker input; the
   *   input's focus handler auto-opens the panel (same end state as clicking it or Tab-ing in),
   *   and the redirect is remembered so the paired click right after is swallowed instead of
   *   toggling the panel closed again.
   * - Click first (WebKit): the forwarded click already recorded its decision (`open`/`closed`),
   *   so this only steers focus back from the hidden button the activation stole it for -
   *   a closed panel stays closed (suppressed refocus via `hidePanelAndRefocus`), an open one
   *   just gets focus returned without toggling.
   */
  public handleLabelFocus() {
    if (this.disabled()) return;
    const decision = this.labelClickDecision();
    if (decision === 'closed') {
      // The click closed the panel - restore focus on the input without triggering auto-open.
      this.timePicker()?.hidePanelAndRefocus();
      return;
    }
    if (decision === 'open') {
      // The click owns the open; the panel is already visible, so a plain redirect cannot toggle.
      this.focusSubPicker();
      return;
    }
    const timePicker = this.timePicker();
    // TODO: once DatePicker is a real picker, account for its panel state here as well.
    const wasClosed = timePicker !== undefined && !timePicker.isClockVisible();
    this.focusSubPicker();
    if (wasClosed) this.focusOpened.set(true);
  }

  /**
   * Handle the click label activation forwards to its hidden target (clicks on the hidden button
   * do not bubble into the sub-pickers, so the wrapper has to toggle on their behalf).
   * First activation: the paired focus just opened the panel - swallow the click (no toggle).
   * Every later activation toggles: when open, close via `hidePanelAndRefocus()` so focus parks
   * on the input without re-triggering auto-open; when closed, redirect focus to reopen.
   * Each toggle is recorded in `labelClickDecision` for engines that forward the click BEFORE
   * focusing the hidden button (WebKit), where the focus handler runs after this one and must
   * not undo the decision made here.
   */
  public handleLabelClick() {
    if (this.disabled()) return;
    if (this.focusOpened()) {
      this.focusOpened.set(false);
      return;
    }
    const timePicker = this.timePicker();
    // TODO: once DatePicker is a real picker, toggle its panel here as well.
    if (timePicker !== undefined && timePicker.isClockVisible()) {
      this.labelClickDecision.set('closed');
      timePicker.hidePanelAndRefocus();
      return;
    }
    this.labelClickDecision.set('open');
    this.focusSubPicker();
    // The redirect above opens only through the input's focus event - when the input ALREADY
    // holds focus (click-first order after a close parks it there) no event fires, so complete
    // the open explicitly to keep the click's toggle reliable.
    if (timePicker !== undefined && !timePicker.isClockVisible()) timePicker.openPanel();
  }

  /**
   * Move focus from the hidden label target into a sub-picker input - the open half of label
   * activation. Focusing the input lets its own focus handler auto-open the panel and steer
   * keyboard focus into it. The date sub-picker leads `datetime`, but the placeholder DatePicker
   * has no focusable input yet: its `focusInput()` returns null there, so focus falls through to
   * the time sub-picker.
   */
  private focusSubPicker() {
    const datePicker = this.datePicker();
    if (datePicker !== undefined && datePicker.focusInput() !== null) return;
    this.timePicker()?.focusInput();
  }

  /**
   * Handle focus moving between the two pickers.
   * When one input receives focus, the other picker's panel is closed.
   * TODO: placeholder, will be finished when both date and time pickers exist
   */
  public handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;

    // If date input received focus, close time panel.
    if (target.id === `${this.dateIdent()}_input`) {
      //this.datePicker()?.hidePanel(); TODO
    }
    // If time input received focus, close date panel.
    if (target.id === `${this.timeIdent()}_input`) {
      //this.timePicker()?.hidePanel(); // TODO
    }
  }
}
