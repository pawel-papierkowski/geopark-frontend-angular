import { Component, model, input, output, viewChild, ElementRef } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { enDateTimePickerMode } from '@/shared/ui/other/types';

import { DatePicker } from './date-picker';
import { TimePicker } from './time-picker';

/**
 * This is a date and time picker. Uses `Date` class for both input and output.
 * It is wrapper for two subcomponents: `DatePicker` and `TimePicker`.
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Designed to be used with signal-based forms.
 *
 * CURRENTLY PLACEHOLDER.
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
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional.
 * - label - For `aria-labelledby`. Optional.
 * - mode - Mode of operation (both date and time, only date, only time). Optional, default is 'datetime'.
 * - canNull - If true, allow deselecting date. Optional, default is false.
 * - showWeeks - If true, show weeks. Optional, default is false.
 * - dateTimeMin - If not null, defines earliest allowed date. Optional, default is null.
 * - dateTimeMax - If not null, defines latest allowed date. Optional, default is null.
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
  /** Value held by component. */
  value = model<Date | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
  /** Mode of operation (both date and time, only date, only time). */
  mode = input<enDateTimePickerMode>('datetime');
  /** If true, allow deselecting date. */
  canNull = input<boolean>(false);
  /** If true, show weeks. */
  showWeeks = input<boolean>(false);
  /** If not null, defines earliest allowed date. */
  dateTimeMin = input<Date | null>(null);
  /** If not null, defines latest allowed date. */
  dateTimeMax = input<Date | null>(null);
  /** Is component required? */
  readonly required = input<boolean>(false);
  /** Is component disabled? */
  readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  touch = output<void>();

  /** Root focusable element (role=combobox). */
  pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to date-picker. */
  datePickerRef = viewChild.required<ElementRef<HTMLDivElement>>('datePickerRef');
  /** Reference to time-picker. */
  timePickerRef = viewChild.required<ElementRef<HTMLDivElement>>('timePickerRef');

  dateId = `datepicker_${this.ident()}`;
  timeId = `timepicker_${this.ident()}`;

  // INTERACTIONS

  /**
   * Move focus from hidden label target to the picker root. Label activation focuses the hidden
   * button; redirecting keeps DOM focus on the element that owns aria-activedescendant and makes
   * the root's (blur) fire when the user later leaves the component.
   */
  focusRoot() {
    if (this.disabled()) return;
    this.pickerRef().nativeElement.focus();
  }

  /**
   * Handle focus moving between the two pickers.
   * When one input receives focus, the other picker's panel is closed.
   */
  handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;

    // If time input received focus, close date panel.
    if (target.id === this.timeId) {
      //this.datePickerRef()?.hidePanel(); TODO
    }
    // If date input received focus, close time panel.
    if (target.id === this.dateId) {
      //this.timePickerRef()?.hidePanel(); // TODO
    }
  }
}
