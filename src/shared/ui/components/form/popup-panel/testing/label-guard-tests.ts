import { it, expect } from 'vitest';

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

    // Assert: Default canceled, so focus is not stolen from the control.
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

    // Act: Dispatch mousedown on a label without for attribute.
    const event = dispatchMousedown(label);

    // Assert: Generated ident never matches empty htmlFor, defaults preserved.
    expect(event.defaultPrevented, 'generated ident should not match label without for').toBe(false);

    // Cleanup: Remove label element.
    label.remove();
  });
}
