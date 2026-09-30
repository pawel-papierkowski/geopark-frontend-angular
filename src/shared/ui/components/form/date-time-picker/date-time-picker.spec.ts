import { ComponentFixture, TestBed } from '@angular/core/testing';

import { enDateTimePickerMode } from '@/shared/ui/other/types';

import { DateTimePicker } from './date-time-picker';

/**
 * Unit tests of date-time-picker component.
 * Note: DateTimePicker wraps DatePicker and TimePicker subcomponents, so tests cover their
 * presence, interactions between them and label activation (the hidden label target must
 * redirect focus into a sub-picker input instead of the non-focusable wrapper).
 * TODO: DatePicker sub-picker is still a placeholder.
 */
describe('DateTimePicker', () => {
  /** Options used to arrange a DateTimePicker instance under test. */
  interface DateTimePickerTestOptions {
    /** Identifier of the picker (used for ids and label association). */
    ident?: string;
    /** Mode of operation. */
    mode?: enDateTimePickerMode;
    /** Whether the picker is disabled. */
    disabled?: boolean;
  }

  /**
   * Create and configure a DateTimePicker component under test.
   * @param opts Options controlling initial inputs.
   * @returns Fixture of the created component with initial change detection applied.
   */
  async function arrangeDateTimePicker(opts: DateTimePickerTestOptions = {}): Promise<ComponentFixture<DateTimePicker>> {
    const { ident = 'test-dtp', mode = 'time', disabled = false } = opts;

    await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();

    const fixture = TestBed.createComponent(DateTimePicker);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Get the hidden label target button of given fixture.
   * @param fixture Fixture of the component.
   * @returns Hidden button that `<label for>` points at.
   */
  function getHiddenButton(fixture: ComponentFixture<DateTimePicker>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button.hidden-label-button');
  }

  /**
   * Get the time input of the wrapped time-picker (ident is derived as `timeId_<ident>`).
   * @param fixture Fixture of the component.
   * @returns Input element of the time sub-picker.
   */
  function getTimeInput(fixture: ComponentFixture<DateTimePicker>): HTMLInputElement {
    return fixture.nativeElement.querySelector(`[data-testid="timeId_${fixture.componentInstance.resolvedIdent()}_input"]`);
  }

  /**
   * Get the hour listbox column of the wrapped time-picker (first of the two clock columns).
   * @param fixture Fixture of the component.
   * @returns Hour listbox element.
   */
  function getHourColumn(fixture: ComponentFixture<DateTimePicker>): HTMLElement {
    return fixture.nativeElement.querySelector('.clock-column');
  }

  /**
   * Flush pending component work: panel opening awaits `forRender` internally, so
   * interaction tests need stability flushes before asserting focus and panel state.
   * @param fixture Fixture of the component.
   */
  async function flush(fixture: ComponentFixture<DateTimePicker>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('general', () => {
    describe('outputs', () => {
      it('should forward touch output from time-picker', async () => {
        // Arrange: Render wrapper in time mode and spy on its touch output.
        await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();
        const fixture = TestBed.createComponent(DateTimePicker);
        fixture.componentRef.setInput('ident', 'test-dtp');
        fixture.componentRef.setInput('mode', 'time');
        fixture.detectChanges();
        await fixture.whenStable();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const timeInput = fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_input"]');
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Simulate focus leaving the inner time-picker (bubbles to its focusout handler).
          timeInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
          fixture.detectChanges();

          // Assert: Wrapper reports touch so Signal Forms receive the blur.
          expect(touchSpy, 'touch should be forwarded from time-picker to wrapper').toHaveBeenCalledTimes(1);
        } finally { // cleanup
          outside.remove();
        }
      });
    });

    describe('ident', () => {
      it('should generate id following date-time-picker-N pattern when ident is empty', async () => {
        // Arrange: Render wrapper without ident (empty ident input).
        await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();
        const fixture = TestBed.createComponent(DateTimePicker);
        fixture.componentRef.setInput('mode', 'time');
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: Hidden button gets generated id, sub-picker derives its ident from it.
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        const ident = hiddenButton.getAttribute('id');
        expect(ident, 'hidden button id should follow date-time-picker-N pattern').toMatch(/^date-time-picker-\d+$/);
        const timeInput = fixture.nativeElement.querySelector(`[data-testid="timeId_${ident}_input"]`);
        expect(timeInput, 'time-picker should derive ident from generated parent ident').not.toBeNull();
      });

      it('should derive sub-picker idents from provided ident', async () => {
        // Arrange: Render wrapper with explicit ident.
        await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();
        const fixture = TestBed.createComponent(DateTimePicker);
        fixture.componentRef.setInput('ident', 'test-dtp');
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: Sub-picker idents are derived from the provided ident.
        expect(fixture.componentInstance.dateIdent(), 'dateIdent should be dateId_test-dtp').toBe('dateId_test-dtp');
        expect(fixture.componentInstance.timeIdent(), 'timeIdent should be timeId_test-dtp').toBe('timeId_test-dtp');
        expect(fixture.componentInstance.resolvedIdent(), 'resolvedIdent should mirror ident').toBe('test-dtp');
      });
    });
  });

  describe('label', () => {
    /**
     * Dispatch a real mousedown on given label so it bubbles to the document.
     * @param label Label element to dispatch the event on.
     * @returns The dispatched event, for defaultPrevented assertions.
     */
    function dispatchMousedown(label: HTMLElement): Event {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      label.dispatchEvent(event);
      return event;
    }

    it('should open clock panel and move focus into hour listbox when hidden button (label target) is clicked', async () => {
      // Arrange: Render wrapper in time mode with closed panel.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const timeInput = getTimeInput(fixture);
      expect(timeInput.getAttribute('aria-expanded'), 'panel should start closed').toBe('false');

      // Act: Click hidden button; label activation forwards the click here.
      getHiddenButton(fixture).click();
      await flush(fixture);

      // Assert: Panel is open on the time input and keyboard focus sits in its hour listbox -
      // the same end state as clicking the input directly.
      expect(timeInput.getAttribute('aria-expanded'), 'label-target click should open the clock panel').toBe('true');
      expect(document.activeElement, 'focus should move into the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should redirect focus from hidden button into sub-picker when it receives focus directly', async () => {
      // Arrange: Render wrapper in time mode with closed panel.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const hiddenButton = getHiddenButton(fixture);

      // Act: Focus hidden button programmatically (as label activation does before clicking it).
      hiddenButton.focus();
      await flush(fixture);

      // Assert: Focus left the hidden button and the panel opened through the input focus handler.
      expect(document.activeElement, 'focus should leave the hidden button').not.toBe(hiddenButton);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'redirected focus should open the clock panel').toBe('true');
      expect(document.activeElement, 'focus should end in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should keep clock panel open and not emit touch when focus moves to hidden button', async () => {
      // Arrange: Open the clock panel via first label activation and spy on touch output.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getHiddenButton(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before act').toBe('true');

      // Act: Simulate label activation moving focus from inside the time-picker to the hidden
      // button (bubbles to the time-picker's focusout handler, like a real focus move does).
      getTimeInput(fixture).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: getHiddenButton(fixture) }));
      fixture.detectChanges();

      // Assert: The hidden button is the host component's label relay - still "inside" the
      // component, so it must neither close the panel nor report the control as touched.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus move to hidden button should keep panel open').toBe('true');
      expect(touchSpy, 'focus move to hidden button should not emit touch').not.toHaveBeenCalled();
    });

    it('should close clock panel and keep focus on time input on second label activation', async () => {
      // Arrange: Open the clock panel through the first label activation.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getHiddenButton(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before second activation').toBe('true');

      // Act: Second label activation - the browser focuses the hidden button, then forwards click.
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);

      // Assert: Second activation toggles closed; focus never left the component, so no touch.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'second label activation should close the panel').toBe('false');
      expect(document.activeElement, 'focus should end on the time input').toBe(getTimeInput(fixture));
      expect(touchSpy, 'second label activation should not emit touch').not.toHaveBeenCalled();
    });

    it('should reopen clock panel on third label activation', async () => {
      // Arrange: Open then close the panel through two label activations.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.click();
      await flush(fixture);
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be closed before third activation').toBe('false');

      // Act: Third label activation.
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);

      // Assert: Activation toggles back open with keyboard focus in the hour listbox.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'third label activation should reopen the panel').toBe('true');
      expect(document.activeElement, 'focus should end in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should not redirect focus or open panel when disabled', async () => {
      // Arrange: Render wrapper in time mode and disabled.
      const fixture = await arrangeDateTimePicker({ mode: 'time', disabled: true });

      // Act: Click hidden button (label activation target).
      getHiddenButton(fixture).click();
      await flush(fixture);

      // Assert: Panel stays closed and focus is not pulled into the sub-picker.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'disabled picker should keep panel closed').toBe('false');
      expect(document.activeElement, 'disabled picker should not take focus via label target').not.toBe(getTimeInput(fixture));
      expect(document.activeElement, 'disabled picker should not focus hour listbox').not.toBe(getHourColumn(fixture));
    });

    it('should prevent default on mousedown of associated label', async () => {
      // Arrange: Create component and a label targeting its hidden button.
      await arrangeDateTimePicker();
      const label = document.createElement('label');
      label.htmlFor = 'test-dtp';
      document.body.appendChild(label);

      try {
        // Act: Dispatch mousedown as a real pointer interaction would.
        const event = dispatchMousedown(label);

        // Assert: Default canceled, so focus is not stolen from the sub-picker input.
        expect(event.defaultPrevented, 'mousedown on associated label should be default-prevented').toBe(true);
      } finally { // cleanup
        label.remove();
      }
    });

    it('should not prevent default on mousedown of foreign label', async () => {
      // Arrange: Create component and a label targeting an unrelated control.
      await arrangeDateTimePicker();
      const label = document.createElement('label');
      label.htmlFor = 'other-control';
      document.body.appendChild(label);

      try {
        // Act: Dispatch mousedown on the foreign label.
        const event = dispatchMousedown(label);

        // Assert: Default untouched, unrelated labels keep native behavior.
        expect(event.defaultPrevented, 'mousedown on foreign label should keep its default').toBe(false);
      } finally { // cleanup
        label.remove();
      }
    });

    it('should not prevent default on label mousedown after component is destroyed', async () => {
      // Arrange: Create component, then destroy it (removes the document listener).
      const fixture = await arrangeDateTimePicker();
      const label = document.createElement('label');
      label.htmlFor = 'test-dtp';
      document.body.appendChild(label);
      fixture.destroy();

      try {
        // Act: Dispatch mousedown after destroy.
        const event = dispatchMousedown(label);

        // Assert: Listener was cleaned up with the component.
        expect(event.defaultPrevented, 'destroyed component should not prevent label mousedown').toBe(false);
      } finally { // cleanup
        label.remove();
      }
    });

    it('should not prevent default on mousedown when ident is empty', async () => {
      // Arrange: Create component without ident (its generated ident never matches labels without for).
      await arrangeDateTimePicker({ ident: '' });
      const label = document.createElement('label');
      document.body.appendChild(label);

      try {
        // Act: Dispatch mousedown on a label without for attribute.
        const event = dispatchMousedown(label);

        // Assert: Generated ident never matches empty htmlFor, defaults preserved.
        expect(event.defaultPrevented, 'generated ident should not match label without for').toBe(false);
      } finally { // cleanup
        label.remove();
      }
    });
  });

  describe('outside press', () => {
    /**
     * Dispatch a real bubbling mousedown on given target so it reaches the component's
     * document-level listener, mimicking a pointer press anywhere on the page.
     * @param target Element the press lands on.
     * @returns The dispatched event, for defaultPrevented assertions.
     */
    function dispatchMousedown(target: Element): Event {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    }

    /**
     * Open the clock panel through a direct click on the time input.
     * @param fixture Fixture of the wrapper under test.
     */
    async function openClockPanel(fixture: ComponentFixture<DateTimePicker>): Promise<void> {
      getTimeInput(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before act').toBe('true');
    }

    it('should close clock panel when mousedown lands outside the wrapper', async () => {
      // Arrange: Open the panel and create a button outside the component.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      await openClockPanel(fixture);
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      try {
        // Act: Press outside the wrapper - focusout-only close misses this on WebKit,
        // where an outside press does not necessarily move focus.
        dispatchMousedown(outside);
        await flush(fixture);

        // Assert: Panel closed by the press itself. Touch is NOT reported here: it is
        // emitted by the focusout that follows the panel losing focus, so emitting it
        // in the press handler would double-report on engines that do blur.
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'outside mousedown should close the clock panel').toBe('false');
        expect(touchSpy, 'outside mousedown itself should not emit touch (focusout reports it)').not.toHaveBeenCalled();
      } finally { // cleanup
        outside.remove();
      }
    });

    it('should close clock panel when mousedown lands on a foreign label', async () => {
      // Arrange: Open the panel and create a label pointing at an unrelated control.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      await openClockPanel(fixture);
      const label = document.createElement('label');
      label.htmlFor = 'other-control';
      document.body.appendChild(label);

      try {
        // Act: Press the foreign label - only the OWN associated label is exempt.
        dispatchMousedown(label);
        await flush(fixture);

        // Assert: Panel closed like any other outside target.
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'foreign label mousedown should close the clock panel').toBe('false');
      } finally { // cleanup
        label.remove();
      }
    });

    it('should keep clock panel open when mousedown lands inside the wrapper', async () => {
      // Arrange: Open the panel; both the input and the panel chrome are valid inside targets.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      await openClockPanel(fixture);

      // Act: Press the time input (its own mousedown handler runs as well).
      dispatchMousedown(getTimeInput(fixture));
      await flush(fixture);

      // Assert: Input press must not close - it toggles through the subsequent click.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'mousedown on the time input should keep the panel open').toBe('true');

      // Act: Press the clock panel chrome (padding/border area).
      dispatchMousedown(fixture.nativeElement.querySelector('.clock-container'));
      await flush(fixture);

      // Assert: Panel chrome is inside the wrapper, so the press must not close either.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'mousedown on the panel chrome should keep the panel open').toBe('true');
    });

    it('should keep clock panel open when mousedown lands on the associated label', async () => {
      // Arrange: Open the panel and create the label pointing at this wrapper's hidden button.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      await openClockPanel(fixture);
      const label = document.createElement('label');
      label.htmlFor = 'test-dtp';
      document.body.appendChild(label);

      try {
        // Act: Press the associated label - closing here would make the following label
        // activation see a closed panel and reopen it, breaking the toggle contract.
        const event = dispatchMousedown(label);
        await flush(fixture);

        // Assert: Panel stays open (label click handler owns the toggle) and the default
        // stays canceled (existing focus-steal guard).
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'own label mousedown should keep the panel open for the label toggle').toBe('true');
        expect(event.defaultPrevented, 'own label mousedown should stay default-prevented').toBe(true);
      } finally { // cleanup
        label.remove();
      }
    });

    it('should not close clock panel via document mousedown after component is destroyed', async () => {
      // Arrange: Open the panel, then destroy the component (removes the document listener).
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      await openClockPanel(fixture);
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
  });
});
