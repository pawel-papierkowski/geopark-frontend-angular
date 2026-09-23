import { Component, model, input, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

/** Custom combobox implementation. Needed because <select> and <option> have very poor CSS support for dropdown lists
 * across all browsers.
 * Designed to be used with signal-based forms.
 *
 * CURRENTLY PLACEHOLDER.
 *
 * Features:
 * - Accept number (so also enums), string or null (not set) value.
 * - You provide a list of options. Can use null value as option.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows. Enter/space selects option and closes list.
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional.
 * - label - For `aria-labelledby`. Optional.
 * - options - Array of options, will be shown after user clicks on component. Can contain null value for 'unselected'.
 * - langPrefix - Prefix, used for auto-translating entries in dropdown list. If empty, options and placeholder will be shown as is without translation.
 * - placeholder - Translation key to use if nothing is selected. Treated as raw text if langPrefix is empty. Optional, not used if options have null entry.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 *
 * Special (set indirectly):
 * - required - If true, component is required. Default is false.
 * - disabled - If true, acts as disabled component. Default is false.
 * - invalid - If true, shows component as having invalid state. Visual only. Default is false.
 *
 * Notes:
 * - Null value is supported as option. Example: const enUserStatus: (string|null)[] = [ null, 'PENDING', 'ACTIVE' ];
 */
@Component({
  selector: 'combo-box',
  imports: [ ],
  styleUrl: './combo-box.css',
  templateUrl: './combo-box.html',
})
export class ComboBox implements FormValueControl<number | string | null> {
  /** Value held by component. */
  value = model<number | string | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
  /** Array of options. String, number (so also enum) and null allowed. */
  options = input<(number | string | null)[]>([]);
  /** Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation. */
  langPrefix = input<string>('');
  /** Translation key to use if nothing is selected. Treated as raw text if langPrefix is empty. Optional, not used if options have null entry. */
  placeholder = input<string>('');
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
