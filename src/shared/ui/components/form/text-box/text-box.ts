import { Component, model, input, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TextBoxType } from '@/shared/ui/other/types';

/** Custom input type="text" implementation.
 * For now it is just a wrapper for the actual <input>.
 *
 * Features:
 * - Accept string or null (not set) value.
 * - Can disable or mark as invalid.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional.
 * - label - For `aria-labelledby`.
 * - type - Type of input. Optional, default is 'text'.
 * - allowPaste - If false, this input does not allow pasting text into the field. Optional, default is true.
 * - autocomplete - For autocomplete attribute of <input>. Optional.
 * - placeholder - Shows grayed out text in the background of input if null/empty. Optional.
 * - required - If true, component is required. Optional, default is false.
 * - disabled - If true, acts as disabled component. Optional, default is false.
 * - invalid - If true, acts as invalid component. Visual only. Optional, default is false.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 */
@Component({
  selector: 'text-box',
  imports: [ ],
  styleUrl: './text-box.css',
  templateUrl: './text-box.html',
})
export class TextBox implements FormValueControl<string | null> {
  /** Value held by component. */
  value = model<string | null>(null);
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
  /** Type of input. */
  type = input<TextBoxType>('text');
  /** If false, this input does not allow pasting text into the field. */
  allowPaste = input<boolean>(true);
  /** For autocomplete attribute of <input>. */
  autocomplete = input<string>('off');
  /** Shows grayed out text in background of input if value is null/empty. */
  placeholder = input<string>('');
  /** Is component required? */
  readonly required = input<boolean>(false);
  /** Is component disabled? */
  readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  touch = output<void>();

  //

  /**
   * Handle paste event.
   * @param event Event data.
   */
  onPaste(event: ClipboardEvent) {
    if (!this.allowPaste()) event.preventDefault();
  }
}
