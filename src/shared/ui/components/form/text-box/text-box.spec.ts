import { TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';

import { TextBox } from './text-box';

/**
 * Unit tests of text-box component.
 * Note: TextBox is wrapper for text input, so we do not have to test as much as it would be needed for full custom component.
 */
describe('TextBox', () => {
  interface TextBoxTestOptions {
    /** Initial value for the input. */
    value?: string | null;
    /** Type of input. */
    type?: 'text' | 'password' | 'email' | 'search' | 'tel' | 'url';
    /** If false, pasting is not allowed. */
    allowPaste?: boolean;
    /** For autocomplete attribute. */
    autocomplete?: string;
    /** Placeholder text. */
    placeholder?: string;
    /** Whether the input is required. */
    required?: boolean;
    /** Whether the input is disabled. */
    disabled?: boolean;
    /** Whether the input is in invalid state. */
    invalid?: boolean;
    /** Identifier for the input. */
    ident?: string;
    /** Label reference for aria-labelledby. */
    label?: string;
  }

  /**
   * Create the component with given inputs.
   * @param opts Configuration options for the component.
   * @returns Fixture of the created component.
   */
  async function arrangeTextBox(opts: TextBoxTestOptions = {}) {
    const {
      value = null,
      type = 'text',
      allowPaste = true,
      autocomplete = 'off',
      placeholder = '',
      required = false,
      disabled = false,
      invalid = false,
      ident = 'test-textbox',
      label = '',
    } = opts;

    await TestBed.configureTestingModule({
      imports: [TextBox],
    }).compileComponents();

    const fixture = TestBed.createComponent(TextBox);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('allowPaste', allowPaste);
    fixture.componentRef.setInput('autocomplete', autocomplete);
    fixture.componentRef.setInput('placeholder', placeholder);
    fixture.componentRef.setInput('required', required);
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
      const fixture = await arrangeTextBox();

      // Assert: Component renders, value is null.
      const input = fixture.nativeElement.querySelector('input');
      expect(input, 'should render input element').not.toBeNull();
      expect(fixture.componentInstance.value(), 'default value should be null').toBeNull();
    });

    it('should set input element value to empty string by default', async () => {
      // Arrange: Create component with defaults.
      const fixture = await arrangeTextBox();

      // Assert: DOM input value is empty string when model is null.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.value, 'input element value should be empty string').toBe('');
    });

    it('should render input with correct default type', async () => {
      // Arrange: Create component with defaults.
      const fixture = await arrangeTextBox();

      // Assert: Type is 'text' by default.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('type'), 'should have type text by default').toBe('text');
    });

    it('should render input with password type', async () => {
      // Arrange: Create component with password type.
      const fixture = await arrangeTextBox({ type: 'password' });

      // Assert: Type attribute is password.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('type'), 'should have type password').toBe('password');
    });

    it('should render input with email type', async () => {
      // Arrange: Create component with email type.
      const fixture = await arrangeTextBox({ type: 'email' });

      // Assert: Type attribute is email.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('type'), 'should have type email').toBe('email');
    });

    it('should render input with search type', async () => {
      // Arrange: Create component with search type.
      const fixture = await arrangeTextBox({ type: 'search' });

      // Assert: Type attribute is search.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('type'), 'should have type search').toBe('search');
    });

    it('should render input with tel type', async () => {
      // Arrange: Create component with tel type.
      const fixture = await arrangeTextBox({ type: 'tel' });

      // Assert: Type attribute is tel.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('type'), 'should have type tel').toBe('tel');
    });

    it('should render input with url type', async () => {
      // Arrange: Create component with url type.
      const fixture = await arrangeTextBox({ type: 'url' });

      // Assert: Type attribute is url.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('type'), 'should have type url').toBe('url');
    });

    it('should update value when user types into input', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeTextBox();

      // Act: Type into the input.
      const input = fixture.nativeElement.querySelector('input');
      await user.type(input, 'hello');
      fixture.detectChanges();

      // Assert: Value updated to typed text.
      expect(fixture.componentInstance.value(), 'value should be hello after typing').toBe('hello');
    });

    it('should set value programmatically via model', async () => {
      // Arrange: Create component with null value.
      const fixture = await arrangeTextBox();

      // Act: Set value programmatically.
      fixture.componentRef.setInput('value', 'test value');
      fixture.detectChanges();

      // Assert: Value updated and DOM reflects it.
      expect(fixture.componentInstance.value(), 'value should update to test value').toBe('test value');
      const input = fixture.nativeElement.querySelector('input');
      expect(input.value, 'input element should reflect programmatic value').toBe('test value');
    });

    it('should show placeholder text', async () => {
      // Arrange: Create component with placeholder.
      const fixture = await arrangeTextBox({ placeholder: 'Enter text...' });

      // Assert: Placeholder attribute is set.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('placeholder'), 'should have placeholder text').toBe('Enter text...');
    });

    it('should set autocomplete attribute', async () => {
      // Arrange: Create component with custom autocomplete.
      const fixture = await arrangeTextBox({ autocomplete: 'email' });

      // Assert: Autocomplete attribute is set.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('autocomplete'), 'should have autocomplete attribute').toBe('email');
    });

    it('should emit touch event on blur', async () => {
      // Arrange: Create component and spy on touch output.
      const fixture = await arrangeTextBox();
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);

      // Act: Simulate blur on the input.
      const input = fixture.nativeElement.querySelector('input');
      input.dispatchEvent(new Event('blur'));

      // Assert: Touch event was emitted.
      expect(touchSpy, 'touch event should be emitted on blur').toHaveBeenCalledTimes(1);
    });

    it('should act as disabled when disabled is true', async () => {
      // Arrange: Create disabled component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeTextBox({ disabled: true });

      // Assert: Input has disabled attribute.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.disabled, 'input should be disabled').toBe(true);

      // Act: Tab through the document.
      await user.tab();

      // Assert: Focus should not be on the input.
      expect(document.activeElement, 'disabled input should not receive focus').not.toBe(input);

      // Act: Type into the input.
      await user.type(input, 'test');

      // Assert: Value remains unchanged.
      expect(fixture.componentInstance.value(), 'disabled input should not accept typing').toBeNull();
    });

    it('should act as invalid when invalid is true', async () => {
      // Arrange: Create invalid component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeTextBox({ invalid: true });

      // Assert: Input has invalid class.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.classList.contains('invalid'), 'should have invalid class').toBe(true);

      // Act: Tab through the document.
      await user.tab();

      // Assert: Focus should be on the input (invalid is visual only).
      expect(document.activeElement, 'invalid input should receive focus').toBe(input);

      // Act: Type into the input.
      await user.type(input, 'test');
      fixture.detectChanges();

      // Assert: Value updates normally.
      expect(fixture.componentInstance.value(), 'invalid input should accept typing').toBe('test');
    });

    it('should have both disabled and invalid attributes when both inputs are true', async () => {
      // Arrange: Create component with both disabled and invalid.
      const fixture = await arrangeTextBox({ disabled: true, invalid: true });

      // Assert: Input has both disabled and invalid class.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.disabled, 'should be disabled').toBe(true);
      expect(input.classList.contains('invalid'), 'should have invalid class').toBe(true);
    });

    it('should prevent paste when allowPaste is false', async () => {
      // Arrange: Create component with paste disabled.
      const fixture = await arrangeTextBox({ allowPaste: false });
      const input = fixture.nativeElement.querySelector('input');
      const preventDefaultSpy = vi.fn();
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      pasteEvent.preventDefault = preventDefaultSpy;

      // Act: Dispatch paste event on the input.
      input.dispatchEvent(pasteEvent);

      // Assert: Paste event was prevented.
      expect(preventDefaultSpy, 'paste event should call preventDefault').toHaveBeenCalledTimes(1);
    });

    it('should allow paste when allowPaste is true', async () => {
      // Arrange: Create component with paste enabled (default).
      const fixture = await arrangeTextBox({ allowPaste: true });
      const input = fixture.nativeElement.querySelector('input');
      const preventDefaultSpy = vi.fn();
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      pasteEvent.preventDefault = preventDefaultSpy;

      // Act: Dispatch paste event on the input.
      input.dispatchEvent(pasteEvent);

      // Assert: Paste event was not prevented.
      expect(preventDefaultSpy, 'paste event should not call preventDefault').not.toHaveBeenCalled();
    });

    it('should set input id from ident', async () => {
      // Arrange: Create component with custom ident.
      const fixture = await arrangeTextBox({ ident: 'my-input' });

      // Assert: Input has matching id.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('id'), 'input id should match ident').toBe('my-input');
    });

    it('should set required attribute when required is true', async () => {
      // Arrange: Create component with required input.
      const fixture = await arrangeTextBox({ required: true });

      // Assert: Input has required attribute.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.required, 'input should be required').toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should set aria-labelledby when label is provided', async () => {
      // Arrange: Create component with label input.
      const fixture = await arrangeTextBox({ label: 'my-label' });

      // Assert: aria-labelledby matches the label input.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('aria-labelledby'), 'aria-labelledby should match label input').toBe('my-label');
    });

    it('should not set aria-labelledby when label is empty', async () => {
      // Arrange: Create component without label input.
      const fixture = await arrangeTextBox();

      // Assert: aria-labelledby is not present.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.hasAttribute('aria-labelledby'), 'aria-labelledby should not be set when label is empty').toBe(false);
    });

    it('should set aria-required when required is true', async () => {
      // Arrange: Create component with required input.
      const fixture = await arrangeTextBox({ required: true });

      // Assert: aria-required is true.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('aria-required'), 'aria-required should be true when required').toBe('true');
    });

    it('should not set aria-required when required is false', async () => {
      // Arrange: Create component without required input.
      const fixture = await arrangeTextBox();

      // Assert: aria-required is not present.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.hasAttribute('aria-required'), 'aria-required should not be set when not required').toBe(false);
    });

    it('should set aria-invalid when invalid is true', async () => {
      // Arrange: Create component with invalid state.
      const fixture = await arrangeTextBox({ invalid: true });

      // Assert: aria-invalid is true.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('aria-invalid'), 'aria-invalid should be true when invalid').toBe('true');
    });

    it('should not set aria-invalid when invalid is false', async () => {
      // Arrange: Create component without invalid state.
      const fixture = await arrangeTextBox();

      // Assert: aria-invalid is not present.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.hasAttribute('aria-invalid'), 'aria-invalid should not be set when not invalid').toBe(false);
    });

    it('should set aria-disabled when disabled is true', async () => {
      // Arrange: Create component with disabled state.
      const fixture = await arrangeTextBox({ disabled: true });

      // Assert: aria-disabled is true.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('aria-disabled'), 'aria-disabled should be true when disabled').toBe('true');
    });

    it('should not set aria-disabled when disabled is false', async () => {
      // Arrange: Create component without disabled state.
      const fixture = await arrangeTextBox();

      // Assert: aria-disabled is not present.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.hasAttribute('aria-disabled'), 'aria-disabled should not be set when not disabled').toBe(false);
    });

    it('should have tabindex 0 when enabled', async () => {
      // Arrange: Create enabled component.
      const fixture = await arrangeTextBox();

      // Assert: Tabindex is 0.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('tabindex'), 'enabled input should have tabindex 0').toBe('0');
    });

    it('should have tabindex -1 when disabled', async () => {
      // Arrange: Create disabled component.
      const fixture = await arrangeTextBox({ disabled: true });

      // Assert: Tabindex is -1.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('tabindex'), 'disabled input should have tabindex -1').toBe('-1');
    });

    it('should set data-testid from ident', async () => {
      // Arrange: Create component with custom ident.
      const fixture = await arrangeTextBox({ ident: 'my-testid' });

      // Assert: data-testid matches ident.
      const input = fixture.nativeElement.querySelector('input');
      expect(input.getAttribute('data-testid'), 'data-testid should match ident').toBe('my-testid');
    });
  });
});
