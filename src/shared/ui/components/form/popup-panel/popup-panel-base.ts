import { Directive, effect, inject, Injector, model, input, output, signal, viewChild, ElementRef, DOCUMENT, type WritableSignal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';
import type { PanelInsets, PanelPlacement } from '@/shared/ui/components/form/popup-panel/popup-panel-placement';
import { forRender } from '@/shared/utils/render/after-render';

import { PanelPositioning } from './popup-panel-positioning';

/**
 * Shared shell of every anchored-popup form control: a `FormValueControl` whose panel opens
 * below an anchor, designed to be subclassed by two families:
 * - popup INPUT controls (`PopupInputBase` -> clock, calendar pickers), where a readonly text
 *   input anchors the panel and keyboard focus moves INTO the panel on open, and
 * - popup LIST controls (`ComboBox`), which follow the ARIA combobox pattern and keep focus on
 *   their root (`aria-activedescendant`), so no focus ever enters the panel.
 *
 * Owns everything that is identical between the families:
 * - the form contract (`FormValueControl`) inputs/outputs - `value`, `ident`, `label`,
 *   `container`, `required`, `disabled`, `invalid`, `touch`;
 * - the `pickerRef` / `panelRef` template refs (names fixed by this class);
 * - panel placement state (`PanelPositioning` - baseline reset before measuring) and the open
 *   path that measures it once per open under a session guard;
 * - the close family `showPanel` / `hidePanel` (subclass state resets through `resetOnClose`);
 * - focusout containment against the wrapper `container` input and the `touch` contract;
 * - the disabled-closes-panel effect and dev-only dangling-label diagnostics.
 *
 * Subclasses supply domain behavior through the HOOKS at the bottom of this class; the
 * input-specific pieces (text-input focus gating, input keyboard handling, the
 * `hidePanelAnd*` close family) live in `PopupInputBase` instead.
 *
 * Behavior contracts preserved by this shell (relied on by the component and e2e tests):
 * - Every open runs `prepareOpen` synchronously BEFORE the panel first renders, so the seeded
 *   state exists when focus/placement work runs after the render.
 * - A superseded open (closed, or closed and reopened, while its render was pending) is
 *   dropped by the session/visibility guard, so placement is never measured for a hidden
 *   panel and stale work never races a newer open.
 * - Focusout reports `touch` only when focus really left the component: internal moves (the
 *   control's own root, or anything inside the `container` wrapper) stay quiet, and a
 *   programmatic close caused by disabling is not a user blur.
 * - The panel baseline is re-applied BEFORE the panel renders on every open, and placement is
 *   measured once per open under that baseline (see `positionPanel`).
 *
 * @template TValue Type of the value the control edits (the model additionally allows null).
 */
// @Directive() (no selector): Angular only inherits inputs, outputs, queries and host bindings
// from a decorated base class - an undecorated base class carrying input()/model()/viewChild()
// would silently drop them on the concrete component (NG0303/NG0951 at runtime).
@Directive()
export abstract class PopupPanelBase<TValue> implements FormValueControl<TValue | null> {
  /** Injectable injector, used to schedule render waits on the open path (see `togglePanel`). */
  protected readonly injector = inject(Injector);
  /** Injectable document, used by the diagnostics effect and the focus-containment checks. */
  protected readonly document = inject(DOCUMENT);

  // INPUTS / OUTPUTS

  /** Value held by component. */
  public value = model<TValue | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Label reference: id of an external element (usually `<label>`) used for `aria-labelledby`. */
  public label = input<string>('');
  /** Root element of the host wrapper - the component boundary for focus containment: it holds this control, any sibling control and the wrapper's hidden label-activation target, so focus moving to anything inside it reads as an internal move instead of a blur. */
  public container = input<Element | null>(null);
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component (focus left it), regardless of panel visibility. */
  public touch = output<void>();

  // REFERENCES

  /** Root focusable element (the anchor the panel is positioned against). Template ref name `pickerRef` is fixed by this class. */
  protected readonly pickerRef = viewChild.required<ElementRef<HTMLDivElement>>('pickerRef');
  /** Reference to the popup panel. Template ref name `panelRef` is fixed by this class. */
  protected readonly panelRef = viewChild.required<ElementRef<HTMLDivElement>>('panelRef');

  // SIGNALS

  /** Indicates visibility of the popup panel. Subclasses may expose a domain-named alias (e.g. `isClockVisible`, `isOpen`). */
  public readonly panelVisible = signal(false);

  /** Placement state of the popup panel: inline insets plus the reset-baseline-before-measure contract. */
  private readonly positioning: PanelPositioning;
  /**
   * Inline style of the popup panel (see `PanelPositioning` and the placement const the
   * subclass passes to the constructor). Bind to the panel's inline style; all four insets are
   * managed together, so it must never be partially overridden elsewhere.
   */
  public readonly containerStyle: WritableSignal<PanelInsets>;
  /** Number of the most recent open - drops stale placement/render work from a superseded open. */
  private positionSession = 0;

  /**
   * @param placement Baseline insets plus optional per-axis flip insets for this panel; the
   * subclass's single source of truth (e.g. `popupPanelPlacement`, `stretchPanelPlacement`).
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
      warnDanglingLabel(this.document, this.label(), this.diagnosticsIdent(), this.componentName);
    });
  }

  // GENERAL

  /**
   * Toggle the panel: close it when open, otherwise run the full open path - baseline reset,
   * visible flag, subclass seeding (`prepareOpen`), first render, placement measurement
   * (`positionPanel` + `afterPlacement`) and keyboard focus into the panel
   * (`focusPanelTarget`, when the subclass moves focus at all).
   * Never awaited by its callers: template event bindings do not await handlers, so the async
   * work is deliberately fire-and-forget (callers mark it with `void`).
   * The open can be cancelled while it awaits a render (Escape, a second click toggling it
   * closed, focusout/outside press, disabling, a sibling picker closing this one): each await
   * is followed by a session/visibility guard, so an abandoned open never measures placement
   * for nor focuses a hidden panel.
   */
  protected async togglePanel(): Promise<void> {
    if (this.panelVisible()) {
      this.hidePanel();
      return;
    }

    // Reset placement to the baseline (below the input, left-aligned) BEFORE the panel renders.
    // The measurement below then always runs under this known alignment - measuring the panel
    // as left over from the previous open would judge alignment by the OLD placement.
    this.positioning.resetBaseline();
    const session = ++this.positionSession;
    this.panelVisible.set(true);

    // Seed view/keyboard focus state on EVERY open (subclass-specific).
    this.prepareOpen();

    await forRender(this.injector);

    // The open may have been superseded while the render was pending (the panel was closed,
    // or closed and reopened): measuring a hidden panel would read a 0x0 rect and a stale
    // open's post-render work must never run against a newer open's state - drop it instead
    // (the current open re-seeds everything from scratch anyway).
    if (session !== this.positionSession || !this.panelVisible()) return;

    // Adjust picker position if needed to prevent window overflow (measured under baseline).
    this.positionPanel();

    // Subclass post-measurement pass (e.g. reset the list's scroll and reveal its highlight).
    this.afterPlacement();

    // Move keyboard focus into the panel so the user can navigate immediately - unless the
    // subclass keeps focus on its root (ARIA combobox pattern, `focusPanelTarget` returns null).
    // preventScroll: the placement resolved above only reaches the DOM on the next render, so
    // focus() runs while the panel still sits at its baseline position - without preventScroll
    // it would scroll that pre-placement (possibly below-the-fold) position into view and move
    // the page under the user's mouse (their next click can then miss the target). Focus must
    // never move the page at all: whatever the placement resolves to, the panel either ends up
    // inside the viewport (nothing to reveal) or deliberately stays below the fold (the user
    // scrolls down to it).
    this.focusPanelTarget()?.focus({ preventScroll: true });
  }

  /**
   * Resolve the panel placement so it does not overflow the viewport.
   * Runs once per open, right after the panel rendered under the baseline - the measurement
   * contract, viewport and margin details are documented on `resolvePanelPlacement`.
   */
  private positionPanel(): void {
    this.positioning.resolve(this.pickerRef().nativeElement, this.panelRef().nativeElement);
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

  // EVENTS: FOCUS CONTAINMENT

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
    this.onFocusLeft();
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
   * viewed period, seed the keyboard cursor and the active pane/column, or seed the list
   * highlight). Focus/placement work runs after the render, so the active option must exist
   * right away.
   */
  protected abstract prepareOpen(): void;

  /**
   * Element that receives keyboard focus when the panel opens (the grid, listbox, ...), after
   * placement has been resolved. Focused with `preventScroll: true` (see `togglePanel`).
   * @returns The focusable panel element, or null when the control keeps keyboard focus on
   * itself (ARIA combobox pattern - options are navigated via `aria-activedescendant`).
   */
  protected abstract focusPanelTarget(): HTMLElement | null;

  /**
   * Reset subclass session/cursor state when the panel hides (see `hidePanel`). Keeps a closed
   * panel from leaving aria-activedescendant pointing at hidden content, and makes the next
   * open re-seed from the (possibly changed) selection.
   */
  protected abstract resetOnClose(): void;

  /**
   * Focus the control on behalf of the signal-forms `Field` directive (the optional
   * `FormUiControl.focus` contract - e.g. "focus first invalid field"). Implementations must
   * let the control's own focus handler auto-open the panel, like Tab does, and must be a
   * no-op when disabled.
   * @param options Native focus options (e.g. `preventScroll`).
   */
  public abstract focus(options?: FocusOptions): void;

  /**
   * Subclass pass after the panel placement has been measured, still inside the same open
   * (before focus moves into the panel). Default is a no-op; e.g. the combo-box resets its
   * list scroll and reveals the seeded highlight here.
   */
  protected afterPlacement(): void {
    // Intentionally empty: most panels need nothing beyond the measured placement.
  }

  /**
   * Runs when focusout determined that focus REALLY left the component (past the containment
   * checks), just before the panel closes. Default is a no-op; e.g. the combo-box drops its
   * now-obsolete label-activation decision here. Must not touch focus or panel visibility -
   * `handleFocusOut` owns both.
   */
  protected onFocusLeft(): void {
    // Intentionally empty: most controls carry no leaving-focus bookkeeping.
  }

  /**
   * Ident reported by the dev-only dangling-label diagnostics: the raw `ident` input by
   * default; override when the component generates a stable id of its own, so the warning
   * points at the id the consumer's `<label for>` actually references.
   * @returns Ident shown in the diagnostic message.
   */
  protected diagnosticsIdent(): string {
    return this.ident();
  }
}
