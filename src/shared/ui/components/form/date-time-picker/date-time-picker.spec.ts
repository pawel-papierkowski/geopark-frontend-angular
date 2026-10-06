import { ComponentFixture, TestBed } from '@angular/core/testing';

import { enDateTimePickerMode } from '@/shared/ui/other/types';
import { registerLabelPreventionTests } from '@/shared/ui/components/form/popup-panel/testing/label-guard-tests';

import { DateTimePicker } from './date-time-picker';

/**
 * Unit tests of date-time-picker component.
 * Note: DateTimePicker wraps DatePicker and TimePicker subcomponents, so tests cover their
 * presence, interactions between them and label activation (the hidden label target must
 * redirect focus into a sub-picker input instead of the non-focusable wrapper).
 */
describe('DateTimePicker', () => {
  /** Options used to arrange a DateTimePicker instance under test. */
  interface DateTimePickerTestOptions {
    /** Identifier of the picker (used for ids and label association). */
    ident?: string;
    /** Id of the external `<label>` element forwarded to the sub-pickers. */
    label?: string;
    /** Whether an element with the given `label` id is created (false leaves the reference
     * dangling, for the dev-mode warning tests). */
    resolveLabel?: boolean;
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
    const { ident = 'test-dtp', label = '', resolveLabel = true, mode = 'time', disabled = false } = opts;

    await TestBed.configureTestingModule({ imports: [DateTimePicker] }).compileComponents();

    const fixture = TestBed.createComponent(DateTimePicker);

    // Give the label reference a real target before the first change detection (the sub-pickers'
    // dev-only effects check it there), unless a test deliberately leaves it dangling.
    // Removed together with the fixture so ids never leak into the next test.
    if (label !== '' && resolveLabel) {
      const labelElement = document.createElement('label');
      labelElement.id = label;
      document.body.appendChild(labelElement);
      fixture.componentRef.onDestroy(() => labelElement.remove());
    }

    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
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
   * Get the date input of the wrapped date-picker (ident is derived as `dateId_<ident>`).
   * @param fixture Fixture of the component.
   * @returns Input element of the date sub-picker.
   */
  function getDateInput(fixture: ComponentFixture<DateTimePicker>): HTMLInputElement {
    return fixture.nativeElement.querySelector(`[data-testid="dateId_${fixture.componentInstance.resolvedIdent()}_input"]`);
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
   * Get the calendar grid of the wrapped date-picker (the focus target of the open path).
   * Day cells are not focusable (the grid announces its cursor via aria-activedescendant),
   * so DOM focus lands on the grid container itself.
   * @param fixture Fixture of the component.
   * @returns Grid element of the date sub-picker.
   */
  function getCalendarGrid(fixture: ComponentFixture<DateTimePicker>): HTMLElement {
    return fixture.nativeElement.querySelector('.calendar-grid');
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

  /**
   * Run the given body with the system clock pinned to a fixed instant (Date only - timers stay
   * real, so Angular's stability flushes are unaffected). Needed wherever the date seeded into a
   * committed value must not depend on when the suite runs.
   * @param instant The instant `new Date()` should report during `run`.
   * @param run Body executed under the mocked clock; real timers are restored afterwards.
   * @returns Whatever `run` resolves to.
   */
  async function withMockedNow<T>(instant: Date, run: () => Promise<T>): Promise<T> {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instant);
    try {
      return await run();
    } finally {
      vi.useRealTimers();
    }
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

    it('should keep clock panel closed when the forwarded click runs before the hidden button focus', async () => {
      // Arrange: Open the clock panel through the first label activation.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getHiddenButton(fixture).click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be open before second activation').toBe('true');

      // Act: Engines disagree on label activation order - WebKit forwards the click FIRST
      // (the click closes the panel) and only then focuses the hidden button, both within the
      // same task. The focus that follows must not read the just-closed panel as a fresh
      // (focus-only) activation.
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.click();
      hiddenButton.focus();
      await flush(fixture);

      // Assert: Panel stays closed with focus parked on the input; internal focus moves report no touch.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus after the closing click must not reopen the panel').toBe('false');
      expect(document.activeElement, 'focus should end on the time input').toBe(getTimeInput(fixture));
      expect(touchSpy, 'click-then-focus activation should not emit touch').not.toHaveBeenCalled();
    });

    it('should open clock panel on click-first label activation when input already holds focus', async () => {
      // Arrange: Close the panel so focus parks on the input (state left behind by a previous close).
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const hiddenButton = getHiddenButton(fixture);
      hiddenButton.click();
      await flush(fixture);
      hiddenButton.focus();
      hiddenButton.click();
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'panel should be closed before act').toBe('false');
      expect(document.activeElement, 'focus should be parked on the input before act').toBe(getTimeInput(fixture));

      // Act: Click-first activation while the input already has focus (both events in the same
      // task, like a real WebKit label activation) - the click's focus redirect is a no-op
      // (input already focused), so opening must not depend on a focus event.
      hiddenButton.click();
      hiddenButton.focus();
      await flush(fixture);

      // Assert: Panel opens and keyboard focus ends in the hour listbox.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'click-first activation should open the panel').toBe('true');
      expect(document.activeElement, 'focus should end in the hour listbox').toBe(getHourColumn(fixture));
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

    // datetime mode: BOTH sub-pickers are rendered, so handleLabelFocus's `wasClosed` evaluates
    // two terms (the single-mode tests above only ever exercise one). Every activation below
    // presses the associated label first, because the wrapper's document mousedown handler is
    // what resets focusOpened/labelClickDecision - the same fresh state a real pointer press
    // produces. Skipping it leaves a stale `labelClickDecision`, which routes the focus handler
    // down a different branch and hides the state computation under test.

    /**
     * Create a `<label>` whose `for` points at the fixture's hidden label target, removed
     * together with the fixture. Real label activations press THIS element (the document
     * handler recognizes it as the wrapper's own label and resets the activation markers
     * instead of treating the press as an outside close).
     * @param fixture Fixture of the wrapper under test.
     * @returns The associated label element.
     */
    function appendAssociatedLabel(fixture: ComponentFixture<DateTimePicker>): HTMLLabelElement {
      const label = document.createElement('label');
      label.htmlFor = fixture.componentInstance.resolvedIdent();
      document.body.appendChild(label);
      fixture.componentRef.onDestroy(() => label.remove());
      return label;
    }

    /**
     * Simulate one full label activation the way focus-first engines (Chromium/Firefox)
     * perform it: mousedown on the label, focus of its hidden target, then the forwarded click.
     * @param label The wrapper's associated label.
     * @param hiddenButton The label's hidden target button.
     */
    function activateFocusFirst(label: HTMLLabelElement, hiddenButton: HTMLButtonElement): void {
      dispatchMousedown(label);
      hiddenButton.focus();
      hiddenButton.click();
    }

    /**
     * Simulate one full label activation the way click-first engines (WebKit) perform it:
     * mousedown on the label, the forwarded click, then the focus of its hidden target.
     * @param label The wrapper's associated label.
     * @param hiddenButton The label's hidden target button.
     */
    function activateClickFirst(label: HTMLLabelElement, hiddenButton: HTMLButtonElement): void {
      dispatchMousedown(label);
      hiddenButton.click();
      hiddenButton.focus();
    }

    it('should swallow the forwarded click and keep the calendar open on first label activation in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with closed panels and an associated label.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);

      // Act: One full focus-first activation (the open half of the pair).
      activateFocusFirst(label, getHiddenButton(fixture));
      await flush(fixture);
      await flush(fixture);

      // Assert: The focus redirect opened the calendar and the paired click was swallowed -
      // a single activation must not toggle the panel shut again (closed -> open, exactly once).
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'first activation should leave the calendar open').toBe('true');
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'the clock must stay closed in datetime mode').toBe('false');
      expect(document.activeElement, 'focus should end in the calendar grid').toBe(getCalendarGrid(fixture));
    });

    it('should close the calendar on second focus-first label activation in datetime mode', async () => {
      // Arrange: Open the calendar through the first full activation.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const hiddenButton = getHiddenButton(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      activateFocusFirst(label, hiddenButton);
      await flush(fixture);
      await flush(fixture);
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before second activation').toBe('true');

      // Act: Second focus-first activation - the wrapper must see the OPEN calendar (neither
      // panel closed is false) and therefore not arm the click swallow, so the forwarded click
      // toggles the panel shut.
      activateFocusFirst(label, hiddenButton);
      await flush(fixture);

      // Assert: The calendar closed and focus parked on the date input; internal focus moves
      // (grid -> hidden target -> input) never leave the component, so no touch is reported.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'second focus-first activation should close the calendar').toBe('false');
      expect(document.activeElement, 'focus should end on the date input').toBe(getDateInput(fixture));
      expect(touchSpy, 'label toggle should not emit touch').not.toHaveBeenCalled();
    });

    it('should close both panels when a focus-first label activation starts with the clock open in datetime mode', async () => {
      // Arrange: datetime mode with the clock panel open (focus inside its hour listbox).
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      getTimeInput(fixture).click();
      await flush(fixture);
      await flush(fixture);
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock panel should be open before act').toBe('true');

      // Act: Full focus-first activation. The redirect targets the date input (date leads),
      // whose arrival closes the clock (wrapper focusin) and opens the calendar; the forwarded
      // click must toggle that freshly opened calendar shut instead of being swallowed.
      activateFocusFirst(label, getHiddenButton(fixture));
      await flush(fixture);
      await flush(fixture);

      // Assert: Clock-open -> activation ends with BOTH panels closed, never with the calendar
      // left standing after an invisible switch from the clock.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar must not survive a clock-open activation').toBe('false');
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should be closed by the focus redirect').toBe('false');
      expect(touchSpy, 'label toggle should not emit touch').not.toHaveBeenCalled();
    });

    it('should keep the calendar closed on second click-first label activation in datetime mode', async () => {
      // Arrange: Open the calendar through the first activation.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const label = appendAssociatedLabel(fixture);
      const hiddenButton = getHiddenButton(fixture);
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      activateFocusFirst(label, hiddenButton);
      await flush(fixture);
      await flush(fixture);
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before second activation').toBe('true');

      // Act: Engines disagree on label activation order - WebKit forwards the click FIRST (the
      // click closes the calendar) and only then focuses the hidden button, both within the
      // same task. The focus that follows must restore focus on the input without reopening.
      activateClickFirst(label, hiddenButton);
      await flush(fixture);

      // Assert: Panel stays closed with focus parked on the input; no touch is reported.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'click-first activation should close the calendar').toBe('false');
      expect(document.activeElement, 'focus should end on the date input').toBe(getDateInput(fixture));
      expect(touchSpy, 'click-first label toggle should not emit touch').not.toHaveBeenCalled();
    });

    registerLabelPreventionTests({
      ident: 'test-dtp',
      arrange: async (ident) => {
        const fixture = await arrangeDateTimePicker(ident === undefined ? {} : { ident });
        return { destroy: () => fixture.destroy() };
      },
    });
  });

  describe('aria', () => {
    it('should name both sub-inputs with the label plus distinct qualifiers in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime', label: 'my-label' });

      // Assert: Each input is labelled by the same label AND its own qualifier, so the two
      // accessible names differ while the visible label text stays a prefix of both.
      const dateName = getDateInput(fixture).getAttribute('aria-labelledby');
      const timeName = getTimeInput(fixture).getAttribute('aria-labelledby');
      expect(dateName, 'date input should be labelled by label + date qualifier').toBe('my-label dateId_test-dtp_qualifier');
      expect(timeName, 'time input should be labelled by label + time qualifier').toBe('my-label timeId_test-dtp_qualifier');
      expect(dateName, 'the two inputs must not share the same accessible name').not.toBe(timeName);
      expect(getDateInput(fixture).hasAttribute('aria-label'), 'labelled date input must not carry aria-label').toBe(false);
      expect(getTimeInput(fixture).hasAttribute('aria-label'), 'labelled time input must not carry aria-label').toBe(false);
    });

    it('should render both qualifier elements with distinct ids in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime', label: 'my-label' });

      // Assert: Both hidden qualifiers exist and their ids match the aria-labelledby references.
      const dateQualifier = fixture.nativeElement.querySelector('#dateId_test-dtp_qualifier');
      const timeQualifier = fixture.nativeElement.querySelector('#timeId_test-dtp_qualifier');
      expect(dateQualifier, 'date qualifier should be rendered').not.toBeNull();
      expect(timeQualifier, 'time qualifier should be rendered').not.toBeNull();
      expect(dateQualifier?.textContent?.trim(), 'date qualifier should carry the date key').toBe('dateTimePicker.date');
      expect(timeQualifier?.textContent?.trim(), 'time qualifier should carry the time key').toBe('dateTimePicker.time');
    });

    it('should label the single date input without a qualifier in date mode', async () => {
      // Arrange: Render wrapper in date-only mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'date', label: 'my-label' });

      // Assert: Only the date input exists; its name is the plain label (no qualifier needed).
      expect(getDateInput(fixture).getAttribute('aria-labelledby'), 'date input should be labelled by the label alone').toBe('my-label');
      expect(fixture.nativeElement.querySelector('[id="dateId_test-dtp_qualifier"]'), 'qualifier must not render in date mode').toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_input"]'), 'time input must not render in date mode').toBeNull();
    });

    it('should label the single time input without a qualifier in time mode', async () => {
      // Arrange: Render wrapper in time-only mode with an external label id.
      const fixture = await arrangeDateTimePicker({ mode: 'time', label: 'my-label' });

      // Assert: Only the time input exists; its name is the plain label (no qualifier needed).
      expect(getTimeInput(fixture).getAttribute('aria-labelledby'), 'time input should be labelled by the label alone').toBe('my-label');
      expect(fixture.nativeElement.querySelector('[id="timeId_test-dtp_qualifier"]'), 'qualifier must not render in time mode').toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="dateId_test-dtp_input"]'), 'date input must not render in time mode').toBeNull();
    });

    it('should fall back to distinct aria-labels in datetime mode when no label is given', async () => {
      // Arrange: Render wrapper in datetime mode without a label.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });

      // Assert: Fallback names are already distinct per sub-field; no dangling aria-labelledby.
      expect(getDateInput(fixture).hasAttribute('aria-labelledby'), 'date input must not carry aria-labelledby without label').toBe(false);
      expect(getTimeInput(fixture).hasAttribute('aria-labelledby'), 'time input must not carry aria-labelledby without label').toBe(false);
      expect(getDateInput(fixture).getAttribute('aria-label'), 'date input should fall back to its date key').toBe('dateTimePicker.date');
      expect(getTimeInput(fixture).getAttribute('aria-label'), 'time input should fall back to its time key').toBe('dateTimePicker.time');
      expect(fixture.nativeElement.querySelector('.picker-name-qualifier'), 'no qualifier should render without label').toBeNull();
    });

    it('should warn from both sub-pickers when the forwarded label id matches no element', async () => {
      // Arrange: Spy on console.warn; datetime mode renders both sub-pickers and the label
      // reference is deliberately left dangling.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Act: Create the wrapper - each sub-picker checks the forwarded reference on first CD.
        await arrangeDateTimePicker({ mode: 'datetime', label: 'ghost-label', resolveLabel: false });

        // Assert: Both sub-pickers reported the dangling id, each naming its own input.
        const messages = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
        expect(messages, 'date sub-picker should report the dangling id').toContain('(ident "dateId_test-dtp")');
        expect(messages, 'time sub-picker should report the dangling id').toContain('(ident "timeId_test-dtp")');
        expect(messages, 'warning should name the dangling id').toContain('ghost-label');
      } finally { // cleanup
        warnSpy.mockRestore();
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

    it('should keep the value when an outside press closes the clock panel with a pending pick', async () => {
      // Arrange: Wrapper carrying a value, clock panel open and hour 9 picked - the pick stays
      // pending until the minute column is picked too.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const value = new Date(Date.UTC(2026, 0, 15, 14, 30));
      fixture.componentRef.setInput('value', value);
      await flush(fixture);
      await openClockPanel(fixture);
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      try {
        // Act: Pick hour 9 (partial selection), then press outside the wrapper.
        fixture.nativeElement.querySelector('[data-testid="timeId_test-dtp_h9"]').click();
        await flush(fixture);
        expect(fixture.componentInstance.value(), 'pending hour pick must not change the value').toBe(value);
        dispatchMousedown(outside);
        await flush(fixture);

        // Assert: The press closes the panel WITHOUT committing the pending pick - the value
        // is the very same instance, so no form update happened on the way out.
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'outside mousedown should close the clock panel').toBe('false');
        expect(fixture.componentInstance.value(), 'outside press must discard the pending pick').toBe(value);
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

  describe('time-first value seeding', () => {
    it('should put a time picked before any date on the local calendar date in datetime mode', async () => {
      // Arrange: Clock pinned to 15 January 2026, 00:30 Warsaw time - the UTC date is still
      // 14 January, but the calendar's `today` marker reads the LOCAL date (15 January), so
      // the date input must agree with it after a time is picked with no prior value.
      const fixture = await withMockedNow(new Date('2026-01-15T00:30:00+01:00'), async () => {
        const created = await arrangeDateTimePicker({ mode: 'datetime' });

        // Act: Open the clock through its input (two open rounds, as on every open path) and
        // complete a pick - hour first, then the minute, which commits the value.
        getTimeInput(created).click();
        await flush(created);
        await flush(created);
        created.nativeElement.querySelector('[data-testid="timeId_test-dtp_h14"]').click();
        created.detectChanges();
        created.nativeElement.querySelector('[data-testid="timeId_test-dtp_m45"]').click();
        created.detectChanges();
        return created;
      });

      // Assert: Value, time input and date input all describe the same moment - the picked
      // time on the user's today, never on the already-passed UTC date.
      expect(fixture.componentInstance.value()?.getUTCDate(), 'value day should match the local calendar date').toBe(15);
      expect(getTimeInput(fixture).value, 'time input should show the picked time').toBe('14:45');
      expect(getDateInput(fixture).value, 'date input should show the local calendar date').toBe('2026-01-15');
    });
  });

  describe('focus', () => {
    it('should focus the date input and open the calendar panel in datetime mode', async () => {
      // Arrange: Render wrapper in datetime mode - both sub-pickers are present and the date
      // one leads, so focus() must delegate to its (enabled) input. focus() is the
      // FormUiControl.focus contract used by the signal-forms Field directive.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });

      // Act: Focus the control programmatically (two flush rounds for the two-round open).
      fixture.componentInstance.focus();
      await flush(fixture);
      await flush(fixture);

      // Assert: The date input took focus, its focus handler opened the calendar panel, and
      // keyboard focus continued into the calendar grid so arrow navigation works right away.
      expect(getDateInput(fixture).getAttribute('aria-expanded'), 'focus() should open the calendar panel').toBe('true');
      expect(document.activeElement, 'focus() should end with keyboard focus in the date sub-picker calendar grid').toBe(getCalendarGrid(fixture));
      expect(getCalendarGrid(fixture).getAttribute('aria-activedescendant'), 'grid should announce the seeded keyboard cursor').not.toBeNull();
    });

    it('should focus the time input and open the clock panel in time mode', async () => {
      // Arrange: Render wrapper in time mode with closed panel; focus() is the
      // FormUiControl.focus contract used by the signal-forms Field directive.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });

      // Act: Focus the control programmatically. The open spans two forRender rounds, so
      // a single flush cannot cover it yet (mirrors the sub-picker's focus-open tests).
      fixture.componentInstance.focus();
      await flush(fixture);
      await flush(fixture);

      // Assert: Delegation mirrors label activation - focus lands in the time sub-picker,
      // its focus handler opens the panel, and focus continues into the hour listbox.
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus() should open the clock panel').toBe('true');
      expect(document.activeElement, 'focus() should end with keyboard focus in the hour listbox').toBe(getHourColumn(fixture));
    });

    it('should be a no-op when disabled', async () => {
      // Arrange: Disabled wrapper (forwarded to the sub-pickers).
      const fixture = await arrangeDateTimePicker({ mode: 'time', disabled: true });

      // Act: Focus the disabled control.
      fixture.componentInstance.focus();
      await flush(fixture);

      // Assert: Neither the input nor the panel reacts.
      expect(document.activeElement, 'focus() must not focus a disabled control').not.toBe(getTimeInput(fixture));
      expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'focus() must not open the panel when disabled').toBe('false');
    });

    it('should focus the date input exactly once, forwarding the given options', async () => {
      // Arrange: datetime mode - the date sub-picker leads, so it receives the contract's
      // options. A first bare probe focus would scroll the page (defeating preventScroll)
      // and leave a second, options-carrying call a no-op on the already-focused input.
      const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
      const focusSpy = vi.spyOn(getDateInput(fixture), 'focus');

      // Act: Invoke the FormUiControl.focus contract with preventScroll, then settle the
      // panel open the focus handler started.
      fixture.componentInstance.focus({ preventScroll: true });
      await flush(fixture);
      await flush(fixture);

      // Assert: Exactly one focus call, and it carries the caller's options.
      expect(focusSpy, 'focus() must focus the date input in a single call').toHaveBeenCalledTimes(1);
      expect(focusSpy, 'focus() should pass the given options through to the date input').toHaveBeenCalledWith({ preventScroll: true });
    });

    it('should focus the time input exactly once, forwarding the given options', async () => {
      // Arrange: time mode - only the time sub-picker is rendered, so it owns the delegation.
      const fixture = await arrangeDateTimePicker({ mode: 'time' });
      const focusSpy = vi.spyOn(getTimeInput(fixture), 'focus');

      // Act: Invoke the FormUiControl.focus contract with preventScroll, then settle the
      // panel open the focus handler started.
      fixture.componentInstance.focus({ preventScroll: true });
      await flush(fixture);
      await flush(fixture);

      // Assert: Exactly one focus call, and it carries the caller's options.
      expect(focusSpy, 'focus() must focus the time input in a single call').toHaveBeenCalledTimes(1);
      expect(focusSpy, 'focus() should pass the given options through to the time input').toHaveBeenCalledWith({ preventScroll: true });
    });

    // Both sub-pickers live inside ONE wrapper root in datetime mode, so moving focus between
    // them never leaves the component the `touch` output talks about. The sub-pickers decide
    // that with their focusout containment, which used to be "own root + label target" only -
    // the sibling sub-picker was neither, so a Tab (or a Shift+Tab back out of the clock)
    // reported a spurious blur mid-interaction.
    describe('focus containment between sub-pickers', () => {
      it('should not emit touch when focus moves from the date input to the time input of the same wrapper', async () => {
        // Arrange: datetime mode (both sub-pickers present), calendar open with keyboard focus
        // in its grid, spy on the wrapper's touch output.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        fixture.componentInstance.focus();
        await flush(fixture);
        await flush(fixture);
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should be open before the act').toBe('true');

        // Act: Tab-equivalent - focus the sibling time input directly.
        getTimeInput(fixture).focus();
        await flush(fixture);
        await flush(fixture);

        // Assert: Staying inside the wrapper is not a blur, but the wrapper still closes the
        // opposite panel (its focusin handler) and the arrival opens the clock.
        expect(touchSpy, 'focus move between sub-picker inputs of one wrapper must not report touch').not.toHaveBeenCalled();
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should close when focus moves to the time input').toBe('false');
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should open when focus arrives at the time input').toBe('true');
        expect(document.activeElement, 'focus should continue into the hour listbox').toBe(getHourColumn(fixture));
      });

      it('should not emit touch when focus moves from the clock back to the date input of the same wrapper', async () => {
        // Arrange: datetime mode with the clock open (keyboard sits in the hour listbox), spy
        // on the wrapper's touch output. This is the Shift+Tab-out-of-the-clock target.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        getTimeInput(fixture).focus();
        await flush(fixture);
        await flush(fixture);
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should be open before the act').toBe('true');
        expect(document.activeElement, 'keyboard should sit in the hour listbox before the act').toBe(getHourColumn(fixture));

        // Act: Shift+Tab-equivalent - focus the sibling date input directly.
        getDateInput(fixture).focus();
        await flush(fixture);
        await flush(fixture);

        // Assert: The hand-off back into the same wrapper must not report touch, while the
        // wrapper still closes the clock and the arrival auto-opens the calendar.
        expect(touchSpy, 'Shift+Tab back into the date sub-picker of one wrapper must not report touch').not.toHaveBeenCalled();
        expect(getTimeInput(fixture).getAttribute('aria-expanded'), 'clock should close when focus moves to the date input').toBe('false');
        expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should auto-open when focus arrives at the date input').toBe('true');
        expect(document.activeElement, 'focus should continue into the calendar grid').toBe(getCalendarGrid(fixture));
      });

      it('should emit touch when focus leaves the wrapper entirely', async () => {
        // Arrange: datetime mode with the calendar open, plus an element outside the wrapper.
        const fixture = await arrangeDateTimePicker({ mode: 'datetime' });
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        fixture.componentInstance.focus();
        await flush(fixture);
        await flush(fixture);
        const outside = document.createElement('button');
        document.body.appendChild(outside);

        try {
          // Act: Focus the element outside the wrapper.
          outside.focus();
          await flush(fixture);

          // Assert: Containment on the wrapper root must not swallow a real blur.
          expect(touchSpy, 'focus leaving the wrapper should report touch once').toHaveBeenCalledTimes(1);
          expect(getDateInput(fixture).getAttribute('aria-expanded'), 'calendar should close when focus leaves the wrapper').toBe('false');
        } finally { // cleanup
          outside.remove();
        }
      });
    });
  });
});
