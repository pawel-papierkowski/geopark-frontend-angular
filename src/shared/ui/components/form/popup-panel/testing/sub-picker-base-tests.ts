import { it, expect, type Mock } from 'vitest';

/** Arrange options shared by the sub-picker specs behind the driver. */
export interface SubPickerArrangeOptions {
  /** Whether the picker starts disabled. */
  readonly disabled?: boolean;
  /** Whether the picker starts with a committed value (disable scenarios). */
  readonly withValue?: boolean;
}

/** Fixture capabilities the shared sub-picker base suites drive. */
export interface SubPickerBaseFixture {
  /** Run change detection (mirrors the component fixture's detectChanges). */
  detectChanges(): void;
  /** Subscribe to the component's touch output; returns the spy. */
  trackTouch(): Mock;
  /** Open the panel through the component's mouse path (input click) and flush. */
  open(): Promise<void>;
  /** Whether the panel is currently open. */
  isOpen(): boolean;
  /** Text input element of the control. */
  input(): HTMLElement;
  /** Element that owns keyboard focus while the panel is open (hour listbox / calendar grid). */
  insideTarget(): HTMLElement;
  /** Panel root element (its chrome: padding, border and gaps around the content). */
  panel(): HTMLElement;
  /** Pointer-pressed panel content (hour listbox / a day cell). */
  chromeInnerTarget(): HTMLElement;
  /** Dispatch a bubbling focusout from source toward relatedTarget (omitted = unknown target). */
  dispatchFocusout(source: Element, relatedTarget?: Element | null): void;
  /** Append a fresh button to document.body; caller removes it. */
  appendOutsideButton(): HTMLButtonElement;
  /** Set the containment `container` input and run change detection. */
  setContainer(container: HTMLElement): void;
  /** Set the `disabled` input and settle (detectChanges -> whenStable -> detectChanges). */
  setDisabled(disabled: boolean): Promise<void>;
  /** Call showPanel() and settle (whenStable -> detectChanges). */
  showPanel(): Promise<void>;
  /** Call focus(options) and settle the two-round open (detectChanges -> whenStable -> detectChanges twice). */
  focus(options?: FocusOptions): Promise<void>;
  /** Spy on the input's native focus() to observe forwarded options. */
  trackInputFocus(): Mock;
  /** Seed per-component keyboard state before the disable-while-open scenario (when the component tracks one). */
  prepareDisable?(): void;
  /** Extra assertions after the disable-while-open scenario (component-specific state reset). */
  assertDisableExtras?(): void;
  /** Extra assertion after showPanel-while-disabled: focus must not be stolen into the panel. */
  assertNoFocusStolen?(): void;
  /** Assert where focus lands after focus() (diverges: in-panel target vs not <body>). */
  assertFocusLanded(): void;
}

/** Wiring the shared sub-picker base suites needs from a component spec. */
export interface SubPickerBaseDriver {
  /** Panel kind used in the chrome test title: 'clock' | 'calendar'. */
  readonly popup: string;
  /** Where the chrome-inner press lands, verbatim for title and message: 'inside a clock column' | 'on a day cell'. */
  readonly innerWhere: string;
  /** Title of the focus() contract test (diverges per component). */
  readonly focusContractTitle: string;
  /** Arrange a fresh fixture with the given options. */
  arrange(options?: SubPickerArrangeOptions): Promise<SubPickerBaseFixture>;
}

/**
 * Register the core panel-lifecycle suite shared by the sub-pickers (TimePicker,
 * DatePicker): disable closes the panel, focusout reports touch only on a real
 * blur (own container stays internal, foreign hidden-label buttons do not),
 * showPanel only opens, and panel chrome guards its mousedown default. Component
 * pieces (focus returns, Escape, header navigation, pending interactions) stay in
 * the component specs. Meant to be called from within a component spec's own
 * `describe('open/close&selection')`, so test attribution and structure stay with
 * that spec file.
 * @param driver Component-specific nouns, focus-contract title and arrange hook.
 */
export function registerSubPickerCoreTests(driver: SubPickerBaseDriver): void {
  it('should close open panel when disabled becomes true', async () => {
    // Arrange: Create component, open panel and spy on touch output.
    const fixture = await driver.arrange({ withValue: true });
    const touchSpy = fixture.trackTouch();
    await fixture.open();
    fixture.prepareDisable?.();
    expect(fixture.isOpen(), 'panel should be open before disabling').toBe(true);

    // Act: Disable component programmatically while panel is open.
    await fixture.setDisabled(true);

    // Assert: Effect closed the panel without emitting touch.
    expect(fixture.isOpen(), 'panel should close when component becomes disabled').toBe(false);
    fixture.assertDisableExtras?.();
    expect(touchSpy, 'programmatic closing should not emit touch').toHaveBeenCalledTimes(0);
  });

  it('should close panel and emit touch when focus leaves the component', async () => {
    // Arrange: Create component, open panel, spy on touch and create element outside the component.
    const fixture = await driver.arrange();
    const touchSpy = fixture.trackTouch();
    await fixture.open();
    const outside = fixture.appendOutsideButton();

    try {
      // Act: Simulate focus leaving to the outside element.
      fixture.dispatchFocusout(fixture.input(), outside);
      fixture.detectChanges();

      // Assert: Panel closed and touch emitted once.
      expect(fixture.isOpen(), 'panel should close when focus leaves component').toBe(false);
      expect(touchSpy, 'touch should be emitted when focus leaves component').toHaveBeenCalledTimes(1);
    } finally { // cleanup
      outside.remove();
    }
  });

  it('should keep panel open without touch when focus moves within component', async () => {
    // Arrange: Create component, open panel and spy on touch output.
    const fixture = await driver.arrange();
    const touchSpy = fixture.trackTouch();
    await fixture.open();

    // Act: Simulate focus moving from input to the in-panel focus target inside the component.
    fixture.dispatchFocusout(fixture.input(), fixture.insideTarget());
    fixture.detectChanges();

    // Assert: Internal focus move is not a real blur.
    expect(fixture.isOpen(), 'internal focus move should keep panel open').toBe(true);
    expect(touchSpy, 'internal focus move should not emit touch').not.toHaveBeenCalled();
  });

  it('should keep panel open without touch when focus moves to an element inside the configured container', async () => {
    // Arrange: Create component, configure the host wrapper's root as its containment
    // boundary (its hidden label target lives inside that root, outside this sub-picker),
    // open panel, spy on touch.
    const fixture = await driver.arrange();
    const container = document.createElement('div');
    const target = document.createElement('button');
    container.appendChild(target);
    document.body.appendChild(container);
    fixture.setContainer(container);
    const touchSpy = fixture.trackTouch();
    await fixture.open();

    try {
      // Act: Simulate label activation moving focus from inside the picker to the wrapper's
      // hidden label target - a sibling of this sub-picker, inside the wrapper root.
      fixture.dispatchFocusout(fixture.input(), target);
      fixture.detectChanges();

      // Assert: The wrapper root is the component boundary, so this is still "internal" -
      // it must neither close the panel nor report the control as touched.
      expect(fixture.isOpen(), 'panel should stay open when focus moves inside the container').toBe(true);
      expect(touchSpy, 'touch should not be emitted when focus moves inside the container').not.toHaveBeenCalled();
    } finally { // cleanup
      container.remove();
    }
  });

  it('should treat focus move to a foreign hidden-label-button as a real blur', async () => {
    // Arrange: Create component, configure the host wrapper's root as its containment
    // boundary, open panel, spy on touch and create a foreign element that carries the
    // shared hidden-label-button class but sits OUTSIDE that boundary.
    const fixture = await driver.arrange();
    const container = document.createElement('div');
    document.body.appendChild(container);
    fixture.setContainer(container);
    const touchSpy = fixture.trackTouch();
    await fixture.open();
    const foreign = document.createElement('button');
    foreign.classList.add('hidden-label-button');
    document.body.appendChild(foreign);

    try {
      // Act: Simulate focus leaving to the foreign hidden button.
      fixture.dispatchFocusout(fixture.input(), foreign);
      fixture.detectChanges();

      // Assert: The class belongs to other components' label targets too, and the button is
      // outside this wrapper - it must count as leaving: panel closed, touch emitted once.
      expect(fixture.isOpen(), 'panel should close when focus leaves to a foreign hidden-label-button').toBe(false);
      expect(touchSpy, 'touch should be emitted when focus leaves to a foreign hidden-label-button').toHaveBeenCalledTimes(1);
    } finally { // cleanup
      foreign.remove();
      container.remove();
    }
  });

  it(`should prevent default on mousedown on the ${driver.popup} panel chrome`, async () => {
    // Arrange: Create component and open the panel.
    const fixture = await driver.arrange();
    await fixture.open();
    const panel = fixture.panel();

    // Act: Dispatch a real cancelable mousedown on the panel itself.
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    panel.dispatchEvent(event);

    // Assert: Default focus change is cancelled, so focus cannot jump to <body> (which the
    // focusout handler would read as leaving the component - closing panel and emitting touch).
    expect(event.defaultPrevented, 'mousedown on panel chrome should be default-prevented').toBe(true);
  });

  it(`should keep default on mousedown ${driver.innerWhere}`, async () => {
    // Arrange: Create component and open the panel.
    const fixture = await driver.arrange();
    await fixture.open();
    const target = fixture.chromeInnerTarget();

    // Act: Dispatch a real cancelable mousedown on the in-panel target.
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);

    // Assert: Panel-internal presses keep native behaviour, only panel chrome is guarded.
    expect(event.defaultPrevented, `mousedown ${driver.innerWhere} should keep its default`).toBe(false);
  });

  it('should emit touch when focus leaves while panel is already closed', async () => {
    // Arrange: Create component with closed panel (state reached after Escape or keyboard
    // commit moved focus back to the input) and spy on touch output.
    const fixture = await driver.arrange();
    const touchSpy = fixture.trackTouch();
    const outside = fixture.appendOutsideButton();

    try {
      // Act: Simulate focusout while panel is closed.
      fixture.dispatchFocusout(fixture.input(), outside);
      fixture.detectChanges();

      // Assert: Blur reports touch even though the panel was already closed.
      expect(fixture.isOpen(), 'panel should stay closed').toBe(false);
      expect(touchSpy, 'touch should be emitted when focus leaves while panel is closed').toHaveBeenCalledTimes(1);
    } finally { // cleanup
      outside.remove();
    }
  });

  it('should not emit touch when component becomes disabled while focus is inside', async () => {
    // Arrange: Create component, open panel, spy on touch and disable it (effect closes panel).
    const fixture = await driver.arrange({ withValue: true });
    const touchSpy = fixture.trackTouch();
    await fixture.open();
    await fixture.setDisabled(true);
    const outside = fixture.appendOutsideButton();

    try {
      // Act: Simulate the focusout browsers fire when the in-panel focus target is hidden by disabling.
      fixture.dispatchFocusout(fixture.insideTarget(), outside);
      fixture.detectChanges();

      // Assert: Programmatic close caused by disabling must not report touch.
      expect(touchSpy, 'disabling should not emit touch').toHaveBeenCalledTimes(0);
    } finally { // cleanup
      outside.remove();
    }
  });

  it('should close panel and emit touch on focusout without relatedTarget', async () => {
    // Arrange: Create component, open panel and spy on touch output.
    const fixture = await driver.arrange();
    const touchSpy = fixture.trackTouch();
    await fixture.open();

    // Act: Simulate focusout without knowing the next target (e.g. window blur).
    fixture.dispatchFocusout(fixture.input());
    fixture.detectChanges();

    // Assert: Panel closed and touch emitted.
    expect(fixture.isOpen(), 'panel should close on focusout without relatedTarget').toBe(false);
    expect(touchSpy, 'touch should be emitted on focusout without relatedTarget').toHaveBeenCalledTimes(1);
  });

  it('should open closed panel only on showPanel', async () => {
    // Arrange: Create component with closed panel.
    const fixture = await driver.arrange();

    // Act: Show panel twice.
    await fixture.showPanel();
    expect(fixture.isOpen(), 'showPanel should open closed panel').toBe(true);

    // Assert: Second call keeps panel open (it only opens).
    await fixture.showPanel();
    expect(fixture.isOpen(), 'showPanel should keep open panel open').toBe(true);
  });

  it('should not open panel via showPanel when disabled', async () => {
    // Arrange: Create disabled component with closed panel.
    const fixture = await driver.arrange({ disabled: true });

    // Act: Attempt programmatic open.
    await fixture.showPanel();

    // Assert: Panel stays closed and no focus is stolen into the panel.
    expect(fixture.isOpen(), 'showPanel must not open the panel of a disabled picker').toBe(false);
    fixture.assertNoFocusStolen?.();
  });
}

/**
 * Register the focus-contract suite shared by the sub-pickers (TimePicker,
 * DatePicker): focus() auto-opens the panel, is a no-op while disabled, and
 * forwards FocusOptions to the input. Where focus ends up after the open
 * diverges per component and is asserted through the driver's hook; the
 * component-specific handoff tests stay in the component specs. Meant to be
 * called from within a component spec's own `describe('focus')`, so test
 * attribution and structure stay with that spec file.
 * @param driver Component-specific nouns, focus-contract title and arrange hook.
 */
export function registerSubPickerFocusTests(driver: SubPickerBaseDriver): void {
  it(driver.focusContractTitle, async () => {
    // Arrange: FormUiControl.focus contract - the form-driven path (e.g. "focus first invalid field").
    const fixture = await driver.arrange();

    // Act: Focus the control programmatically. The open spans two forRender rounds (measure
    // under baseline, apply flip, then focus), so two flush rounds are needed.
    await fixture.focus();

    // Assert: The panel opens like Tab and focus lands where the component specifies.
    expect(fixture.isOpen(), 'focus() should auto-open the panel like Tab').toBe(true);
    fixture.assertFocusLanded();
  });

  it('should be a no-op when disabled', async () => {
    // Arrange: Disabled component (input carries disabled, so focusInput refuses focus).
    const fixture = await driver.arrange({ disabled: true });

    // Act: Focus the disabled control.
    await fixture.focus();

    // Assert: Neither the input nor the panel reacts.
    expect(document.activeElement, 'focus() must not focus a disabled control').not.toBe(fixture.input());
    expect(fixture.isOpen(), 'focus() must not open the panel when disabled').toBe(false);
  });

  it('should forward FocusOptions to the input', async () => {
    // Arrange: Create component and spy on the native focus of its input.
    const fixture = await driver.arrange();
    const focusSpy = fixture.trackInputFocus();

    // Act: Focus with explicit options.
    await fixture.focus({ preventScroll: true });

    // Assert: The contract's options reach the native call unchanged.
    expect(focusSpy, 'focus() should pass the given options through to the input').toHaveBeenCalledWith({ preventScroll: true });
  });
}
