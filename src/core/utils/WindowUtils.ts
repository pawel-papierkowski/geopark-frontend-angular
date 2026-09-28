/**
 * Insets of an absolutely positioned popup panel, as written to inline styles.
 * All four properties are always listed together: partially updating them would leave stale
 * values from a previous placement (e.g. an inline `top: auto` from an upward flip).
 */
export interface PanelInsets {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

/**
 * Placement of a popup panel relative to its anchor element (e.g. dropdown under an input).
 */
export interface PanelPlacement {
  /** Insets the panel is rendered with BEFORE it is measured. Must fit or trigger a flip. */
  baseline: PanelInsets;
  /** Insets for the horizontal axis, used when `baseline` overflows the viewport on the right. */
  flipX?: Pick<PanelInsets, 'left' | 'right'>;
  /** Insets for the vertical axis, used when `baseline` overflows the viewport on the bottom. */
  flipY?: Pick<PanelInsets, 'top' | 'bottom'>;
}

/** Window and viewport-related utility functions. */
export class WindowUtils {
  /**
   * Resolve the inline insets for a popup panel anchored to an element, flipping it
   * horizontally and/or vertically when the baseline placement would overflow the viewport.
   * Intended to run once per panel open - there is deliberately no resize/scroll re-check
   * (placement is relative to the anchor, and the absolutely positioned panel moves with it).
   *
   * Contract: `panel` must be VISIBLE and already rendered with `placement.baseline` applied.
   * Measuring under any other placement judges overflow by the OLD placement and can flip the
   * panel back into an overflowing position - the resolved insets are derived only from the
   * measured rect, never from the panel's current inline style.
   *
   * The viewport is read as `documentElement.clientWidth/clientHeight` (visible area WITHOUT
   * scrollbars) rather than `window.innerWidth/innerHeight` (which include them): with the
   * latter a panel could be judged to fit while actually being clipped by the scrollbar gutter.
   * Overflow comparisons assume the panel's right/bottom margins are 0, so the rect edges are
   * also the visual edges.
   *
   * @param panel Panel element to measure (must be absolutely positioned against its anchor).
   * @param placement Baseline insets plus optional per-axis flip insets.
   * @returns `placement.baseline` itself when it fits (same reference, so writing it back to a
   * signal holding it is a no-op), otherwise baseline merged with the flip(s) of overflowing axes.
   */
  public static resolvePanelPlacement(panel: HTMLElement, placement: PanelPlacement): PanelInsets {
    const rect = panel.getBoundingClientRect();
    const overflowRight = rect.right > document.documentElement.clientWidth;
    const overflowBottom = rect.bottom > document.documentElement.clientHeight;

    if (!overflowRight && !overflowBottom) return placement.baseline;

    return {
      ...placement.baseline,
      ...(overflowRight ? placement.flipX : {}),
      ...(overflowBottom ? placement.flipY : {}),
    };
  }
}
