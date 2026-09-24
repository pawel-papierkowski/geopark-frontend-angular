import { Component, model, input, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

/**
 * This is a time picker. Uses `Date` class for both input and output. Do not use it directly.
 * Use DateTimePicker with attribute mode="time".
 * Note it is timezone-agnostic. It is up to you to adjust result to timezone etc. as needed.
 * Designed to be used with signal-based forms.
 *
 * CURRENTLY PLACEHOLDER.
 *
 * Features:
 * - Can select time.
 * - Can disable or mark as invalid.
 * - Keyboard navigation supported via arrows (open panel or change hour/minute), enter/space (pick hour/minute) and esc (close panel).
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
  selector: 'time-picker',
  imports: [  ],
  styleUrl: './time-picker.css',
  templateUrl: './time-picker.html',
})
export class TimePicker implements FormValueControl<Date | null> {
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
  /** Informs that user blurred out of component. */
  touch = output<void>();

  // TODO
}
