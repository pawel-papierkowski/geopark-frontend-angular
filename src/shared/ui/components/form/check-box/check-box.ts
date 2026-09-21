import { Component, model, input, output, computed } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

/**
 * Custom form component that allows choice between true, false and null (optional). Equivalent of `<input type="checkbox">`.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and `id` attribute in focusable element (so `<label>` etc. work properly). Used instead of `id` for technical reasons. Optional.
 * - label - For `aria-labelledby`.
 * - canNull - If true, can use `null` values when changing value of checkbox.
 * - disabled - If true, acts as disabled component. Optional, default is false.
 * - invalid - If true, shows component as having invalid state. Visual only. Optional, default is false.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 */
@Component({
  selector: 'check-box',
  imports: [ ],
  styleUrl: './check-box.css',
  templateUrl: './check-box.html',
})
export class CheckBox implements FormValueControl<boolean | null> {
  /** Identifier for this component. */
  ident = input<string>('');
  /** Label reference. */
  label = input<string>('');
  /** Value held by component. */
  value = model<boolean | null>(null);
  /** Can use null value? */
  canNull = input<boolean>(false);
  /** Is component disabled? */
  disabled = input<boolean>(false);
  /** Is component invalid? */
  invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  touch = output<void>();

  /** Compute value needed for aria-checked. */
  ariaChecked = computed(() => {
    if (this.value() === null) return 'mixed';
    return this.value();
  });

  /**
   * What should be shown as checkbox value?
   * @returns Checkbox character.
   */
  showSymbol = computed(() => {
    if (this.value() === null) return '◼';
    if (this.value()) return '✔';
    return '\u00A0'; // Non-breakable space used. Empty string or normal space would move checkbox visually when changing value.
  });

  /**
   * Toggle value of checkbox.
   */
  toggle() {
    if (this.disabled()) return;
    this.value.update(v => this.resolveValue(v));
  }

  /**
   * Resolve new value of checkbox.
   * Chain: null -> true -> false -> null
   * @param val Current value.
   * @returns New value.
   */
  private resolveValue(val: boolean | null): boolean | null {
    switch (val) {
      case null: return true;
      case true: return false;
      case false: return this.canNull() ? null : true;
    }
  }
}
