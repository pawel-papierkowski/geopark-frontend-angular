import { TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { TranslateService } from '@ngx-translate/core';

import { RadioBox } from './radio-box';

/**
 * Unit tests of radio-box component.
 */
describe('RadioBox', () => {
  interface RadioBoxTestOptions {
    /** Initial value. */
    value?: number | string | null;
    /** Array of options. */
    options?: (number | string | null)[];
    /** Prefix for translating option labels. */
    langPrefix?: string;
    /** Whether the component is disabled. */
    disabled?: boolean;
    /** Whether the component is in invalid state. */
    invalid?: boolean;
    /** Identifier for the component. */
    ident?: string;
    /** Label reference for aria-labelledby. */
    label?: string;
  }

  /**
   * Create the component with given inputs.
   * @param opts Configuration options for the component.
   * @returns Fixture of the created component.
   */
  async function arrangeRadioBox(opts: RadioBoxTestOptions = {}) {
    const {
      value = null,
      options = ['a', 'b', 'c'],
      langPrefix = '',
      disabled = false,
      invalid = false,
      ident = 'test-radio',
      label = '',
    } = opts;

    await TestBed.configureTestingModule({
      imports: [RadioBox],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioBox);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('langPrefix', langPrefix);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.componentRef.setInput('invalid', invalid);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  describe('general', () => {
    it('should render with default values', async () => {
      // Arrange: Create component with defaults.
      const fixture = await arrangeRadioBox();

      // Assert: Component renders, value is null, no options selected.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio, 'should render radiobox element').not.toBeNull();
      expect(fixture.componentInstance.value(), 'default value should be null').toBeNull();
    });

    it('should render all options', async () => {
      // Arrange: Create component with three options.
      const fixture = await arrangeRadioBox({ options: ['a', 'b', 'c'] });

      // Assert: Three option elements rendered.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options.length, 'should render three options').toBe(3);
    });

    it('should render option labels as text', async () => {
      // Arrange: Create component with string options.
      const fixture = await arrangeRadioBox({ options: ['alpha', 'beta'] });

      // Assert: Option labels are visible.
      const labels = fixture.nativeElement.querySelectorAll('.radiobox-label');
      expect(labels[0].textContent, 'first option should show alpha').toContain('alpha');
      expect(labels[1].textContent, 'second option should show beta').toContain('beta');
    });

    it('should select option via click', async () => {
      // Arrange: Create component with options and no initial value.
      const fixture = await arrangeRadioBox({ options: ['a', 'b', 'c'] });

      // Act: Click second option.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].click();
      fixture.detectChanges();

      // Assert: Value updated to 'b'.
      expect(fixture.componentInstance.value(), 'value should be b after click').toBe('b');
    });

    it('should mark selected option with mark class', async () => {
      // Arrange: Create component with second option selected.
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Assert: Second option has mark class, first and third do not.
      const insides = fixture.nativeElement.querySelectorAll('.radiobox-inside');
      expect(insides[0].classList.contains('mark'), 'first option should not have mark').toBe(false);
      expect(insides[1].classList.contains('mark'), 'second option should have mark').toBe(true);
      expect(insides[2].classList.contains('mark'), 'third option should not have mark').toBe(false);
    });

    it('should change selection on click', async () => {
      // Arrange: Create component with first option selected.
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });
      expect(fixture.componentInstance.value(), 'initial value should be a').toBe('a');

      // Act: Click third option.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[2].click();
      fixture.detectChanges();

      // Assert: Value changed to 'c'.
      expect(fixture.componentInstance.value(), 'value should change to c').toBe('c');
      const insides = fixture.nativeElement.querySelectorAll('.radiobox-inside');
      expect(insides[2].classList.contains('mark'), 'third option should now have mark').toBe(true);
    });

    it('should prevent selection when disabled', async () => {
      // Arrange: Create disabled component.
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'], disabled: true });

      // Act: Click second option.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].click();
      fixture.detectChanges();

      // Assert: Value unchanged.
      expect(fixture.componentInstance.value(), 'disabled component should not change value').toBe('a');
    });

    it('should have disabled class when disabled', async () => {
      // Arrange: Create disabled component.
      const fixture = await arrangeRadioBox({ disabled: true });

      // Assert: Disabled class present.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio.classList.contains('disabled'), 'should have disabled class').toBe(true);
    });

    it('should have invalid class when invalid', async () => {
      // Arrange: Create invalid component.
      const fixture = await arrangeRadioBox({ invalid: true });

      // Assert: Invalid class present.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio.classList.contains('invalid'), 'should have invalid class').toBe(true);
    });

    it('should still allow selection when invalid', async () => {
      // Arrange: Create invalid component.
      const fixture = await arrangeRadioBox({ invalid: true });

      // Act: Click second option.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].click();
      fixture.detectChanges();

      // Assert: Value updated despite invalid state.
      expect(fixture.componentInstance.value(), 'invalid component should still update value').toBe('b');
    });

    it('should emit touch event on blur', async () => {
      // Arrange: Create component and spy on touch output.
      const fixture = await arrangeRadioBox();
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);

      // Act: Simulate blur on the radiobox div.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      radio.dispatchEvent(new Event('blur'));

      // Assert: Touch event was emitted.
      expect(touchSpy, 'touch event should be emitted on blur').toHaveBeenCalledTimes(1);
    });

    it('should update display when value changes programmatically', async () => {
      // Arrange: Create component with null value.
      const fixture = await arrangeRadioBox();

      // Act: Set value programmatically.
      fixture.componentRef.setInput('value', 'b');
      fixture.detectChanges();

      // Assert: DOM reflects the new value.
      expect(fixture.componentInstance.value(), 'value should update to b').toBe('b');
      const insides = fixture.nativeElement.querySelectorAll('.radiobox-inside');
      expect(insides[1].classList.contains('mark'), 'second option should have mark').toBe(true);
    });

    it('should show translated option text with langPrefix', async () => {
      // Arrange: Create component with langPrefix and set translations.
      const fixture = await arrangeRadioBox({ options: ['opt1', 'opt2'], langPrefix: 'test.options' });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('en', {
        test: { options: { opt1: 'Option One', opt2: 'Option Two' } },
      });
      translateService.use('en');
      fixture.detectChanges();

      // Assert: Options show translated text.
      const labels = fixture.nativeElement.querySelectorAll('.radiobox-label');
      expect(labels[0].textContent, 'first option should show translated text').toContain('Option One');
      expect(labels[1].textContent, 'second option should show translated text').toContain('Option Two');
    });

    it('should show translated option text with langPrefix for numeric options', async () => {
      // Arrange: Create component with numeric options and langPrefix.
      const fixture = await arrangeRadioBox({ options: [1, 2], langPrefix: 'test.options' });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('en', {
        test: { options: { 1: 'First', 2: 'Second' } },
      });
      translateService.use('en');
      fixture.detectChanges();

      // Assert: Numeric options are translated using key langPrefix.N.
      const labels = fixture.nativeElement.querySelectorAll('.radiobox-label');
      expect(labels[0].textContent, 'first numeric option should show translated text').toContain('First');
      expect(labels[1].textContent, 'second numeric option should show translated text').toContain('Second');
    });

    it('should show raw option text without langPrefix', async () => {
      // Arrange: Create component without langPrefix.
      const fixture = await arrangeRadioBox({ options: ['opt1', 'opt2'] });

      // Assert: Options show raw text.
      const labels = fixture.nativeElement.querySelectorAll('.radiobox-label');
      expect(labels[0].textContent, 'first option should show raw text').toContain('opt1');
      expect(labels[1].textContent, 'second option should show raw text').toContain('opt2');
    });

    it('should handle null option in the list', async () => {
      // Arrange: Create component with null in options list.
      const fixture = await arrangeRadioBox({ options: [null, 'a', 'b'] });

      // Assert: Three options rendered.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options.length, 'should render three options including null').toBe(3);

      // Act: Click first option (null).
      options[0].click();
      fixture.detectChanges();

      // Assert: Value set to null.
      expect(fixture.componentInstance.value(), 'clicking null option should set value to null').toBeNull();
    });

    it('should handle numeric options', async () => {
      // Arrange: Create component with numeric options.
      const fixture = await arrangeRadioBox({ options: [1, 2, 3] });

      // Act: Click second option.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].click();
      fixture.detectChanges();

      // Assert: Value set to 2.
      expect(fixture.componentInstance.value(), 'value should be 2').toBe(2);
    });
  });

  describe('accessibility', () => {
    it('should have role radiogroup on outer div', async () => {
      // Arrange: Create component.
      const fixture = await arrangeRadioBox();

      // Assert: Role attribute is radiogroup.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio.getAttribute('role'), 'should have radiogroup role').toBe('radiogroup');
    });

    it('should have role radio on each option', async () => {
      // Arrange: Create component with options.
      const fixture = await arrangeRadioBox({ options: ['a', 'b'] });

      // Assert: Each option has role="radio".
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options[0].getAttribute('role'), 'first option should have radio role').toBe('radio');
      expect(options[1].getAttribute('role'), 'second option should have radio role').toBe('radio');
    });

    it('should set aria-checked to true on selected option', async () => {
      // Arrange: Create component with second option selected.
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Assert: Second option has aria-checked="true".
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options[1].getAttribute('aria-checked'), 'selected option should have aria-checked true').toBe('true');
    });

    it('should set aria-checked to false on unselected options', async () => {
      // Arrange: Create component with second option selected.
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Assert: Unselected options have aria-checked="false".
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options[0].getAttribute('aria-checked'), 'unselected option should have aria-checked false').toBe('false');
      expect(options[2].getAttribute('aria-checked'), 'unselected option should have aria-checked false').toBe('false');
    });

    it('should set aria-disabled when disabled', async () => {
      // Arrange: Create disabled component.
      const fixture = await arrangeRadioBox({ options: ['a', 'b'], disabled: true });

      // Assert: aria-disabled is true.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio.getAttribute('aria-disabled'), 'should have aria-disabled true').toBe('true');
    });

    it('should set aria-labelledby when label is provided', async () => {
      // Arrange: Create component with label input.
      const fixture = await arrangeRadioBox({ options: ['a'], label: 'my-label' });

      // Assert: aria-labelledby matches the label input.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio.getAttribute('aria-labelledby'), 'aria-labelledby should match label input').toBe('my-label');
    });

    it('should not set aria-labelledby when label is empty', async () => {
      // Arrange: Create component without label input.
      const fixture = await arrangeRadioBox();

      // Assert: aria-labelledby is not present.
      const radio = fixture.nativeElement.querySelector('.radiobox');
      expect(radio.hasAttribute('aria-labelledby'), 'aria-labelledby should not be set when label is empty').toBe(false);
    });

    it('should have hidden button with id for label association', async () => {
      // Arrange: Create component with custom id.
      const fixture = await arrangeRadioBox({ options: ['a'], ident: 'my-radio' });

      // Assert: Hidden button with matching id exists.
      const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
      expect(hiddenButton, 'should render hidden button for label association').not.toBeNull();
      expect(hiddenButton.getAttribute('id'), 'hidden button id should match component id').toBe('my-radio');
      expect(hiddenButton.getAttribute('tabindex'), 'hidden button should not be focusable').toBe('-1');
      expect(hiddenButton.getAttribute('aria-hidden'), 'hidden button should be hidden from assistive technology').toBe('true');
    });

    it('should have correct option IDs following ident_opt_N pattern', async () => {
      // Arrange: Create component with custom ident and three options.
      const fixture = await arrangeRadioBox({ options: ['x', 'y', 'z'], ident: 'my-radio' });

      // Assert: Each option has the expected ID.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options[0].getAttribute('id'), 'first option ID should follow ident_opt_0 pattern').toBe('my-radio_opt_0');
      expect(options[1].getAttribute('id'), 'second option ID should follow ident_opt_1 pattern').toBe('my-radio_opt_1');
      expect(options[2].getAttribute('id'), 'third option ID should follow ident_opt_2 pattern').toBe('my-radio_opt_2');
    });

    it('should have tabindex 0 on selected option', async () => {
      // Arrange: Create component with second option selected.
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Assert: Selected option has tabindex 0.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options[1].getAttribute('tabindex'), 'selected option should have tabindex 0').toBe('0');
    });

    it('should have tabindex -1 on unselected options', async () => {
      // Arrange: Create component with second option selected.
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Assert: Unselected options have tabindex -1.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(options[0].getAttribute('tabindex'), 'unselected option should have tabindex -1').toBe('-1');
      expect(options[2].getAttribute('tabindex'), 'unselected option should have tabindex -1').toBe('-1');
    });

    it('should select next option on ArrowDown', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });

      // Act: Focus first option and press ArrowDown.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{ArrowDown}');
      await fixture.whenStable();

      // Assert: Value moved to second option.
      expect(fixture.componentInstance.value(), 'ArrowDown should select next option').toBe('b');
    });

    it('should select next option on ArrowRight', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });

      // Act: Focus first option and press ArrowRight.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{ArrowRight}');
      await fixture.whenStable();

      // Assert: Value moved to second option.
      expect(fixture.componentInstance.value(), 'ArrowRight should select next option').toBe('b');
    });

    it('should select previous option on ArrowUp', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Act: Focus second option and press ArrowUp.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].focus();
      await user.keyboard('{ArrowUp}');
      await fixture.whenStable();

      // Assert: Value moved to first option.
      expect(fixture.componentInstance.value(), 'ArrowUp should select previous option').toBe('a');
    });

    it('should select previous option on ArrowLeft', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });

      // Act: Focus second option and press ArrowLeft.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].focus();
      await user.keyboard('{ArrowLeft}');
      await fixture.whenStable();

      // Assert: Value moved to first option.
      expect(fixture.componentInstance.value(), 'ArrowLeft should select previous option').toBe('a');
    });

    it('should wrap around to first option on ArrowDown from last', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'c', options: ['a', 'b', 'c'] });

      // Act: Focus last option and press ArrowDown.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[2].focus();
      await user.keyboard('{ArrowDown}');
      await fixture.whenStable();

      // Assert: Value wrapped to first option.
      expect(fixture.componentInstance.value(), 'ArrowDown from last should wrap to first').toBe('a');
    });

    it('should wrap around to last option on ArrowUp from first', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });

      // Act: Focus first option and press ArrowUp.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{ArrowUp}');
      await fixture.whenStable();

      // Assert: Value wrapped to last option.
      expect(fixture.componentInstance.value(), 'ArrowUp from first should wrap to last').toBe('c');
    });

    it('should not respond to arrows when disabled', async () => {
      // Arrange: Create disabled component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'], disabled: true });

      // Act: Focus first option and press ArrowDown.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{ArrowDown}');
      await fixture.whenStable();

      // Assert: Value unchanged.
      expect(fixture.componentInstance.value(), 'disabled component should not respond to arrows').toBe('a');
    });

    it('should not respond to Enter when disabled', async () => {
      // Arrange: Create disabled component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'], disabled: true });

      // Act: Focus first option and press Enter.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Value unchanged.
      expect(fixture.componentInstance.value(), 'disabled component should not respond to Enter').toBe('a');
    });

    it('should not respond to Space when disabled', async () => {
      // Arrange: Create disabled component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'], disabled: true });

      // Act: Focus first option and press Space.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard(' ');
      await fixture.whenStable();

      // Assert: Value unchanged.
      expect(fixture.componentInstance.value(), 'disabled component should not respond to Space').toBe('a');
    });

    it('should move focus to next focusable element on Enter', async () => {
      // Arrange: Create component with selected option and a focusable element after it.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });
      const nextButton = document.createElement('button');
      nextButton.textContent = 'Next';
      document.body.appendChild(nextButton);
      fixture.detectChanges();

      // Act: Focus first option and press Enter.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Focus moved to the next button, touch event emitted.
      expect(document.activeElement, 'focus should move to next focusable element').toBe(nextButton);

      // Cleanup.
      document.body.removeChild(nextButton);
    });

    it('should emit touch event on Enter', async () => {
      // Arrange: Create component with selected option, next focusable element, and touch spy.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'b', options: ['a', 'b', 'c'] });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      const nextButton = document.createElement('button');
      nextButton.textContent = 'Next';
      document.body.appendChild(nextButton);
      fixture.detectChanges();

      // Act: Focus second option and press Enter.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[1].focus();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Touch event was emitted.
      expect(touchSpy, 'touch event should be emitted on Enter').toHaveBeenCalledTimes(1);

      // Cleanup.
      document.body.removeChild(nextButton);
    });

    it('should move focus to next focusable element on Space', async () => {
      // Arrange: Create component with selected option and a focusable element after it.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });
      const nextButton = document.createElement('button');
      nextButton.textContent = 'Next';
      document.body.appendChild(nextButton);
      fixture.detectChanges();

      // Act: Focus first option and press Space.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard(' ');
      await fixture.whenStable();

      // Assert: Focus moved to the next button.
      expect(document.activeElement, 'focus should move to next focusable element on Space').toBe(nextButton);

      // Cleanup.
      document.body.removeChild(nextButton);
    });

    it('should emit touch event on Space', async () => {
      // Arrange: Create component with selected option, next focusable element, and touch spy.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'c', options: ['a', 'b', 'c'] });
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);
      const nextButton = document.createElement('button');
      nextButton.textContent = 'Next';
      document.body.appendChild(nextButton);
      fixture.detectChanges();

      // Act: Focus third option and press Space.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[2].focus();
      await user.keyboard(' ');
      await fixture.whenStable();

      // Assert: Touch event was emitted.
      expect(touchSpy, 'touch event should be emitted on Space').toHaveBeenCalledTimes(1);

      // Cleanup.
      document.body.removeChild(nextButton);
    });

    it('should set tabindex 0 on selected option after arrow navigation', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeRadioBox({ value: 'a', options: ['a', 'b', 'c'] });

      // Act: Focus first option and press ArrowDown.
      const options = fixture.nativeElement.querySelectorAll('.radiobox-option');
      options[0].focus();
      await user.keyboard('{ArrowDown}');
      await fixture.whenStable();

      // Assert: Second option now has tabindex 0, first has tabindex -1.
      const updatedOptions = fixture.nativeElement.querySelectorAll('.radiobox-option');
      expect(updatedOptions[0].getAttribute('tabindex'), 'previous option should have tabindex -1').toBe('-1');
      expect(updatedOptions[1].getAttribute('tabindex'), 'newly selected option should have tabindex 0').toBe('0');
    });
  });
});
