import { Component, inject, model, input, output, linkedSignal, computed, effect, viewChildren, ElementRef, DOCUMENT } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { TranslateService } from '@ngx-translate/core';

import { NavUtils } from '@/core/utils/NavUtils';
import { IdService } from '@/shared/utils/id/id-service';
import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';

/**
 * Custom form component that allows selecting between multiple choices. Equivalent of `<input type="radio">`.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Accept number (so also enums), string or null (not set) value.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows/Home/End (automatically selects an option). Enter/Space moves to next component.
 * - Supports <label>: activation moves focus onto the checked option and, when nothing is checked, selects the first option.
 * - Supports WAI-ARIA (roving tabindex keeps exactly one tab stop, even when nothing is selected).
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and `id` attribute in focusable element (so `<label>` etc. work properly). Used instead of `id` for technical reasons. Optional. If omitted, unique `radio-box-N` is generated; provide it explicitly for `<label for>` pairing or a stable test id.
 * - label - For `aria-labelledby`. Optional; dev mode warns when the id matches no element.
 * - options - Array of options. String, number (so also enum) and null allowed.
 * - langPrefix - Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation.
 *
 * Outputs:
 * - touch - Informs that focus left the component (user blurred out of it).
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
  /** Document the `label` id is resolved against (not the global, see `warnDanglingLabel`). */
  private readonly document = inject(DOCUMENT);
  /** Option elements in template order; replaces selector queries so any `ident` value is safe. */
  private readonly optionEls = viewChildren<ElementRef<HTMLElement>>('optRef');

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

  constructor() {
    // Dev-only: catch a `label` id that matches no element. A dangling aria-labelledby would
    // leave this radiogroup with no accessible name (it has no aria-label fallback), which no app
    // test catches; re-runs whenever label or ident changes (see `warnDanglingLabel`).
    effect(() => {
      warnDanglingLabel(this.document, this.label(), this.resolvedIdent(), 'radio-box');
    });
  }

  // COMPUTED

  /**
   * Index of the group's single tab stop (roving tabindex): the checked option, or the first
   * option when nothing is checked (APG: the first radio keeps focus). -1 when the group is
   * disabled or has no options, so a disabled group exposes no tab stop at all.
   */
  public tabStopIndex = computed(() => {
    if (this.disabled()) return -1;
    const opts = this.options();
    if (opts.length === 0) return -1;
    const checked = opts.findIndex((o) => o === this.value());
    return checked >= 0 ? checked : 0;
  });

  // FUNCTIONS

  /**
   * Id of the option element at given index.
   * @param index Index of the option.
   * @returns Id in form `<ident>_opt_<index>`.
   */
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
   * User selected an option (click, or arrow/Home/End navigation in the keyboard handler).
   * @param option Option to select.
   * @param index Index of the option for focus management.
   */
  public selectOption(option: number | string | null, index: number) {
    if (this.disabled()) return;
    this.value.update(() => option);
    this.focusOption(index);
  }

  /**
   * Prevent a click inside a disabled group from focusing an option: native disabled controls
   * never take focus, so keyboard defaults (Space/arrow page scrolling) stay unreachable.
   * @param e Mouse event of the press.
   */
  public blockIfDisabled(e: MouseEvent): void {
    if (this.disabled()) e.preventDefault();
  }

  /**
   * Label activation of the hidden label target: move focus onto the checked option; when
   * nothing is checked, check the first option as well so the group gains its tab stop.
   * Never runs when disabled (a disabled hidden button is not activated by the engine anyway;
   * the guard covers synthetic dispatches). Idempotent, so both the focus and the click of a
   * label activation may call it - engines disagree on their order (see `LabelActivation`:
   * focus-first in Chromium/Firefox, click-first in WebKit).
   */
  public handleLabelActivation(): void {
    if (this.disabled()) return;
    const opts = this.options();
    if (opts.length === 0) return;
    const checked = opts.findIndex((o) => o === this.value());
    if (checked < 0) this.value.update(() => opts[0] ?? null);
    this.focusOption(checked >= 0 ? checked : 0);
  }

  /**
   * Focus the option at given index (no-op when out of range - e.g. no options rendered).
   * @param index Index of the option to focus.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the option.
   */
  private focusOption(index: number, options?: FocusOptions): void {
    this.optionEls()[index]?.nativeElement.focus(options);
  }

  /**
   * Focus the group on behalf of the signal-forms `Field` directive (the optional
   * `FormUiControl.focus` contract - e.g. "focus first invalid field"). Focuses the tab-stop
   * option (checked one, or the first option when nothing is selected). Without this method the
   * directive would fall back to focusing the non-focusable `<radio-box>` host and silently do
   * nothing. No-op when disabled.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the option.
   */
  public focus(options?: FocusOptions): void {
    if (this.disabled()) return;
    const index = this.tabStopIndex();
    if (index < 0) return;
    this.focusOption(index, options);
  }

  /**
   * Handle the bubbling focusout of any element inside the component (the container itself is
   * never focused, so a plain `(blur)` binding there would never fire in real usage). Focus
   * moves within the component (arrow navigation, label activation) carry a relatedTarget inside
   * the host and are not a user leaving the control, so they must not mark the field as touched.
   * @param e Focus event carrying the element focus moved to.
   */
  public handleFocusout(e: FocusEvent): void {
    const next = e.relatedTarget;
    if (next instanceof Node && this.hostEl.nativeElement.contains(next)) return;
    if (this.disabled()) return; // Component became disabled while focused - not a user blur.
    this.touch.emit();
  }

  /**
   * Handle keyboard events for accessibility.
   * Arrow keys select next/previous options, Home/End jump to first/last option, Space/Enter
   * moves to next focusable component (so the user can leave this component). Defaults of the
   * handled keys (page scrolling) are swallowed even when disabled, so a stray focus inside a
   * disabled group cannot scroll the page.
   * @param e Keyboard event.
   */
  public handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'Home':
      case 'End':
      case 'Enter':
      case ' ':
        e.preventDefault();
        break;
      default:
        return;
    }
    if (this.disabled()) return;

    const options = this.options();
    if (options.length === 0) return;
    const currentIndex = options.findIndex((o) => o === this.value());
    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = currentIndex + 1;
        if (nextIndex >= options.length) nextIndex = 0; // Wraparound.
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) nextIndex = options.length - 1; // Wraparound.
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      case 'Enter':
      case ' ':
        this.focusNext();
        return;
      default:
        break;
    }

    if (nextIndex !== currentIndex) {
      this.selectOption(options[nextIndex] ?? null, nextIndex);
    }
  }

  /**
   * Move focus to the next focusable element on the page, starting from the group's tab-stop
   * option (the element holding DOM focus). Touch is not emitted here: actually leaving the
   * component fires focusout, which reports touch - and correctly stays silent when there is no
   * next focusable element and focus does not move.
   */
  private focusNext(): void {
    NavUtils.FocusNext(this.optionEls()[this.tabStopIndex()]?.nativeElement ?? null);
  }
}
