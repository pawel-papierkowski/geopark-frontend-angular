import { Component, effect, inject, model, input, output, linkedSignal, viewChild, ElementRef, DOCUMENT } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { IdService } from '@/shared/utils/id/id-service';
import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';
import { enTextBoxType } from '@/shared/ui/other/types';

/** Custom input type="text" implementation. It is just a wrapper for the actual <input>.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Accept string or null (not set) value.
 * - Can disable or mark as invalid.
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional. If omitted, unique `text-box-N` is generated; provide it explicitly for `<label for>` pairing or a stable test id.
 * - label - For `aria-labelledby`. Optional; dev mode warns when the id matches no element.
 * - type - Type of input. Optional, default is 'text'.
 * - allowPaste - If false, this input does not allow text insertion from outside (blocks paste and drag-drop insertion; cut stays possible). Optional, default is true.
 * - autocomplete - For autocomplete attribute of <input>. Optional.
 * - placeholder - Shows grayed out text in the background of input if null/empty. Optional.
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
  selector: 'text-box',
  imports: [ ],
  styleUrl: './text-box.css',
  templateUrl: './text-box.html',
})
export class TextBox implements FormValueControl<string | null> {
  private readonly idService = inject(IdService);
  /** Document the `label` id is resolved against (not the global, see `warnDanglingLabel`). */
  private readonly document = inject(DOCUMENT);

  /** Value held by component. */
  public value = model<string | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Resolved identifier: `ident` when provided, otherwise a generated `text-box-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  public readonly resolvedIdent = linkedSignal(() => this.idService.next(this.ident(), 'text-box'));
  /** Label reference. */
  public label = input<string>('');
  /** Type of input. */
  public type = input<enTextBoxType>('text');
  /** If false, this input does not allow text insertion from outside (paste and drag-drop). */
  public allowPaste = input<boolean>(true);
  /** For autocomplete attribute of <input>. */
  public autocomplete = input<string>('off');
  /** Shows grayed out text in background of input if value is null/empty. */
  public placeholder = input<string>('');
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  public touch = output<void>();

  /** Reference to the inner <input>; target of the `focus()` contract. */
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');

  /** True while an IME composition (e.g. Japanese kana input) is in progress - model updates are buffered until it ends. */
  private composing = false;

  constructor() {
    // Dev-only: catch a `label` id that matches no element. A dangling aria-labelledby would
    // leave this input with no accessible name (no aria-label fallback), which no app test
    // catches; re-runs whenever label or ident changes (see `warnDanglingLabel`).
    effect(() => {
      warnDanglingLabel(this.document, this.label(), this.resolvedIdent(), 'text-box');
    });
  }

  // FUNCTIONS

  /**
   * Focus the inner <input> on behalf of the signal-forms `Field` directive (optional
   * `FormUiControl.focus` contract - e.g. "focus first invalid field"). Without this method the
   * directive would fall back to focusing the non-focusable `<text-box>` host and silently do
   * nothing. No-op when disabled.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the input.
   */
  public focus(options?: FocusOptions): void {
    if (this.disabled()) return;
    this.inputRef().nativeElement.focus(options);
  }

  /**
   * Handle input event of the inner <input>. Ignored while an IME composition is in progress, so
   * intermediate composition strings never reach the model (same behavior as Angular's own
   * `DefaultValueAccessor`).
   * @param event Event data.
   */
  public onInput(event: Event) {
    if (this.composing) return;
    this.value.set(this.readInputValue(event));
  }

  /**
   * Handle composition start: begin buffering model updates until the composition ends.
   */
  public onCompositionStart() {
    this.composing = true;
  }

  /**
   * Handle composition end: stop buffering and commit the final composed text.
   * @param event Event data.
   */
  public onCompositionEnd(event: Event) {
    this.composing = false;
    this.value.set(this.readInputValue(event));
  }

  /**
   * Handle blur of the inner <input>. Blur caused by the input becoming disabled while focused
   * is programmatic, not a user leaving the control, so it must not mark the field as touched.
   */
  public handleBlur() {
    if (this.disabled()) return;
    this.touch.emit();
  }

  /**
   * Handle paste event.
   * @param event Event data.
   */
  public onPaste(event: ClipboardEvent) {
    if (!this.allowPaste()) event.preventDefault();
  }

  /**
   * Handle drop event: blocks drag-and-drop insertion of text when pasting is not allowed.
   * A drop does not fire a paste event, so `onPaste` alone would not catch it.
   * @param event Event data.
   */
  public onDrop(event: DragEvent) {
    if (!this.allowPaste()) event.preventDefault();
  }

  /**
   * Read current text of the inner <input>.
   * @param event Event carrying the input element as its target.
   * @returns Current value of the input.
   */
  private readInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
