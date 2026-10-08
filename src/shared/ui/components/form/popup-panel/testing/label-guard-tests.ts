import { it, expect, type Mock } from 'vitest';

import { dispatchMousedown } from './mouse';

/** Fixture capabilities the shared label-prevention suite drives. */
export interface LabelPreventionFixture {
  /** Destroy the component, removing its document-level mousedown listener. */
  destroy(): void;
}

/** Wiring the shared label-prevention suite needs from a component spec. */
export interface LabelPreventionDriver {
  /** Ident the component pairs with its own `<label for>`. */
  readonly ident: string;
  /** Arrange a fixture; `ident` overrides the default (empty string covers the empty-ident case). */
  arrange(ident?: string): Promise<LabelPreventionFixture>;
}

/**
 * Register the label-mousedown prevention suite shared by label-driven components
 * (combo-box, date-time-picker). The guard lives in `LabelActivation.installDocumentGuard`;
 * these tests verify each component wires it with its own ident and tears it down on destroy.
 * Meant to be called from within a component spec's own `describe('label')`, so test
 * attribution and structure stay with that spec file.
 * @param driver Component-specific ident and arrange hook.
 */
export function registerLabelPreventionTests(driver: LabelPreventionDriver): void {
  it('should prevent default on mousedown of associated label', async () => {
    // Arrange: Create component and a label targeting its hidden button.
    await driver.arrange();
    const label = document.createElement('label');
    label.htmlFor = driver.ident;
    document.body.appendChild(label);

    // Act: Dispatch mousedown as a real pointer interaction would.
    const event = dispatchMousedown(label);

    // Assert: Default cancelled, so focus is not stolen from the control.
    expect(event.defaultPrevented, 'mousedown on associated label should be default-prevented').toBe(true);

    // Cleanup: Remove label element.
    label.remove();
  });

  it('should not prevent default on mousedown of foreign label', async () => {
    // Arrange: Create component and a label targeting an unrelated control.
    await driver.arrange();
    const label = document.createElement('label');
    label.htmlFor = 'other-control';
    document.body.appendChild(label);

    // Act: Dispatch mousedown on the foreign label.
    const event = dispatchMousedown(label);

    // Assert: Default untouched, unrelated labels keep native behavior.
    expect(event.defaultPrevented, 'mousedown on foreign label should keep its default').toBe(false);

    // Cleanup: Remove label element.
    label.remove();
  });

  it('should not prevent default on label mousedown after component is destroyed', async () => {
    // Arrange: Create component, then destroy it (removes the document listener).
    const fixture = await driver.arrange();
    const label = document.createElement('label');
    label.htmlFor = driver.ident;
    document.body.appendChild(label);
    fixture.destroy();

    // Act: Dispatch mousedown after destroy.
    const event = dispatchMousedown(label);

    // Assert: Listener was cleaned up with the component.
    expect(event.defaultPrevented, 'destroyed component should not prevent label mousedown').toBe(false);

    // Cleanup: Remove label element.
    label.remove();
  });

  it('should not prevent default on mousedown when ident is empty', async () => {
    // Arrange: Create component without ident (its generated ident never matches labels without for).
    await driver.arrange('');
    const label = document.createElement('label');
    document.body.appendChild(label);

    // Act: Dispatch mousedown on a label without a `for` attribute.
    const event = dispatchMousedown(label);

    // Assert: Generated ident never matches empty htmlFor, defaults preserved.
    expect(event.defaultPrevented, 'generated ident should not match label without for').toBe(false);

    // Cleanup: Remove label element.
    label.remove();
  });
}

/** Fixture capabilities the shared outside-press suite drives. */
export interface OutsidePressFixture {
  /** Open the popup; resolves once it is open (the open itself asserts the state). */
  open(): Promise<void>;
  /** Whether the popup is currently open. */
  isOpen(): boolean;
  /** Subscribe to the component's touch output; returns the spy. */
  trackTouch(): Mock;
  /** Flush pending component work (change detection / stability) after an event. */
  settle(): Promise<void>;
  /** Component-specific assertions about the closed state, run by the outside-close test
   * (e.g. combo-box's highlight reset). */
  assertClosedExtras?(): void;
  /** Destroy the component, removing its document-level listener. */
  destroy(): void;
}

/** Wiring the shared outside-press suite needs from a component spec. */
export interface OutsidePressDriver {
  /** Popup noun used in titles and messages: 'list' | 'clock panel'. */
  readonly popup: string;
  /** Component-root noun used in the outside-press title: 'component' | 'wrapper'. */
  readonly subject: string;
  /** Focus event that reports touch when focus really leaves: 'blur' | 'focusout'. */
  readonly touchSource: string;
  /** Ident the component pairs with its own `<label for>`. */
  readonly ident: string;
  /** Arrange a fresh fixture with the popup closed. */
  arrange(): Promise<OutsidePressFixture>;
}

/**
 * Register the outside-press suite shared by label-driven components (combo-box,
 * date-time-picker): a press outside the component closes the popup (blur/focusout alone
 * misses it on WebKit), the component's own label stays exempt (default prevented, popup open so the
 * forwarded label activation keeps its toggle), and the document listener dies with the
 * component. Mechanics live in `LabelActivation.installDocumentGuard`; these tests verify
 * each component wires ident, boundary and close callback. Component-specific probes
 * (inside-press targets, pending-pick interactions) stay in the component specs.
 * Meant to be called from within a component spec's own `describe('outside press')`, so
 * test attribution and structure stay with that spec file.
 * @param driver Component-specific nouns and arrange hook.
 */
export function registerOutsidePressTests(driver: OutsidePressDriver): void {
  it(`should close ${driver.popup} when mousedown lands outside the ${driver.subject}`, async () => {
    // Arrange: Create component with open popup and a button outside it.
    const fixture = await driver.arrange();
    const touchSpy = fixture.trackTouch();
    await fixture.open();
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    try {
      // Act: Press outside the component - the blur/focusout-only close misses this on
      // WebKit, where an outside press does not necessarily move focus.
      dispatchMousedown(outside);
      await fixture.settle();

      // Assert: Popup closed by the press itself. Touch is NOT reported here: it is emitted
      // by the focus event that follows focus really leaving, so emitting it in the press
      // handler would double-report on engines that do blur.
      expect(fixture.isOpen(), `outside mousedown should close the ${driver.popup}`).toBe(false);
      fixture.assertClosedExtras?.();
      expect(touchSpy, `outside mousedown itself should not emit touch (${driver.touchSource} reports it)`).not.toHaveBeenCalled();
    } finally { // cleanup
      outside.remove();
    }
  });

  it(`should close ${driver.popup} when mousedown lands on a foreign label`, async () => {
    // Arrange: Create component with open popup and a label pointing at an unrelated control.
    const fixture = await driver.arrange();
    await fixture.open();
    const label = document.createElement('label');
    label.htmlFor = 'other-control';
    document.body.appendChild(label);

    try {
      // Act: Press the foreign label - only the component's own associated label is exempt.
      dispatchMousedown(label);
      await fixture.settle();

      // Assert: Popup closed like any other outside target.
      expect(fixture.isOpen(), `foreign label mousedown should close the ${driver.popup}`).toBe(false);
    } finally { // cleanup
      label.remove();
    }
  });

  it(`should keep ${driver.popup} open when mousedown lands on the associated label`, async () => {
    // Arrange: Create component with open popup and its own associated label.
    const fixture = await driver.arrange();
    await fixture.open();
    const label = document.createElement('label');
    label.htmlFor = driver.ident;
    document.body.appendChild(label);

    try {
      // Act: Press the associated label - closing here would make the following label
      // activation see a closed popup and reopen it, breaking the toggle contract.
      const event = dispatchMousedown(label);
      await fixture.settle();

      // Assert: Popup stays open (the label toggle owns it) and the default stays cancelled
      // (existing focus-steal guard).
      expect(fixture.isOpen(), `own label mousedown should keep the ${driver.popup} open for the label toggle`).toBe(true);
      expect(event.defaultPrevented, 'own label mousedown should stay default-prevented').toBe(true);
    } finally { // cleanup
      label.remove();
    }
  });

  it(`should not close ${driver.popup} via document mousedown after component is destroyed`, async () => {
    // Arrange: Create component, open the popup, then destroy it (removes the listener).
    const fixture = await driver.arrange();
    await fixture.open();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    fixture.destroy();

    try {
      // Act: Press outside after destroy - a leaked listener would reach into a destroyed
      // component (view children already torn down).

      // Assert: Dispatch completes without throwing, so the listener was cleaned up.
      expect(() => dispatchMousedown(outside), 'destroyed component should have no document mousedown listener left').not.toThrow();
    } finally { // cleanup
      outside.remove();
    }
  });
}
