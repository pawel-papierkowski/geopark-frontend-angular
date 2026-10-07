import { signal, type DestroyRef } from '@angular/core';

/**
 * What a label activation's forwarded click decided.
 * - `none` - no forwarded click recorded yet (or the previous one was reset).
 * - `open` - the click opened the panel.
 * - `TExtra` - component-specific close decisions (e.g. combo-box `closed`, date-time-picker
 *   `closed:date`/`closed:time`, which record WHICH sub-picker the click closed).
 * @template TExtra Component-specific decision members beyond the shared `none`/`open` pair.
 */
export type LabelClickDecision<TExtra extends string = never> = 'none' | 'open' | TExtra;

/** Wiring options for `LabelActivation.installDocumentGuard`. */
export interface LabelGuardOptions {
  /** Document the guard listens on; injected (`DOCUMENT`), never the global. */
  readonly document: Document;
  /** Registers listener cleanup when the owning component is destroyed. */
  readonly destroyRef: DestroyRef;
  /** Resolved ident of the owning component; an empty string disables own-label detection. */
  readonly ident: () => string;
  /** Element owning the label activation - presses landing outside it reach `onOutsidePress`. */
  readonly boundary: () => Element;
  /** Runs when a press landed outside the boundary; closes whatever the component shows. */
  readonly onOutsidePress: (target: Node) => void;
}

/**
 * Shared label-activation state and document guard for popup controls driven by an associated
 * `<label>` (combo-box, date-time-picker and future popup inputs).
 *
 * Label activation is ambiguous because engines disagree on its order:
 * - Chromium/Firefox focus the hidden target FIRST and forward the click SECOND (focus-first).
 * - WebKit forwards the click FIRST and focuses the hidden target SECOND (click-first).
 * So the paired focus and click handlers coordinate through two markers:
 * - `focusOpened` - the activation's focus redirect just opened the panel; the click that
 *   follows must be swallowed instead of toggling the panel closed again.
 * - `clickDecision` - what this activation's forwarded click already did; the focus handler
 *   that runs AFTER the click (WebKit) must only restore focus, never re-run the toggle.
 * Both markers are reset at the start of every pointer interaction (see `installDocumentGuard`),
 * so a fresh activation is never judged by its predecessor's markers.
 */
export class LabelActivation<TExtra extends string = never> {
  /** Whether the current label activation's focus redirect just opened the panel; the click
   * forwarded right after must then be swallowed instead of toggling it closed again. */
  public readonly focusOpened = signal(false);

  /** What this label activation's forwarded click decided; `none` until a forwarded click runs
   * and reset at the start of every pointer interaction, like `focusOpened`. Set it via `setDecision()`.
   * Read it via `consumeDecision()`. */
  private readonly clickDecision = signal<LabelClickDecision<TExtra>>('none');

  /** Clear both markers: the state of a brand-new pointer interaction, never judged by the
   * previous activation's markers (a focus-only activation that never received its click
   * would otherwise swallow the next activation's toggle). */
  public reset(): void {
    this.focusOpened.set(false);
    this.clickDecision.set('none');
  }

  /**
   * Set new value of click decision.
   * @param decision Decision to set.
   */
  public setDecision(decision: LabelClickDecision<TExtra>) {
    this.clickDecision.set(decision);
  }

  /** Read the forwarded-click decision and clear it, so the decision is consumed exactly once
   * (focus handlers that may re-run, e.g. on refocus, must not act on a stale decision twice).
   * @returns The decision recorded so far (`none` when nothing was recorded).
   */
  public consumeDecision(): LabelClickDecision<TExtra> {
    const decision = this.clickDecision();
    this.clickDecision.set('none');
    return decision;
  }

  /**
   * Install the capture-phase document mousedown guard shared by label-driven controls.
   * On every press it:
   * 1. Resets both markers (`reset`) - a fresh interaction never inherits its predecessor's state.
   * 2. Cancels the default focus steal when the press lands on the OWN label: a `<label>` is
   *    not focusable, so its mousedown would move focus from the control to `<body>`; that
   *    transient blur closes the panel and reports a spurious touch, right before label
   *    activation refocuses the control. Canceling the default keeps focus in place - label
   *    activation runs on the subsequent click, so redirecting focus still works.
   * 3. Reports presses landing outside the boundary through `onOutsidePress` - the close itself
   *    is component-specific (list vs panels), because focusout alone does not cover pointer
   *    presses: WebKit does not reliably move focus on an outside press (buttons and other
   *    non-text controls are not click-focused on macOS, and pressing non-focusable content
   *    does not necessarily blur the focused element), so a focusout-only close would leave
   *    the panel open there. The press handler closes unconditionally of focus - the focusout
   *    path stays for Tab and other programmatic focus moves.
   *
   * Capture phase, so no other handler can swallow it first; mousedown (not pointerdown),
   * because canceling pointerdown would also suppress the click and break label activation.
   * Call once from the owning component's constructor; the boundary getter is only evaluated
   * when a press actually happens (after the view exists).
   * @param options Guard wiring - document, cleanup hook, ident, boundary and the close callback.
   */
  public installDocumentGuard(options: LabelGuardOptions): void {
    /**
     * Reset the interaction state, short-circuit presses on the own label and forward
     * outside presses to the component's close logic.
     * @param e Mousedown event (capture phase, any target in the document).
     */
    const handleDocumentMousedown = (e: Event): void => {
      this.reset();
      const target = e.target;
      const ident = options.ident();
      const isOwnLabel = ident !== '' && target instanceof HTMLLabelElement && target.htmlFor === ident;

      // Prevent reopening the panel when you click outside the panel, but on the label.
      if (isOwnLabel) {
        e.preventDefault();
        return;
      }

      if (target instanceof Node && !options.boundary().contains(target)) {
        options.onOutsidePress(target);
      }
    };
    options.document.addEventListener('mousedown', handleDocumentMousedown, true);
    options.destroyRef.onDestroy(() => options.document.removeEventListener('mousedown', handleDocumentMousedown, true));
  }
}
