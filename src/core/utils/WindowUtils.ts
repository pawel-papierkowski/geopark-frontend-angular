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
  /** Insets for the vertical axis, used when `baseline` overflows the viewport on the bottom
   *  AND the panel still fits in the space above the anchor (otherwise the baseline is kept). */
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
   * Vertical rule: `flipY` is applied only when the panel overflows the viewport bottom AND the
   * panel still fits in the space above the anchor. When neither side has room (panel taller
   * than the space above the anchor while also poking below the viewport), the baseline is kept
   * - the panel then stays below its component and the user scrolls the page down to reach it,
   * which beats being flipped off the top of the viewport where nothing can bring it back.
   *
   * Contract: `panel` must be VISIBLE and already rendered with `placement.baseline` applied.
   * Measuring under any other placement judges overflow by the OLD placement and can flip the
   * panel back into an overflowing position - the resolved insets are derived only from the
   * measured rect, never from the panel's current inline style.
   *
   * `anchor` must be the panel's CONTAINING BLOCK - the positioned element that `top/bottom`
   * percentages of `placement` resolve against (its padding box). Its top edge is where `flipY`
   * parks the panel's bottom edge, so `anchor.top` is the space available above. Because the
   * anchor rect reports the BORDER box while the flip lands on the padding box, a bordered
   * anchor is judged by its border width conservatively (the panel may fit by that much anyway).
   * The anchor is only read when the panel actually overflows the bottom, so the common
   * "fits below" path costs no extra layout read.
   *
   * The viewport is read as `documentElement.clientWidth/clientHeight` (visible area WITHOUT
   * scrollbars) rather than `window.innerWidth/innerHeight` (which include them): with the
   * latter a panel could be judged to fit while actually being clipped by the scrollbar gutter.
   * Overflow comparisons assume the panel's right/bottom margins are 0, so the rect edges are
   * also the visual edges.
   *
   * @param anchor Panel's containing block (the element the placement percentages resolve against).
   * @param panel Panel element to measure (must be absolutely positioned against its anchor).
   * @param placement Baseline insets plus optional per-axis flip insets.
   * @returns `placement.baseline` itself when it fits (same reference, so writing it back to a
   * signal holding it is a no-op), otherwise baseline merged with the flip(s) of the axes that
   * both overflow and have a fitting flip.
   */
  public static resolvePanelPlacement(anchor: HTMLElement, panel: HTMLElement, placement: PanelPlacement): PanelInsets {
    const rect = panel.getBoundingClientRect();
    const overflowRight = rect.right > document.documentElement.clientWidth;
    const fitsBelow = rect.bottom <= document.documentElement.clientHeight;

    // Flip only when the flipped panel fits: `flipY` puts the panel's bottom edge at the anchor's
    // top edge, so the panel fits above exactly when its height fits into that top offset. Read
    // lazily - when the panel fits below, no flip is considered and the anchor stays unmeasured.
    const fitsAbove = fitsBelow || placement.flipY === undefined
      ? false
      : rect.height <= anchor.getBoundingClientRect().top;
    const applyFlipY = !fitsBelow && fitsAbove;

    if (!overflowRight && !applyFlipY) return placement.baseline;

    return {
      ...placement.baseline,
      ...(overflowRight ? placement.flipX : {}),
      ...(applyFlipY ? placement.flipY : {}),
    };
  }
}
