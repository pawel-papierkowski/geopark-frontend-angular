import { signal, type WritableSignal } from '@angular/core';

import { WindowUtils, type PanelInsets, type PanelPlacement } from '@/core/utils/WindowUtils';

/**
 * Placement state of ONE anchored popup panel: owns the inline insets signal plus the
 * reset-baseline-before-measure contract shared by every open path.
 *
 * All four insets are managed TOGETHER: the CSS default (`top: 100%`, `left: 0`) can be
 * overridden inline, so a stale inline `top: auto` from a previous upward flip would otherwise
 * persist, and having both `top` and `bottom` non-auto would over-constrain the absolutely
 * positioned panel. `resetBaseline` restores the known-good baseline on every open, before the
 * panel renders, so the later `resolve` measurement always judges overflow under the baseline
 * placement - never under leftovers of the previous open (see
 * `WindowUtils.resolvePanelPlacement` for the full measurement contract).
 *
 * Bind `containerStyle` to the panel's inline style and let the component's open path call
 * `resetBaseline` -> render -> `resolve` exactly once per open. A component with a superseded
 * open race (e.g. a list that can close/reopen before its render settles) guards the `resolve`
 * call itself before delegating here.
 */
export class PanelPositioning {
  /**
   * Inline style of the panel (see the `PanelPlacement` passed to the constructor).
   * Reset to the baseline on every open before measuring.
   */
  public readonly containerStyle: WritableSignal<PanelInsets>;

  /** Placement (baseline + per-axis flips) this panel resolves against. */
  private readonly placement: PanelPlacement;

  /**
   * @param placement Baseline insets plus optional per-axis flip insets for this panel.
   */
  constructor(placement: PanelPlacement) {
    this.placement = placement;
    this.containerStyle = signal<PanelInsets>(placement.baseline);
  }

  /**
   * Restore the placement baseline. Must run BEFORE the panel is (re)rendered on every open,
   * so the subsequent measurement is not judged by the old placement.
   */
  public resetBaseline(): void {
    this.containerStyle.set(this.placement.baseline);
  }

  /**
   * Resolve the panel placement so it does not overflow the viewport and write the result to
   * `containerStyle`. The panel must be VISIBLE and currently rendered under the baseline
   * (call `resetBaseline` first) - see `WindowUtils.resolvePanelPlacement`.
   * @param anchor Panel's containing block (the element the placement percentages resolve against).
   * @param panel Panel element to measure.
   */
  public resolve(anchor: HTMLElement, panel: HTMLElement): void {
    this.containerStyle.set(WindowUtils.resolvePanelPlacement(anchor, panel, this.placement));
  }
}
