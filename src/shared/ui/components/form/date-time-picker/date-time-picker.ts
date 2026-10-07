import { Component, model, input, output, computed, inject, linkedSignal, viewChild, DestroyRef, DOCUMENT, ElementRef } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { IdService } from '@/shared/utils/id/id-service';
import { enDateTimePickerMode } from '@/shared/ui/other/types';
import { LabelActivation } from '@/shared/ui/components/form/popup-panel/popup-label-activation';

import { DatePicker } from './date-picker';
import { TimePicker } from './time-picker';

/**
 * This is a date and time picker. Uses `Date` class for both input and output.
 * It is wrapper for two subcomponents: `DatePicker` and `TimePicker`.
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Values are read/written through UTC accessors, but the time sub-picker's default "current time"
 * highlight and keyboard/scroll seed (used when no value is set) come from the browser's local
 * timezone, and a time picked with no prior value is written onto the LOCAL calendar date
 * (UTC-anchored), so it always lands on the day the user sees as today.
 * Designed to be used with signal-based forms.
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
 * - label - Id of an external `<label>` element, forwarded to the sub-pickers for `aria-labelledby` (the visible `<label for>` targets this component's hidden button, not the inputs). In `datetime` mode each sub-input additionally appends a hidden "Date"/"Time" qualifier, so both inputs named by the same label stay distinguishable. The id must match an element in the document - a dangling reference silently empties the inputs' names, so dev mode warns on the console (see `warnDanglingLabel`). Optional.
 * - mode - Mode of operation (both date and time, only date, only time). Optional, default is 'datetime'.
 * - canNull - If true, allow deselecting date. Optional, default is false.
 * - showWeeks - If true, show weeks. Optional, default is false.
 * - dateMin - If not null, defines earliest allowed date. Interpreted as a calendar day: the bound's LOCAL date part (time-of-day ignored), so `new Date()` means "from today". Optional, default is null.
 * - dateMax - If not null, defines latest allowed date. Same calendar-day rule as `dateMin`. Optional, default is null.
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
  /** If not null, defines earliest allowed date. Interpreted as the bound's LOCAL calendar day (time-of-day ignored). */
  public dateMin = input<Date | null>(null);
  /** If not null, defines latest allowed date. Interpreted as the bound's LOCAL calendar day (time-of-day ignored). */
  public dateMax = input<Date | null>(null);
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  public touch = output<void>();

  /** Label-activation coordination (focus-opens marker + forwarded-click decision) plus the
   * document guard; see `LabelActivation` for the full contract. `closed:date`/`closed:time`
   * record WHICH sub-picker the click closed, because by the time the focus handler runs that
   * panel is already shut and its visibility can no longer tell the two apart. */
  private readonly labelActivation = new LabelActivation<'closed:date' | 'closed:time'>();

  /** Date sub-picker component. Absent when `mode` does not render it, hence not `required`. */
  private datePicker = viewChild(DatePicker);
  /** Time sub-picker component. Absent when `mode` does not render it, hence not `required`. */
  private timePicker = viewChild(TimePicker);
  /** Root element of the wrapper - the containment boundary deciding whether a pointer press
   * landed "outside" the component (see the outside-press close in the constructor), and the
   * boundary the sub-pickers use for focus containment (forwarded as their `container` input),
   * so focus moving between them never reads as a blur. */
  private rootRef = viewChild.required<ElementRef<HTMLDivElement>>('rootRef');

  /** Identifiers of sub-pickers, derived from resolved ident so they follow it when it changes. */
  public dateIdent = computed(() => `dateId_${this.resolvedIdent()}`);
  public timeIdent = computed(() => `timeId_${this.resolvedIdent()}`);

  constructor() {
    // Document-level guard for label activation: resets the interaction markers, cancels the
    // focus steal when the press lands on this component's own label and closes the sub-picker
    // panels when the press lands outside the wrapper entirely (mechanics and rationale in
    // `LabelActivation.installDocumentGuard`).
    this.labelActivation.installDocumentGuard({
      document: this.document,
      destroyRef: this.destroyRef,
      ident: () => this.resolvedIdent(),
      boundary: () => this.rootRef().nativeElement,
      onOutsidePress: () => {
        this.datePicker()?.hidePanel();
        this.timePicker()?.hidePanel();
      },
    });
  }

  /**
   * Focus the control on behalf of the signal-forms `Field` directive (the optional
   * `FormUiControl.focus` contract - e.g. "focus first valid field").
   * Mirrors label activation: delegates to the sub-picker that owns the focusable input
   * (date leads, if missing falls through to time), whose focus handler auto-opens its
   * panel like Tab does. No-op when disabled.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the input.
   */
  public focus(options?: FocusOptions): void {
    if (this.disabled()) return;
    this.focusSubPicker(options);
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
   *   a closed panel stays closed (restore via `hidePanelAndRefocus`, which suppresses the
   *   auto-open on the input it focuses), an open one just gets focus returned without toggling.
   */
  public handleLabelFocus() {
    if (this.disabled()) return;
    const datePicker = this.datePicker();
    const timePicker = this.timePicker();

    const decision = this.labelActivation.consumeDecision();
    if (decision === 'closed:date' || decision === 'closed:time') {
      // The click already closed this sub-picker's panel - restore focus on its input without
      // re-running the toggle. Deliberately NOT gated on visibility: the click closed the panel
      // BEFORE this focus handler ran (click-first order), so the panel is always shut here and
      // a visibility check would skip the restore, parking focus on the hidden button.
      if (decision === 'closed:date') datePicker?.hidePanelAndRefocus();
      else timePicker?.hidePanelAndRefocus();
      return;
    }
    if (decision === 'open') {
      // The click owns the open; the panel is already visible, so a plain redirect cannot toggle.
      this.focusSubPicker();
      return;
    }
    // We know decision is 'none'. `wasClosed` means "NEITHER panel is open".
    const wasClosed = !(datePicker?.isCalendarVisible() ?? false) && !(timePicker?.isClockVisible() ?? false);
    this.focusSubPicker();
    if (wasClosed) this.labelActivation.focusOpened.set(true);
  }

  /**
   * Handle the click label activation forwards to its hidden target (clicks on the hidden button
   * do not bubble into the sub-pickers, so the wrapper has to toggle on their behalf).
   * First activation: the paired focus just opened the panel - swallow the click (no toggle).
   * Every later activation toggles: when open, close via `hidePanelAndRefocus()` so focus parks
   * on the input without re-triggering auto-open; when closed, redirect focus to reopen.
   * Each toggle is recorded in the label activation's click decision for engines that forward
   * the click BEFORE focusing the hidden button (WebKit), where the focus handler runs after
   * this one and must not undo the decision made here.
   */
  public handleLabelClick() {
    if (this.disabled()) return;
    if (this.labelActivation.focusOpened()) {
      this.labelActivation.focusOpened.set(false);
      return;
    }
    const datePicker = this.datePicker();
    if (datePicker !== undefined && datePicker.isCalendarVisible()) {
      this.labelActivation.setDecision('closed:date');
      datePicker.hidePanelAndRefocus();
      return;
    }
    const timePicker = this.timePicker();
    if (timePicker !== undefined && timePicker.isClockVisible()) {
      this.labelActivation.setDecision('closed:time');
      timePicker.hidePanelAndRefocus();
      return;
    }

    // Both are closed already, so we open one of them. datePicker has priority.
    this.labelActivation.setDecision('open');
    this.focusSubPicker();

    // The redirect above opens only through the input's focus event - when the input ALREADY
    // holds focus (click-first order after a close parks it there) no event fires, so complete
    // the open explicitly to keep the click's toggle reliable (showPanel no-ops when visible).
    if (datePicker !== undefined) {
      void datePicker.showPanel();
      return;
    }
    if (timePicker !== undefined) void timePicker.showPanel();
  }

  /**
   * Move focus from the hidden label target into a sub-picker input - the open half of label
   * activation. Focusing the input lets its own focus handler auto-open the panel and steer
   * keyboard focus into it.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the focused input.
   */
  private focusSubPicker(options?: FocusOptions) {
    const datePicker = this.datePicker();
    if (datePicker !== undefined && datePicker.focusInput(options) !== null) return;
    this.timePicker()?.focusInput(options);
  }

  /**
   * Handle focus moving between the two pickers.
   * When one input receives focus, the other picker's panel is closed.
   */
  public handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;

    // If date input received focus, close time panel.
    if (target === this.datePicker()?.inputRef().nativeElement) {
      this.timePicker()?.hidePanel();
    }
    // If time input received focus, close date panel.
    if (target === this.timePicker()?.inputRef().nativeElement) {
      this.datePicker()?.hidePanel();
    }
  }
}
