import { Component, model, input, output, computed, inject, linkedSignal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { IdService } from '@/shared/utils/id/id-service';

/**
 * Custom form component that allows choice between true, false and null (optional). Equivalent of `<input type="checkbox">`.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Accept true, false or null (not set) value.
 * - Can disable or mark as invalid.
 * - Mouse click and keyboard (enter or space) cycles between possible values.
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and `id` attribute in focusable element (so `<label>` etc. work properly). Used instead of `id` for technical reasons. Optional. If omitted, unique `check-box-N` is generated; provide it explicitly for `<label for>` pairing or a stable test id.
 * - label - For `aria-labelledby`. Optional.
 * - canNull - If true, can use `null` value when cycling checkbox. Note `canNull` affects only user ability to set `null` value. Component still can have `null` set programmatically.
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
  selector: 'check-box',
  imports: [ ],
  styleUrl: './check-box.css',
  templateUrl: './check-box.html',
})
export class CheckBox implements FormValueControl<boolean | null> {
  private readonly idService = inject(IdService);

  /** Value held by component. */
  public value = model<boolean | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Resolved identifier: `ident` when provided, otherwise a generated `check-box-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  public readonly resolvedIdent = linkedSignal(() => this.idService.next(this.ident(), 'check-box'));
  /** Label reference. */
  public label = input<string>('');
  /** Can use null value? */
  public canNull = input<boolean>(false);
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  public touch = output<void>();

  // COMPUTED

  /** Compute value needed for aria-checked. */
  public ariaChecked = computed(() => {
    if (this.value() === null) return 'mixed';
    return this.value();
  });

  // FUNCTIONS

  /**
   * Toggle value of checkbox.
   */
  public toggle() {
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
