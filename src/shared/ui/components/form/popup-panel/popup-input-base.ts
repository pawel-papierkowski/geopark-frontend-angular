import { Directive, effect, inject, Injector, model, input, output, signal, computed, viewChild, ElementRef, DOCUMENT, type WritableSignal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { NavUtils } from '@/core/utils/nav-utils';
import type { PanelInsets, PanelPlacement } from '@/core/utils/window-utils';
import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';
import { forRender } from '@/shared/utils/render/after-render';

import { PanelPositioning } from './popup-panel-positioning';

/**
 * Shared shell of a popup input control: a readonly text input that opens an anchored panel
 * (dialog-style popup) below it, designed to be subclassed by feature pickers (clock, calendar
 * and future popup controls).
 *
 * Owns everything that is identical between such controls:
 * - the form contract (`FormValueControl`) inputs/outputs - `value`, `ident`, `label`,
 *   `qualifyLabel`, `container`, `canNull`, `required`, `disabled`, `invalid`, `touch`;
 * - the `pickerRef` / `inputRef` / `panelRef` template refs (names fixed by this class);
 * - panel placement state (`PanelPositioning` - baseline reset before measuring);
 * - the auto-open gating that distinguishes a click-caused focus from a Tab-caused one
 *   (`focusFromClick` / `suppressFocusOpen`);
 * - input keyboard handling (open keys, Escape, Delete/Backspace clear);
 * - the close family `hidePanelAndRefocus` / `hidePanelAndFocusNext` / `hidePanelAndFocusPrev`;
 * - focusout containment against the wrapper `container` input and the `touch` contract;
 * - dev-only dangling-label diagnostics and the disabled-closes-panel effect.
 *
 * Subclasses supply domain behavior through the HOOKS at the bottom of this class and keep
 * their own panel content, panel keyboard handling and session state.
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
 * - The panel baseline is re-applied BEFORE the panel renders on every open, and placement is
 *   measured once per open under that baseline (see `WindowUtils.resolvePanelPlacement`).
 *
 * @template TValue Type of the value the control edits (the model additionally allows null).
 */
// @Directive() (no selector): Angular only inherits inputs, outputs, queries and host bindings
// from a decorated base class - an undecorated base class carrying input()/model()/viewChild()
// would silently drop them on the concrete component (NG0303/NG0951 at runtime).
@Directive()
export abstract class PopupInputBase<TValue> implements FormValueControl<TValue | null> {
  protected readonly injector = inject(Injector);
  /** Injectable document, used for the global focus check in `handleMousedown`. */
  private readonly document = inject(DOCUMENT);

  // INPUTS / OUTPUTS

  /** Value held by component. */
  public value = model<TValue | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Label reference: id of an external element (usually `<label>`) used for `aria-labelledby`. */
  public label = input<string>('');
  /** If true, append this sub-field's hidden qualifier id to the accessible name (see `nameRefs`), so two inputs named after the same visible `<label>` stay distinguishable. */
  public qualifyLabel = input<boolean>(false);
  /** Root element of the host wrapper - the component boundary for focus containment: it holds this control, any sibling control and the wrapper's hidden label-activation target, so focus moving to anything inside it reads as an internal move instead of a blur. */
  public container = input<Element | null>(null);
  /** If true, allow deselecting the value. */
  public canNull = input<boolean>(false);
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component (focus left it), regardless of panel visibility. */
  public touch = output<void>();

  // REFERENCES

  /** Root focusable element. Template ref name `pickerRef` is fixed by this class. */
  protected readonly pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to the text input. Template ref name `inputRef` is fixed by this class. */
  public readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');
  /** Reference to the popup panel. Template ref name `panelRef` is fixed by this class. */
  protected readonly panelRef = viewChild.required<ElementRef<HTMLDivElement>>('panelRef');

  // SIGNALS

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

  /** Indicates visibility of the popup panel. Subclasses may expose a domain-named alias (e.g. `isClockVisible`). */
  public readonly panelVisible = signal(false);

  /** Placement state of the popup panel: inline insets plus the reset-baseline-before-measure contract. */
  private readonly positioning: PanelPositioning;
  /**
   * Inline style of the popup panel (see `PanelPositioning` and the placement const the
   * subclass passes to the constructor). Bind to the panel's inline style; all four insets are
   * managed together, so it must never be partially overridden elsewhere.
   */
  public readonly containerStyle: WritableSignal<PanelInsets>;

  // COMPUTED

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
    this.positioning = new PanelPositioning(placement);
    this.containerStyle = this.positioning.containerStyle;

    // Watch `disabled` field: close the panel when the component becomes disabled.
    effect(() => {
      if (this.disabled() && this.panelVisible()) this.hidePanel();
    });

    // Dev-only: catch a `label` id that matches no element. A dangling aria-labelledby leaves
    // this input without an accessible name (its aria-label fallback is suppressed whenever
    // label is set), which no assertion would catch. Re-runs whenever label or ident changes.
    effect(() => {
      warnDanglingLabel(this.document, this.label(), this.ident(), this.componentName);
    });
  }

  // GENERAL

  /**
   * Toggle the panel: close it when open, otherwise run the full open path - baseline reset,
   * visible flag, subclass seeding (`prepareOpen`), first render, placement measurement and
   * keyboard focus into the panel.
   * Never awaited by its callers: template event bindings do not await handlers, so the async
   * work is deliberately fire-and-forget (callers mark it with `void`).
   * The open can be cancelled while it awaits a render (Escape, a second click toggling it
   * closed, focusout/outside press, disabling, a sibling picker closing this one): each await
   * is followed by a visibility guard, so an abandoned open never measures placement for nor
   * focuses a hidden panel.
   */
  private async togglePanel(): Promise<void> {
    if (this.panelVisible()) {
      this.hidePanel();
      return;
    }

    // Reset placement to the baseline (below the input, left-aligned) BEFORE the panel renders.
    // The measurement below then always runs under this known alignment - measuring the panel
    // as left over from the previous open would judge alignment by the OLD placement.
    this.positioning.resetBaseline();
    this.panelVisible.set(true);

    // Seed view/keyboard focus state on EVERY open (subclass-specific).
    this.prepareOpen();

    await forRender(this.injector);

    // The panel may have been closed while the render was pending: measuring a hidden panel
    // would read a 0x0 rect and focusing its target would aim at hidden content - drop the
    // open instead (the next open re-seeds everything from scratch anyway).
    if (!this.panelVisible()) return;

    // Adjust picker position if needed to prevent window overflow (measured under baseline).
    this.positionPanel();

    // Move keyboard focus into the panel so the user can navigate immediately.
    // preventScroll: the placement resolved above only reaches the DOM on the next render, so
    // focus() runs while the panel still sits at its baseline position - without preventScroll
    // it would scroll that pre-placement (possibly below-the-fold) position into view and move
    // the page under the user's mouse (their next click can then miss the target). Focus must
    // never move the page at all: whatever the placement resolves to, the panel either ends up
    // inside the viewport (nothing to reveal) or deliberately stays below the fold (the user
    // scrolls down to it).
    this.focusPanelTarget().focus({ preventScroll: true });
  }

  /**
   * Resolve the panel placement so it does not overflow the viewport.
   * Runs once per open, right after the panel rendered under the baseline - the measurement
   * contract, viewport and margin details are documented on `WindowUtils.resolvePanelPlacement`.
   */
  private positionPanel(): void {
    this.positioning.resolve(this.pickerRef().nativeElement, this.panelRef().nativeElement);
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
   * Show the panel when it is closed (no-op when already visible or disabled).
   */
  public async showPanel() {
    if (this.disabled()) return;
    if (this.panelVisible()) return;
    await this.togglePanel();
  }

  /**
   * Hide the panel. Subclass session/cursor state is reset through `resetOnClose`.
   */
  public hidePanel() {
    if (!this.panelVisible()) return; // already hidden

    this.panelVisible.set(false);
    this.resetOnClose();
  }

  /**
   * Focusing the input auto-opens the panel (see `handleInputFocus`), so focus then continues
   * into the panel like it does on Tab.
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

  /**
   * Handle focus leaving the control (e.g. Tab out of the panel). It closes the panel and,
   * unless focus only moved inside the component, reports the control as touched.
   * Note the panel visibility is intentionally not checked: internal helpers hide the panel before
   * or after focus moves, so a closed panel must still report touch when focus really left.
   * @param e Focus event.
   */
  public handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget;
    // Own root covers the standalone case (no wrapper input configured, e.g. isolated tests).
    if (next instanceof Node && this.pickerRef().nativeElement.contains(next)) return;
    // The host wrapper's root (forwarded through the `container` input) is the real component
    // boundary the `touch` contract talks about: it contains this control, the sibling control
    // and the wrapper's hidden label target. Focus reaching any of them (Tab between sibling
    // inputs, Shift+Tab back out of the panel, label activation relaying through the hidden
    // button) is an internal move, not a blur. Elements outside it - including other components'
    // hidden-label buttons - still count as leaving.
    const container = this.container();
    if (next instanceof Node && container !== null && container.contains(next)) return;
    this.hidePanel();
    if (this.disabled()) return; // Programmatic close (disabled while focused), not a user blur.
    this.touch.emit();
  }

  // SUBCLASS HOOKS

  /**
   * Name of the concrete component, used for dev-only diagnostics (see `warnDanglingLabel`).
   */
  protected abstract readonly componentName: string;

  /**
   * Seed view/keyboard focus state on EVERY open, BEFORE the panel first renders (e.g. set the
   * viewed period, seed the keyboard cursor and the active pane/column). Focus always moves
   * into the panel after placement (see `focusPanelTarget`), so the active option must exist
   * right away.
   */
  protected abstract prepareOpen(): void;

  /**
   * Element that receives keyboard focus when the panel opens (the grid, listbox, ...), after
   * placement has been resolved. Focused with `preventScroll: true` (see `togglePanel`).
   * @returns The focusable panel element.
   */
  protected abstract focusPanelTarget(): HTMLElement;

  /**
   * Reset subclass session/cursor state when the panel hides (see `hidePanel`). Keeps a closed
   * panel from leaving aria-activedescendant pointing at hidden content, and makes the next
   * open re-seed from the (possibly changed) selection.
   */
  protected abstract resetOnClose(): void;

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
