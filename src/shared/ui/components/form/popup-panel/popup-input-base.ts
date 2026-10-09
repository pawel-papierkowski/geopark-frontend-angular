import { Directive, input, computed, viewChild, ElementRef } from '@angular/core';

import { NavUtils } from '@/shared/utils/a11y/nav-utils';
import type { PanelPlacement } from '@/shared/ui/components/form/popup-panel/popup-panel-placement';

import { PopupPanelBase } from './popup-panel-base';

/**
 * Shared shell of a popup INPUT control: a readonly text input that opens an anchored panel
 * (dialog-style popup) below it, designed to be subclassed by feature pickers (clock,
 * calendar). Extends `PopupPanelBase` - which owns the form contract, the placement/measure
 * path, focusout containment and the disabled-close/diagnostics effects - with everything that
 * is specific to anchoring the panel on a TEXT INPUT that also holds DOM focus:
 * - the `inputRef` template ref (name fixed by this class);
 * - the auto-open gating that distinguishes a click-caused focus from a Tab-caused one
 *   (`focusFromClick` / `suppressFocusOpen`);
 * - input keyboard handling (open keys, Escape, Delete/Backspace clear);
 * - the close family `hidePanelAndRefocus` / `hidePanelAndFocusNext` / `hidePanelAndFocusPrev`;
 * - `canNull` / `qualifyLabel` contract inputs plus the `normalizedValue` / `nameRefs` computeds.
 *
 * Subclasses supply panel content, panel keyboard handling and session state through the hooks
 * declared on `PopupPanelBase` (`prepareOpen`, `focusPanelTarget`, `resetOnClose`), plus this
 * class's optional `focusAnchorForNext`.
 *
 * Behavior contracts preserved by this shell (relied on by the component and e2e tests):
 * - In the `hidePanelAnd*` family, focus ALWAYS moves BEFORE the panel is hidden, so the
 *   resulting focusout reports an internal move (focus stays inside) or a genuine blur (focus
 *   left) - `touch` fires only when focus really left the component.
 * - The `hidePanelAndFocusNext`/`hidePanelAndFocusPrev` handoffs verify that focus actually
 *   left the panel (`NavUtils.FocusNext`/`FocusPrev` report the outcome); when no reachable
 *   target exists they fall back to `hidePanelAndRefocus`, so hiding the panel can never
 *   strand keyboard focus on a hidden element (which a browser would reset to `<body>`).
 * - `suppressFocusOpen` is set only synchronously around the programmatic `focus()` call,
 *   which dispatches focus synchronously, so the paired focus handler skips auto-open.
 *
 * @template TValue Type of the value the control edits (the model additionally allows null).
 */
// @Directive() (no selector): Angular only inherits inputs, outputs, queries and host bindings
// from a decorated base class - see the note on `PopupPanelBase`.
@Directive()
export abstract class PopupInputBase<TValue> extends PopupPanelBase<TValue> {
  // INPUTS

  /** If true, append this sub-field's hidden qualifier id to the accessible name (see `nameRefs`), so two inputs named after the same visible `<label>` stay distinguishable. */
  public qualifyLabel = input<boolean>(false);
  /** If true, allow deselecting the value. */
  public canNull = input<boolean>(false);

  // REFERENCES

  /** Reference to the text input. Template ref name `inputRef` is fixed by this class. */
  public readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');

  // COMPUTED

  /**
   * Value of the input's `aria-labelledby`: the external label id, plus (when `qualifyLabel`)
   * this sub-field's hidden qualifier id; null when no label is set (the input then falls back
   * to `aria-label`). The qualified name reads "<label> <qualifier>" - the label text stays a
   * prefix, so the visible label remains inside the accessible name (WCAG 2.5.3) for voice control.
   */
  public readonly nameRefs = computed<string | null>(() => {
    const label = this.label();
    if (label === '') return null;
    return this.qualifyLabel() ? `${label} ${this.ident()}_qualifier` : label;
  });

  /**
   * `value` when it carries a real value, otherwise null. Reduces an invalid `Date` (NaN time)
   * to null so the display path can never render "NaN"; non-Date values pass through unchanged.
   */
  protected readonly normalizedValue = computed<TValue | null>(() => {
    const value = this.value();
    if (value instanceof Date && Number.isNaN(value.getTime())) return null;
    return value;
  });

  /**
   * @param placement Baseline insets plus optional per-axis flip insets for this panel; the
   * subclass's single source of truth (e.g. `popupPanelPlacement`).
   */
  // eslint-disable-next-line @angular-eslint/prefer-inject -- `placement` is a plain value the subclass passes down, not an injected service; there is nothing for inject() to resolve.
  constructor(placement: PanelPlacement) {
    super(placement);
  }

  // EVENTS: MOUSE HANDLERS

  /** Tracks if the next focus event is caused by a mouse click (to avoid auto-open on click). Set only when a click-caused focus event is actually coming. */
  private focusFromClick = false;

  /** True while a programmatic refocus (e.g. after closing the panel) must not auto-open the panel. */
  private suppressFocusOpen = false;

  /**
   * Handle mousedown on input: if focus is about to arrive (input not focused yet), mark it as
   * click-caused so auto-open is skipped. An already-focused input produces no focus event,
   * so nothing is marked - that is what keeps the flag from leaking (a stale flag would swallow
   * the auto-open of the next Tab into the input).
   * @param e Mouse event.
   */
  public handleMousedown(e: MouseEvent) {
    this.focusFromClick = this.document.activeElement !== e.currentTarget;
  }

  /** Handle focus arriving on the input (e.g. via Tab). */
  public handleInputFocus() {
    if (!this.focusFromClick && !this.suppressFocusOpen && !this.panelVisible() && !this.disabled()) {
      // Panel opening waits for renders internally; template event bindings never await the
      // handler, so the work is deliberately fire-and-forget (`void` marks it as such).
      void this.togglePanel();
    }
    this.focusFromClick = false;
  }

  /** Handle click on the input. */
  public handleClick() {
    if (this.disabled()) return;
    this.focusFromClick = false; // Any click-caused focus already happened (focus precedes click) - never leave a stale flag behind.
    void this.togglePanel();
  }

  // EVENTS: KEYBOARD HANDLERS

  /**
   * Handle keyboard on the input element.
   * @param e Keyboard event.
   */
  public onInputKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.panelVisible()) void this.togglePanel();
    } else if (e.key === 'Escape' && this.panelVisible()) {
      e.preventDefault();
      this.hidePanel();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Default is prevented unconditionally: on a readonly input Backspace must never reach
      // the browser's legacy history-back handling (Firefox), even when canNull forbids the clear.
      e.preventDefault();
      this.keyPressClear();
    }
  }

  /**
   * Clear the value via Delete/Backspace.
   * Note: we test `value`, not `normalizedValue` so we can clear corrupted `Date`.
   * @returns True when a value was actually cleared.
   */
  protected keyPressClear(): boolean {
    if (this.disabled() || !this.canNull() || this.value() === null) return false;
    this.value.set(null);
    return true;
  }

  // UTILITIES

  /**
   * Focus the input; the focus handler auto-opens the panel (see `handleInputFocus`), so focus
   * then continues into the panel like it does on Tab.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the input.
   * @returns The input that took focus, or null when the input is disabled.
   */
  public focusInput(options?: FocusOptions): HTMLElement | null {
    const inputEl = this.inputRef().nativeElement;
    if (inputEl.disabled) return null;
    inputEl.focus(options);
    return inputEl;
  }

  /**
   * Focus the control on behalf of the signal-forms `Field` directive (the optional
   * `FormUiControl.focus` contract - e.g. "focus first invalid field"). Delegates to
   * `focusInput`, so the behavior mirrors Tab: the input takes focus and its focus handler
   * auto-opens the panel. No-op when disabled (the input refuses focus).
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the input.
   */
  public focus(options?: FocusOptions): void {
    this.focusInput(options);
  }

  /**
   * Hide panel and return focus to the input.
   * Focus moves BEFORE the panel is hidden so the resulting focusout reports an internal move
   * (relatedTarget is the input) instead of a leaving blur - focus must stay inside the component,
   * so no touch is reported. The refocus is programmatic, so auto-open on focus is suppressed too.
   */
  public hidePanelAndRefocus() {
    this.suppressFocusOpen = true;
    // Focus dispatch is synchronous, so the focus handler skips auto-open while the flag is set.
    // preventScroll: after a close (pick, Escape, deselect) the page must stay where the user
    // put it - scrolling back up to the input would yank the viewport away right after a click
    // that landed on a below-the-fold panel. Tradeoff: when the user HAS scrolled the input out
    // of view, focus lands off-screen; page position stays user-controlled (same contract as the
    // open-path focus in `togglePanel`), and the next Tab scrolls normally.
    this.inputRef().nativeElement.focus({ preventScroll: true });
    this.suppressFocusOpen = false;
    this.hidePanel();
  }

  /**
   * Hide panel and move focus to the next focusable element on the page, starting from
   * `focusAnchorForNext`.
   * Focus moves BEFORE the panel is hidden: the focusout (handled by `handleFocusOut`) then
   * decides the outcome - focus leaving the wrapper reports touch, focus landing on a sibling
   * control of the same wrapper stays quiet (leaving the wrapper is what `touch` reports). The
   * explicit hidePanel below closes the panel either way; on a sibling arrival the wrapper's
   * focusin handler would close it too.
   * When the handoff cannot complete (no reachable candidate after the anchor, or the move
   * lands back inside this panel), hiding the panel anyway would strand keyboard focus on the
   * hidden element - a browser then resets it to `<body>`. The fallback routes through
   * `hidePanelAndRefocus` instead: focus moves to the input FIRST (same focus-before-hide
   * contract), stays inside the component and reports no touch.
   */
  protected hidePanelAndFocusNext() {
    const moved = NavUtils.FocusNext(this.focusAnchorForNext());
    if (moved && !this.panelRef().nativeElement.contains(this.document.activeElement)) {
      this.hidePanel();
    } else {
      this.hidePanelAndRefocus();
    }
  }

  /**
   * Hide panel and move focus to the previous focusable element on the page.
   * Focus moves BEFORE the panel is hidden, so the hand-off is decided by `handleFocusOut`:
   * landing outside the wrapper it reports touch, landing on the sibling control of the same
   * wrapper (datetime mode) it stays quiet, because leaving the wrapper is what `touch` reports.
   * The explicit hidePanel below closes the panel either way; on the sibling arrival the
   * wrapper's focusin handler would close it too.
   * When the handoff cannot complete (no reachable candidate before the input, or the move
   * lands back inside this panel), the same `hidePanelAndRefocus` fallback as in
   * `hidePanelAndFocusNext` applies: focus must never be stranded on a hidden panel element.
   */
  protected hidePanelAndFocusPrev() {
    const moved = NavUtils.FocusPrev(this.inputRef().nativeElement);
    if (moved && !this.panelRef().nativeElement.contains(this.document.activeElement)) {
      this.hidePanel();
    } else {
      this.hidePanelAndRefocus();
    }
  }

  // SUBCLASS HOOKS

  /**
   * Anchor of the forward Tab hand-off while the panel is open (see `hidePanelAndFocusNext`).
   * Defaults to the input; override when another element sits between the input and the next
   * tab stop while the panel is open.
   * @returns Element the next-focus step starts from.
   */
  protected focusAnchorForNext(): HTMLElement {
    return this.inputRef().nativeElement;
  }
}
