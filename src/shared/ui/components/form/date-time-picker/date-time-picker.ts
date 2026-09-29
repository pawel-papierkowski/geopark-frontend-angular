import { Component, model, input, output, computed, inject, linkedSignal, viewChild, DestroyRef, DOCUMENT } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { IdService } from '@/shared/utils/id/id-service';
import { enDateTimePickerMode } from '@/shared/ui/other/types';

import { DatePicker } from './date-picker';
import { TimePicker } from './time-picker';

/**
 * This is a date and time picker. Uses `Date` class for both input and output.
 * It is wrapper for two subcomponents: `DatePicker` and `TimePicker`.
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
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
  value = model<Date | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Resolved identifier: `ident` when provided, otherwise a generated `date-time-picker-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  readonly resolvedIdent = linkedSignal(() => this.ident() || this.idService.next('date-time-picker'));
  /** Label reference. */
  label = input<string>('');
  /** Mode of operation (both date and time, only date, only time). */
  mode = input<enDateTimePickerMode>('datetime');
  /** If true, allow deselecting date. */
  canNull = input<boolean>(false);
  /** If true, show weeks. */
  showWeeks = input<boolean>(false);
  /** If not null, defines earliest allowed date. */
  dateMin = input<Date | null>(null);
  /** If not null, defines latest allowed date. */
  dateMax = input<Date | null>(null);
  /** Is component required? */
  readonly required = input<boolean>(false);
  /** Is component disabled? */
  readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  touch = output<void>();

  /** Date sub-picker component. Absent when `mode` does not render it, hence not `required`. */
  datePicker = viewChild(DatePicker);
  /** Time sub-picker component. Absent when `mode` does not render it, hence not `required`. */
  timePicker = viewChild(TimePicker);

  /** Identifiers of sub-pickers, derived from resolved ident so they follow it when it changes. */
  dateIdent = computed(() => `dateId_${this.resolvedIdent()}`);
  timeIdent = computed(() => `timeId_${this.resolvedIdent()}`);

  constructor() {
    // A <label> is not focusable, so mousedown on it moves focus from the sub-picker input to
    // <body>; that blur closes the panel and reports a spurious touch, right before label
    // activation refocuses the input and reopens the panel. Canceling the default keeps focus in
    // place - label activation runs on the subsequent click, so redirecting focus still works.
    // Capture phase, so no other handler can swallow it first; mousedown (not pointerdown),
    // because canceling pointerdown would also suppress the click and break label activation.

    /**
     * Cancel focus steal when pointer down lands on this component's associated label.
     * @param e Mousedown event.
     */
    const preventLabelMousedown = (e: Event) => {
      const target = e.target;
      const ident = this.resolvedIdent();
      if (ident && target instanceof HTMLLabelElement && target.htmlFor === ident) {
        e.preventDefault();
      }
    };
    this.document.addEventListener('mousedown', preventLabelMousedown, true);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('mousedown', preventLabelMousedown, true));
  }

  // INTERACTIONS

  /**
   * Move focus from the hidden label target into a sub-picker input. Label activation focuses (and
   * clicks) the hidden button, whose handlers call this; landing on the sub-picker's input
   * lets its own focus handler auto-open the panel and move keyboard focus into it - the same end
   * state as clicking the input or Tab-ing into it.
   * The date sub-picker leads `datetime`, but the placeholder DatePicker has no focusable input yet:
   * its `focusInput()` returns null there, so focus falls through to the time sub-picker.
   */
  focusRoot() {
    if (this.disabled()) return;
    const datePicker = this.datePicker();
    if (datePicker !== undefined && datePicker.focusInput() !== null) return;
    this.timePicker()?.focusInput();
  }

  /**
   * Handle focus moving between the two pickers.
   * When one input receives focus, the other picker's panel is closed.
   * TODO: placeholder, will be finished when both date and time pickers exist
   */
  handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;

    // If date input received focus, close time panel.
    if (target.id === this.dateIdent()) {
      //this.datePicker()?.hidePanel(); TODO
    }
    // If time input received focus, close date panel.
    if (target.id === this.timeIdent()) {
      //this.timePicker()?.hidePanel(); // TODO
    }
  }
}
