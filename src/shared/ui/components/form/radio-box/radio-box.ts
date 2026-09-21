import { Component, inject, model, input, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import {TranslateService } from '@ngx-translate/core';

import { NavUtils } from '@/core/utils/NavUtils';

/**
 * Custom form component that allows selecting between multiple choices. Equivalent of `<input type="radio">`.
 *
 * Features:
 * - Accept number (so also enums), string or null (not set) value.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows (automatically selects an option). Enter/Space moves to next component.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and `id` attribute in focusable element (so `<label>` etc. work properly). Used instead of `id` for technical reasons. Optional.
 * - label - For `aria-labelledby`.
 * - options - Array of options. String, number (so also enum) and null allowed.
 * - langPrefix - Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation.
 * - disable - If true, acts as disabled component. Optional, default is false.
 * - invalid - If true, acts as invalid component. Visual only. Optional, default is false.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 */
@Component({
  selector: 'radio-box',
  imports: [ ],
  styleUrl: './radio-box.css',
  templateUrl: './radio-box.html',
})
export class RadioBox implements FormValueControl<number | string | null> {
  private readonly translateService = inject(TranslateService);

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
  /** Is component disabled? */
  disable = input<boolean>(false);
  /** Is component invalid? */
  invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  touch = output<void>();

  optionId(index: number): string {
    return this.ident() + '_opt_' + index;
  }

  /**
   * Show option on webpage.
   * @param option Current option.
   * @returns Text of option, possibly translated.
   */
  showOption(option: number | string | null): number | string | null {
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
  selectOption(option: number | string | null, index: number) {
    if (this.disable()) return;
    this.value.update(() => option);

    if (index !== undefined) {
      const optionEl = document.getElementById(this.optionId(index));
      if (optionEl) optionEl.focus();
    }
  }

  //

  /**
   * Handle keyboard events for accessibility.
   * Arrow keys selects next/previous options, Space/Enter moves to next focusable component (so user can leave this component).
   * @param e Keyboard event.
   */
  handleKeydown(e: KeyboardEvent): void {
    if (this.disable()) return;

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
  findActiveElement = (): HTMLElement | null => {
    const selectedIndex = this.options().findIndex((o) => o === this.value());
    const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
    return document.getElementById(this.optionId(targetIndex));
  };

  /** Move focus to the next focusable element on the page. */
  focusNext() {
    const el = this.findActiveElement();
    NavUtils.FocusNext(el);
  }

  /** Focus on chosen option inside. */
  onGroupFocus = () => {
    // Immediately change focus to actually selected option (or first option if nothing is selected).
    const el = this.findActiveElement();
    el?.focus();
  }
}
