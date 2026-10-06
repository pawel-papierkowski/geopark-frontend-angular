import { it, expect, vi } from 'vitest';

/** Viewport width assumed by positioning logic (jsdom performs no layout, real value is 0). */
const VIEWPORT_WIDTH = 1024;
/** Viewport height assumed by positioning logic (jsdom performs no layout, real value is 0). */
const VIEWPORT_HEIGHT = 768;
/** Height assumed for the popup, so the "fits above the anchor" comparisons have a value. */
const POPUP_RECT_HEIGHT = 200;
/** Anchor top with room for a `POPUP_RECT_HEIGHT`-tall popup above it. */
const ANCHOR_TOP_WITH_ROOM = 400;
/** Anchor top without room for a `POPUP_RECT_HEIGHT`-tall popup above it. */
const ANCHOR_TOP_NO_ROOM = 100;

/** Cleanup restoring the jsdom viewport definitions (set by `installViewportStub`). */
let restoreViewport: (() => void) | null = null;

/**
 * Build the popup rect parts read by the positioning logic.
 * Defaults model a popup that fits into the viewport on both axes.
 * @param overrides Rect parts to override the fitting defaults.
 * @returns DOMRect containing (at least) `right`, `bottom` and `height`.
 */
export function panelRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    right: VIEWPORT_WIDTH - 100,
    bottom: VIEWPORT_HEIGHT - 100,
    height: POPUP_RECT_HEIGHT,
    ...overrides,
  } as DOMRect;
}

/**
 * Pin jsdom's viewport dimensions: `documentElement.clientWidth/clientHeight` (the viewport
 * dimensions the component checks for overflow) report 0 without layout, so every open would
 * look like it overflows both edges. Define them as viewport-sized values for the suite.
 * Meant to be called from a spec's `beforeAll`, paired with `uninstallViewportStub`.
 */
export function installViewportStub(): void {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => VIEWPORT_WIDTH });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => VIEWPORT_HEIGHT });
  restoreViewport = () => {
    // Drop the own-property stubs so the prototype (jsdom) definitions are back in place.
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  };
}

/**
 * Drop the own-property viewport stubs installed by `installViewportStub`.
 * Meant to be called from a spec's `afterAll`.
 */
export function uninstallViewportStub(): void {
  restoreViewport?.();
  restoreViewport = null;
}

/** Fixture capabilities the shared positioning suite drives. */
export interface PositioningFixture {
  /** Popup element whose placement the suite observes. */
  popup(): HTMLElement;
  /** Open the popup and flush pending placement resolution. */
  open(): Promise<void>;
  /** Close the popup and flush pending placement resolution. */
  close(): Promise<void>;
  /** Stub the anchor root geometry - its top edge is the space available above the anchor for an upward flip. */
  stubAnchor(top: number): void;
}

/** Wiring the shared positioning suite needs from a component spec. */
export interface PositioningDriver {
  /** Popup noun used in titles and messages: 'panel' | 'list'. */
  readonly popup: string;
  /** Anchor noun used in titles and messages: 'input' | 'anchor'. */
  readonly subject: string;
  /** Horizontal right edge of the fitted popup: 'auto' (intrinsically sized panel) | '0px' (list stretched to the anchor). */
  readonly fittedRight: string;
  /** Fitted-horizontal phrase appended after `<popup> should `: 'stay left-aligned when it fits horizontally' | 'stay stretched to the anchor when it fits horizontally'. */
  readonly fittedPhrase: string;
  /** Arrange a fresh fixture with the popup closed. */
  arrange(): Promise<PositioningFixture>;
}

/**
 * Register the positioning suite shared by the popup-based specs (TimePicker,
 * DatePicker, ComboBox): horizontal right-align on viewport overflow and restore
 * on fit, right alignment kept across reopens while still overflowing, vertical
 * flip above the anchor (or refusal when there is no room above), and restore
 * below. Meant to be called from within a component spec's own
 * `describe('positioning')`, so test attribution and structure stay with that
 * spec file.
 * @param driver Component-specific nouns, fitted-alignment expectations and arrange hook.
 */
export function registerPositioningTests(driver: PositioningDriver): void {
  it(`should right-align ${driver.popup} when it would overflow the viewport`, async () => {
    // Arrange: Create fixture and stub popup geometry to report horizontal overflow only.
    const fixture = await driver.arrange();
    const popup = fixture.popup();
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(panelRect({ right: VIEWPORT_WIDTH + 50 }));

    // Act: Open the popup (positioning is recomputed after render).
    await fixture.open();

    // Assert: Popup is right-aligned (CSSOM normalizes unitless zero to pixels).
    expect(popup.style.left, `${driver.popup} should not be left-aligned on overflow`).toBe('auto');
    expect(popup.style.right, `${driver.popup} should be right-aligned on overflow`).toBe('0px');
    expect(popup.style.top, `${driver.popup} should stay below the ${driver.subject} when it fits vertically`).toBe('100%');
    expect(popup.style.bottom, `${driver.popup} should stay below the ${driver.subject} when it fits vertically`).toBe('auto');
  });

  it(`should restore left alignment when ${driver.popup} fits into the viewport`, async () => {
    // Arrange: Open popup with overflow geometry first to get into right-aligned state.
    const fixture = await driver.arrange();
    const popup = fixture.popup();
    const geometrySpy = vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(panelRect({ right: VIEWPORT_WIDTH + 50 }));
    await fixture.open();
    expect(popup.style.right, `${driver.popup} should start right-aligned on overflow`).toBe('0px');

    // Act: Popup now fits, so close and reopen it.
    await fixture.close();
    geometrySpy.mockReturnValue(panelRect());
    await fixture.open();

    // Assert: Popup alignment flipped back to the left.
    expect(popup.style.left, `${driver.popup} should be left-aligned when it fits`).toBe('0px');
    expect(popup.style.right, `${driver.popup} should not be right-aligned when it fits`).toBe(driver.fittedRight);
  });

  it(`should keep right alignment on reopen while the ${driver.popup} still overflows`, async () => {
    // Arrange: Geometry models real layout - baseline popup pokes out of the viewport,
    // right-aligned popup fits (its right edge sits at the anchor, inside the viewport).
    const fixture = await driver.arrange();
    const popup = fixture.popup();
    vi.spyOn(popup, 'getBoundingClientRect').mockImplementation(() =>
      popup.style.left === 'auto'
        ? panelRect({ right: VIEWPORT_WIDTH - 100 })
        : panelRect({ right: VIEWPORT_WIDTH + 50 }),
    );

    // Act: Open, close, open again.
    await fixture.open();
    expect(popup.style.right, `first open should right-align the overflowing ${driver.popup}`).toBe('0px');
    await fixture.close();
    await fixture.open();

    // Assert: Measurement ran under the reset baseline, so the popup must NOT revert to
    // left alignment (the old code measured under the persisted right alignment, saw
    // "fits" and wrote left - leaving an overflowing popup on every even reopen).
    expect(popup.style.right, `reopen must keep right alignment while the ${driver.popup} overflows`).toBe('0px');
    expect(popup.style.left, `reopen must keep right alignment while the ${driver.popup} overflows`).toBe('auto');
  });

  it(`should flip ${driver.popup} above the ${driver.subject} when it would overflow the viewport bottom`, async () => {
    // Arrange: Geometry fits horizontally but pokes out below the viewport, with room
    // above the anchor for the flipped popup.
    const fixture = await driver.arrange();
    const popup = fixture.popup();
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(panelRect({ bottom: VIEWPORT_HEIGHT + 50 }));
    fixture.stubAnchor(ANCHOR_TOP_WITH_ROOM);

    // Act: Open the popup.
    await fixture.open();

    // Assert: Popup is flipped above the anchor (bottom: 100% mirrors the CSS top: 100%).
    expect(popup.style.top, `${driver.popup} should not stay below the ${driver.subject} on vertical overflow`).toBe('auto');
    expect(popup.style.bottom, `${driver.popup} should sit above the ${driver.subject} on vertical overflow`).toBe('100%');
    expect(popup.style.left, `${driver.popup} should ${driver.fittedPhrase}`).toBe('0px');
    expect(popup.style.right, `${driver.popup} should ${driver.fittedPhrase}`).toBe(driver.fittedRight);
  });

  it(`should keep ${driver.popup} below the ${driver.subject} when it fits on neither side`, async () => {
    // Arrange: Popup overflows the viewport bottom and is taller than the space above the anchor.
    const fixture = await driver.arrange();
    const popup = fixture.popup();
    vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(panelRect({ bottom: VIEWPORT_HEIGHT + 50 }));
    fixture.stubAnchor(ANCHOR_TOP_NO_ROOM);

    // Act: Open the popup.
    await fixture.open();

    // Assert: Popup stays below the anchor so the user can scroll down, instead of being
    // pushed off the top of the viewport.
    expect(popup.style.top, `${driver.popup} should stay below the ${driver.subject} when there is no room above`).toBe('100%');
    expect(popup.style.bottom, `${driver.popup} should not flip above the ${driver.subject} without room above`).toBe('auto');
  });

  it(`should restore placement below the ${driver.subject} when it fits again`, async () => {
    // Arrange: Open with vertical overflow first to get into flipped-above state.
    const fixture = await driver.arrange();
    const popup = fixture.popup();
    const geometrySpy = vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue(panelRect({ bottom: VIEWPORT_HEIGHT + 50 }));
    fixture.stubAnchor(ANCHOR_TOP_WITH_ROOM);
    await fixture.open();
    expect(popup.style.bottom, `${driver.popup} should start flipped above on vertical overflow`).toBe('100%');

    // Act: Popup now fits, so close and reopen it.
    await fixture.close();
    geometrySpy.mockReturnValue(panelRect());
    await fixture.open();

    // Assert: Popup placement flipped back below the anchor.
    expect(popup.style.top, `${driver.popup} should be below the ${driver.subject} when it fits`).toBe('100%');
    expect(popup.style.bottom, `${driver.popup} should not stay above the ${driver.subject} when it fits`).toBe('auto');
  });
}
