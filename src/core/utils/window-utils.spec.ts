import { WindowUtils, type PanelPlacement } from './WindowUtils';

/**
 * Unit tests of WindowUtils.
 * Note: jsdom performs no layout, so `documentElement.clientWidth/clientHeight` (the viewport
 * dimensions the utility checks against) always report 0 - they are stubbed to viewport-sized
 * values, and panel rects are mocked.
 */
describe('WindowUtils', () => {
  /** Viewport width assumed by the tests (real jsdom value is 0). */
  const VIEWPORT_WIDTH = 1024;
  /** Viewport height assumed by the tests (real jsdom value is 0). */
  const VIEWPORT_HEIGHT = 768;

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
      ...rect,
    } as DOMRect);
    return panel;
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

      // Act: Resolve placement.
      const result = WindowUtils.resolvePanelPlacement(panel, placement);

      // Assert: Baseline is returned as-is (same reference, so writing it back is a no-op).
      expect(result, 'fitting panel should keep the baseline').toBe(placement.baseline);
    });

    it('should apply flipX when panel overflows the viewport on the right', () => {
      // Arrange: Panel pokes out past the right edge only.
      const panel = arrangePanel({ right: VIEWPORT_WIDTH + 50 });

      // Act: Resolve placement.
      const result = WindowUtils.resolvePanelPlacement(panel, placement);

      // Assert: Horizontal axis flipped, vertical axis untouched.
      expect(result, 'right overflow should flip the horizontal axis').toEqual({
        top: '100%',
        bottom: 'auto',
        left: 'auto',
        right: '0',
      });
    });

    it('should apply flipY when panel overflows the viewport on the bottom', () => {
      // Arrange: Panel pokes out below the viewport only.
      const panel = arrangePanel({ bottom: VIEWPORT_HEIGHT + 50 });

      // Act: Resolve placement.
      const result = WindowUtils.resolvePanelPlacement(panel, placement);

      // Assert: Vertical axis flipped, horizontal axis untouched.
      expect(result, 'bottom overflow should flip the vertical axis').toEqual({
        top: 'auto',
        bottom: '100%',
        left: '0',
        right: 'auto',
      });
    });

    it('should apply both flips when panel overflows both axes', () => {
      // Arrange: Panel pokes out past the right edge and below the viewport.
      const panel = arrangePanel({ right: VIEWPORT_WIDTH + 50, bottom: VIEWPORT_HEIGHT + 50 });

      // Act: Resolve placement.
      const result = WindowUtils.resolvePanelPlacement(panel, placement);

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

      // Act: Resolve placement.
      const result = WindowUtils.resolvePanelPlacement(panel, placementNoFlipY);

      // Assert: Missing flip leaves the baseline insets of that axis in place.
      expect(result, 'axis without configured flip should keep its baseline insets').toEqual({
        top: '100%',
        bottom: 'auto',
        left: '0',
        right: 'auto',
      });
    });
  });
});
