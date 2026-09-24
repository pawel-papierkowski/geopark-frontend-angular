import { Component, model, input, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

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
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional.
 * - label - For `aria-labelledby`. Optional.
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
  selector: 'date-picker',
  imports: [  ],
  styleUrl: './date-picker.css',
  templateUrl: './date-picker.html',
})
export class DatePicker implements FormValueControl<Date | null> {
  /** Value held by component. */
  value = model<Date | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
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

  // TODO
}
