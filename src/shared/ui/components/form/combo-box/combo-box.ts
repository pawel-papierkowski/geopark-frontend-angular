import { Component, effect, inject, model, input, output, computed, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import {TranslateService } from '@ngx-translate/core';

/** Custom combobox implementation. Needed because <select> and <option> have very poor CSS support for dropdown lists
 * across all browsers.
 * Designed to be used with signal-based forms.
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

  /** Indicates visibility of combobox list. */
  isOpen = signal(false);
  /** Tracks if focus handler just opened the list (to suppress synthetic follow-up click).  */
  focusOpened = signal(false);
  /** Index of currently highlighted option. -1 means none highlighted. */
  highlightedIndex = signal(-1);

  constructor() {
    // Watch `disabled` field: close open list when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isOpen()) this.hidePanel();
    });
  }

  // COMPUTED

  /** Class of decorative arrow on right. */
  arrowClass = computed(() => ({ open: this.isOpen() }));
  /** Compute identifier for listbox used by aria-controls. */
  listboxId = computed(() => {
    return `${this.ident() || 'default'}_listbox`;
  });

  // GENERAL FUNCTIONS

  /** Get option element ID for aria-activedescendant. */
  optionId(index: number): string  {
    return `${this.ident()}_option_${index}`;
  }

  /** Open list. */
  openList(top: boolean | null = null) {
    this.isOpen.set(true);

    // Set visually selected entry, if any. Works with null selection.
    this.highlightedIndex.set(this.options().findIndex((o) => o === this.value()));

    if (this.highlightedIndex() === -1 && top !== null) {
      // Still nothing highlighted and we want to highlight either beginning or end of list.
      this.highlightedIndex.set(top ? 0 : this.options().length - 1);
    }
  }

  /**
   * User clicked on combobox option.
   * @param option Clicked option.
   */
  selectOption(option: number | string | null) {
    if (this.disabled()) return;

    this.value.set(option);
    this.isOpen.set(false);
    this.resetInteractionState();
  }

  /**
   * Show text of option if selected. In case of no selection or value that is not in options,
   * placeholder text will be shown.
   * @param option Option to show.
   */
  showOption(option: number | string | null): number | string | null {
    // When to show placeholder text?
    if (option === null && !this.options().includes(option)) {
      if (this.langPrefix()) return this.translateService.instant(this.placeholder());
      return this.placeholder();
    }
    // Show actual option value (either translated or as is).
    if (this.langPrefix()) return this.translateService.instant(this.langPrefix() + '.' + option);
    return option;
  }

  // INTERACTIONS

  /** Track new pointer interaction: cancel any pending focus-open so click can toggle. */
  handleMousedown() {
    this.resetInteractionState();
  }

  /** Handle focus: handles direct clicks, label clicks, and Tab. */
  handleFocus() {
    if (this.disabled()) return;
    if (!this.isOpen()) {
      this.openList();
      this.focusOpened.set(true);
    }
  }

  /** Handle click: both from normal mouse click and label click. */
  handleClick() {
    if (this.disabled()) return;

    if (this.focusOpened()) {
      // Focus already opened the list (label or Tab). Suppress any synthetic click.
      this.resetInteractionState();
      return;
    }

    // Toggle for direct clicks and programmatic clicks. Handles both real browser
    // clicks (preceded by mousedown) and test/programmatic clicks (no mousedown).
    this.isOpen.update((currVal) => !currVal);
    if (this.isOpen()) this.openList();
    else this.highlightedIndex.set(-1);
  }

  /**
   * Handle keyboard events for accessibility.
   * Arrow keys navigate options, Enter/Space select, Escape closes.
   * @param e Keyboard event.
   */
  handleKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!this.isOpen()) {
          this.openList(true);
        } else {
          // Wraparound to top.
          this.highlightedIndex.update((currVal) => (currVal + 1) % this.options().length);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!this.isOpen()) {
          this.openList(false);
        } else {
          // Wraparound to bottom.
          this.highlightedIndex.update((currVal) => (currVal - 1 + this.options().length) % this.options().length);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (this.isOpen() && this.highlightedIndex() >= 0) {
          this.selectOption(this.options()[this.highlightedIndex()] ?? null);
        } else if (!this.isOpen()) {
          this.openList();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        this.hidePanel();
        break;
      }
    }
  }

  // UTILITIES

  /** Reset interaction state (must be called when any interaction completes). */
  resetInteractionState() {
    this.focusOpened.set(false);
  }

  /** Hide panel with list of options. */
  hidePanel() {
    this.isOpen.set(false);
    this.highlightedIndex.set(-1);
    this.resetInteractionState();
    this.touch.emit();
  }
}
