import { Component, inject, model, input, output, linkedSignal, ElementRef } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import {TranslateService } from '@ngx-translate/core';

import { NavUtils } from '@/core/utils/NavUtils';
import { IdService } from '@/shared/utils/id/id-service';

/**
 * Custom form component that allows selecting between multiple choices. Equivalent of `<input type="radio">`.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Accept number (so also enums), string or null (not set) value.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows (automatically selects an option). Enter/Space moves to next component.
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and `id` attribute in focusable element (so `<label>` etc. work properly). Used instead of `id` for technical reasons. Optional. If omitted, unique `radio-box-N` is generated; provide it explicitly for `<label for>` pairing or a stable test id.
 * - label - For `aria-labelledby`. Optional.
 * - options - Array of options. String, number (so also enum) and null allowed.
 * - langPrefix - Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation.
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
  selector: 'radio-box',
  imports: [ ],
  styleUrl: './radio-box.css',
  templateUrl: './radio-box.html',
})
export class RadioBox implements FormValueControl<number | string | null> {
  private readonly hostEl: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly translateService = inject(TranslateService);
  private readonly idService = inject(IdService);

  /** Value held by component. */
  public value = model<number | string | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Resolved identifier: `ident` when provided, otherwise a generated `radio-box-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  public readonly resolvedIdent = linkedSignal(() => this.idService.next(this.ident(), 'radio-box'));
  /** Label reference. */
  public label = input<string>('');
  /** Array of options. String, number (so also enum) and null allowed. */
  public options = input<(number | string | null)[]>([]);
  /** Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation. */
  public langPrefix = input<string>('');
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  public touch = output<void>();

  public optionId(index: number): string {
    return this.resolvedIdent() + '_opt_' + index;
  }

  /**
   * Show option on webpage.
   * @param option Current option.
   * @returns Text of option, possibly translated.
   */
  public showOption(option: number | string | null): number | string | null {
    if (this.langPrefix()) {
      const translationKey = this.langPrefix() + '.' + option;
      return this.translateService.instant(translationKey);
    }
    return option;
  }

  /**
   * User clicked on option.
   * @param option Option to select.
   * @param index Index of the option for focus management.
   */
  public selectOption(option: number | string | null, index: number) {
    if (this.disabled()) return;
    this.value.update(() => option);

    const optionEl = this.hostEl.nativeElement.querySelector<HTMLElement>(`#${this.optionId(index)}`);
    optionEl?.focus();
  }

  //

  /**
   * Handle keyboard events for accessibility.
   * Arrow keys selects next/previous options, Space/Enter moves to next focusable component (so user can leave this component).
   * @param e Keyboard event.
   */
  public handleKeydown(e: KeyboardEvent): void {
    if (this.disabled()) return;

    const currentIndex = this.options().findIndex((o) => o === this.value());
    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= this.options().length) nextIndex = 0; // Wraparound.
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) nextIndex = this.options().length - 1; // Wraparound.
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.focusNext();
        break;
      default:
        return;
    }

    if (nextIndex !== currentIndex) {
      this.selectOption(this.options()[nextIndex] ?? null, nextIndex);
    }
  }

  //

  /**
   * Returns selected element or first element if nothing is selected.
   * @returns Active element or null if could not find element.
   */
  private findActiveElement(): HTMLElement | null {
    const selectedIndex = this.options().findIndex((o) => o === this.value());
    const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
    return this.hostEl.nativeElement.querySelector<HTMLElement>(`#${this.optionId(targetIndex)}`);
  };

  /** Move focus to the next focusable element on the page. */
  private focusNext() {
    const el = this.findActiveElement();
    NavUtils.FocusNext(el);
    this.touch.emit();
  }
}
