import { resolvePanelPlacement, type PanelPlacement } from './popup-panel-placement';

/**
 * Unit tests of resolvePanelPlacement.
 * Note: jsdom performs no layout, so `documentElement.clientWidth/clientHeight` (the viewport
 * dimensions the utility checks against) always report 0 - they are stubbed to viewport-sized
 * values, and panel rects are mocked.
 */
describe('popup-panel-placement', () => {
  /** Viewport width assumed by the tests (real jsdom value is 0). */
  const VIEWPORT_WIDTH = 1024;
  /** Viewport height assumed by the tests (real jsdom value is 0). */
  const VIEWPORT_HEIGHT = 768;
  /** Height assumed for the panel, so "fits above the anchor" comparisons have a value. */
  const PANEL_HEIGHT = 200;
  /** Anchor top with room for a `PANEL_HEIGHT`-tall panel above it. */
  const ANCHOR_TOP_WITH_ROOM = 400;
  /** Anchor top without room for a `PANEL_HEIGHT`-tall panel above it. */
  const ANCHOR_TOP_NO_ROOM = 100;

  /** Baseline placement: below the anchor, left-aligned, with both flips configured. */
  const placement: PanelPlacement = {
    baseline: { top: '100%', bottom: 'auto', left: '0', right: 'auto' },
    flipX: { left: 'auto', right: '0' },
    flipY: { top: 'auto', bottom: '100%' },
  };

  /**
   * Create a panel element whose rect reports the given geometry.
   * @param rect Rect parts to use; missing parts default to "fits inside the viewport".
   * @returns Panel element with stubbed `getBoundingClientRect`.
   */
  function arrangePanel(rect: Partial<DOMRect> = {}): HTMLElement {
    const panel = document.createElement('div');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      right: VIEWPORT_WIDTH - 100,
      bottom: VIEWPORT_HEIGHT - 100,
      height: PANEL_HEIGHT,
      ...rect,
    } as DOMRect);
    return panel;
  }

  /**
   * Create an anchor element (the panel's containing block) whose rect reports the given top.
   * The top edge is where `flipY` parks the panel, so it is the available space above.
   * @param top Distance of the anchor's top edge from the viewport top.
   * @returns Anchor element with stubbed `getBoundingClientRect`.
   */
  function arrangeAnchor(top: number): HTMLElement {
    const anchor = document.createElement('div');
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
    return anchor;
  }

  beforeAll(() => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => VIEWPORT_WIDTH });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => VIEWPORT_HEIGHT });
  });

  afterAll(() => {
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  });

  describe('resolvePanelPlacement', () => {
    it('should keep baseline when panel fits into the viewport', () => {
      // Arrange: Panel fully inside the viewport on both axes.
      const panel = arrangePanel();
      const anchor = arrangeAnchor(ANCHOR_TOP_WITH_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placement);

      // Assert: Baseline is returned as-is (same reference, so writing it back is a no-op).
      expect(result, 'fitting panel should keep the baseline').toBe(placement.baseline);
    });

    it('should apply flipX when panel overflows the viewport on the right', () => {
      // Arrange: Panel pokes out past the right edge only.
      const panel = arrangePanel({ right: VIEWPORT_WIDTH + 50 });
      const anchor = arrangeAnchor(ANCHOR_TOP_WITH_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placement);

      // Assert: Horizontal axis flipped, vertical axis untouched.
      expect(result, 'right overflow should flip the horizontal axis').toEqual({
        top: '100%',
        bottom: 'auto',
        left: 'auto',
        right: '0',
      });
    });

    it('should apply flipY when panel overflows the viewport on the bottom', () => {
      // Arrange: Panel pokes out below the viewport only, and there is room above the anchor.
      const panel = arrangePanel({ bottom: VIEWPORT_HEIGHT + 50 });
      const anchor = arrangeAnchor(ANCHOR_TOP_WITH_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placement);

      // Assert: Vertical axis flipped, horizontal axis untouched.
      expect(result, 'bottom overflow should flip the vertical axis').toEqual({
        top: 'auto',
        bottom: '100%',
        left: '0',
        right: 'auto',
      });
    });

    it('should apply both flips when panel overflows both axes', () => {
      // Arrange: Panel pokes out past the right edge and below the viewport, with room above.
      const panel = arrangePanel({ right: VIEWPORT_WIDTH + 50, bottom: VIEWPORT_HEIGHT + 50 });
      const anchor = arrangeAnchor(ANCHOR_TOP_WITH_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placement);

      // Assert: Both axes flipped.
      expect(result, 'overflow on both axes should flip both axes').toEqual({
        top: 'auto',
        bottom: '100%',
        left: 'auto',
        right: '0',
      });
    });

    it('should keep baseline axis when no flip is configured for it', () => {
      // Arrange: Placement without flipY and a panel overflowing on the bottom.
      const placementNoFlipY: PanelPlacement = { baseline: placement.baseline, flipX: placement.flipX };
      const panel = arrangePanel({ bottom: VIEWPORT_HEIGHT + 50 });
      const anchor = arrangeAnchor(ANCHOR_TOP_WITH_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placementNoFlipY);

      // Assert: Missing flip leaves the baseline insets of that axis in place.
      expect(result, 'axis without configured flip should keep its baseline insets').toEqual({
        top: '100%',
        bottom: 'auto',
        left: '0',
        right: 'auto',
      });
    });

    it('should keep baseline when panel fits neither below nor above the anchor', () => {
      // Arrange: Panel pokes out below the viewport and is taller than the space above the anchor.
      const panel = arrangePanel({ bottom: VIEWPORT_HEIGHT + 50 });
      const anchor = arrangeAnchor(ANCHOR_TOP_NO_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placement);

      // Assert: Baseline is returned as-is - the panel stays below the anchor so the user can
      // scroll down instead of being pushed off the top of the viewport.
      expect(result, 'panel fitting on neither side should stay below the anchor').toBe(placement.baseline);
    });

    it('should apply only flipX when panel overflows both edges but fits neither below nor above', () => {
      // Arrange: Panel pokes out past the right edge and below the viewport, with no room above.
      const panel = arrangePanel({ right: VIEWPORT_WIDTH + 50, bottom: VIEWPORT_HEIGHT + 50 });
      const anchor = arrangeAnchor(ANCHOR_TOP_NO_ROOM);

      // Act: Resolve placement.
      const result = resolvePanelPlacement(anchor, panel, placement);

      // Assert: Horizontal axis flipped, vertical axis left at the baseline.
      expect(result, 'only the horizontal axis should flip without room above').toEqual({
        top: '100%',
        bottom: 'auto',
        left: 'auto',
        right: '0',
      });
    });
  });
});
