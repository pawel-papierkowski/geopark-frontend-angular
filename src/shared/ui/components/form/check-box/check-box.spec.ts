import { TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';

import { CheckBox } from './check-box';

describe('CheckBox', () => {
  /**
   * Create the component with given inputs.
   * @param value Initial value for the checkbox.
   * @param canNull Whether null values are allowed.
   * @param disabled Whether the checkbox is disabled.
   * @param invalid Whether the checkbox is in invalid state.
   * @param ident Identifier for the checkbox.
   * @param label Label reference for aria-labelledby.
   * @returns Fixture of the created component.
   */
  async function arrangeCheckBox(
    value: boolean | null = null,
    canNull = false,
    disabled = false,
    invalid = false,
    ident = 'test-checkbox',
    label = '',
  ) {
    await TestBed.configureTestingModule({
      imports: [CheckBox],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckBox);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('canNull', canNull);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.componentRef.setInput('invalid', invalid);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  describe('general', () => {
    it('should render with default values', async () => {
      // Note canNull affects only user ability to set null value. Component still can have null set programmatically.
      // Arrange: Create component with defaults, including null value and canNull = false.
      const fixture = await arrangeCheckBox();

      // Assert: Default state is null with mixed symbol.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox, 'should render checkbox element').not.toBeNull();
      expect(fixture.componentInstance.value(), 'default value should be null').toBeNull();
      expect(fixture.nativeElement.textContent, 'should display mixed symbol for null').toContain('◼');
    });

    it('should render checked symbol when value is true', async () => {
      // Arrange: Create component with true value.
      const fixture = await arrangeCheckBox(true);

      // Assert: Shows checkmark symbol.
      expect(fixture.componentInstance.value(), 'value should be true').toBe(true);
      expect(fixture.nativeElement.textContent, 'should display checkmark for true').toContain('✔');
    });

    it('should render unchecked symbol when value is false', async () => {
      // Arrange: Create component with false value.
      const fixture = await arrangeCheckBox(false);

      // Assert: Shows non-breaking space for false.
      expect(fixture.componentInstance.value(), 'value should be false').toBe(false);
      const insideText = fixture.nativeElement.querySelector('.checkbox-inside')!.textContent!;
      expect(insideText.includes('✔'), 'false state should not show checkmark').toBe(false);
      expect(insideText.includes('◼'), 'false state should not show mixed symbol').toBe(false);
    });

    it('should render mixed symbol when value is null with canNull', async () => {
      // Arrange: Create component with null value and canNull enabled.
      const fixture = await arrangeCheckBox(null, true);

      // Assert: Shows indeterminate symbol.
      expect(fixture.componentInstance.value(), 'value should be null').toBeNull();
      expect(fixture.nativeElement.textContent, 'should display mixed symbol for null').toContain('◼');
    });

    it('should cycle null → true → false → null when canNull is true', async () => {
      // Arrange: Create component with null value and canNull enabled.
      const fixture = await arrangeCheckBox(null, true);
      const checkbox = fixture.nativeElement.querySelector('.checkbox');

      // Act & Assert: null → true.
      checkbox.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value(), 'null should toggle to true').toBe(true);
      expect(fixture.nativeElement.textContent, 'should display checkmark').toContain('✔');

      // Act & Assert: true → false.
      checkbox.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value(), 'true should toggle to false').toBe(false);
      const insideText2 = fixture.nativeElement.querySelector('.checkbox-inside')!.textContent!;
      expect(insideText2.includes('✔'), 'false state should not show checkmark').toBe(false);
      expect(insideText2.includes('◼'), 'false state should not show mixed symbol').toBe(false);

      // Act & Assert: false → null.
      checkbox.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value(), 'false should toggle to null').toBeNull();
      expect(fixture.nativeElement.textContent, 'should display mixed symbol').toContain('◼');
    });

    it('should cycle true → false → true when canNull is false', async () => {
      // Arrange: Create component with true value and canNull disabled.
      const fixture = await arrangeCheckBox(true, false);
      const checkbox = fixture.nativeElement.querySelector('.checkbox');

      // Act & Assert: true → false.
      checkbox.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value(), 'true should toggle to false').toBe(false);

      // Act & Assert: false → true (no null when canNull is false).
      checkbox.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.value(), 'false should toggle to true').toBe(true);
    });

    it('should emit touch event on blur', async () => {
      // Arrange: Create component and spy on touch output.
      const fixture = await arrangeCheckBox();
      const touchSpy = vi.fn();
      fixture.componentInstance.touch.subscribe(touchSpy);

      // Act: Simulate blur.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      checkbox.dispatchEvent(new Event('blur'));

      // Assert: Touch event was emitted.
      expect(touchSpy, 'touch event should be emitted on blur').toHaveBeenCalledTimes(1);
    });

    it('should act as disabled when disabled is true', async () => {
      // Arrange: Create component with disabled state and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeCheckBox(false, false, true);

      // Assert: Disabled class is present.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.classList.contains('disabled'), 'should have disabled class').toBe(true);

      // Act: Tab through the document.
      await user.tab();

      // Assert: Focus should not be on the checkbox.
      expect(document.activeElement, 'disabled checkbox should not receive focus').not.toBe(checkbox);

      // Act: Click the checkbox div.
      checkbox.click();
      fixture.detectChanges();

      // Assert: Value remains unchanged.
      expect(fixture.componentInstance.value(), 'disabled checkbox should not toggle on click').toBe(false);
    });

    it('should act as invalid when invalid is true', async () => {
      // Invalid state is purely visual, checkbox should function normally.
      // Arrange: Create component with invalid state and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeCheckBox(null, false, false, true);

      // Assert: Invalid class is present.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.classList.contains('invalid'), 'should have invalid class').toBe(true);

      // Act: Tab through the document.
      await user.tab();

      // Assert: Focus should be on the checkbox.
      expect(document.activeElement, 'invalid checkbox should receive focus').toBe(checkbox);

      // Act: Click the checkbox div.
      checkbox.click();
      fixture.detectChanges();

      // Assert: Value is unchanged.
      expect(fixture.componentInstance.value(), 'invalid checkbox should toggle on click').toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have role checkbox', async () => {
      // Arrange: Create component.
      const fixture = await arrangeCheckBox();

      // Assert: Role attribute is checkbox.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('role'), 'should have checkbox role').toBe('checkbox');
    });

    it('should set aria-checked to true when value is true', async () => {
      // Arrange: Create component with true value.
      const fixture = await arrangeCheckBox(true);

      // Assert: aria-checked is true.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('aria-checked'), 'aria-checked should be true for true value').toBe('true');
    });

    it('should set aria-checked to false when value is false', async () => {
      // Arrange: Create component with false value.
      const fixture = await arrangeCheckBox(false);

      // Assert: aria-checked is false.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('aria-checked'), 'aria-checked should be false for false value').toBe('false');
    });

    it('should set aria-checked to mixed when value is null', async () => {
      // Arrange: Create component with null value.
      const fixture = await arrangeCheckBox(null, true);

      // Assert: aria-checked is mixed.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('aria-checked'), 'aria-checked should be mixed for null value').toBe('mixed');
    });

    it('should set aria-disabled when disabled', async () => {
      // Arrange: Create component with disabled state.
      const fixture = await arrangeCheckBox(null, false, true);

      // Assert: aria-disabled is true.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('aria-disabled'), 'aria-disabled should be true when disabled').toBe('true');
    });

    it('should toggle value on Enter key press', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeCheckBox(false);

      // Act: Tab to checkbox and press Enter.
      await user.tab();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Value toggled from false to true.
      expect(fixture.componentInstance.value(), 'Enter should toggle value').toBe(true);
    });

    it('should toggle value on Space key press', async () => {
      // Arrange: Create component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeCheckBox(false);

      // Act: Tab to checkbox and press Space.
      await user.tab();
      await user.keyboard(' ');
      await fixture.whenStable();

      // Assert: Value toggled from false to true.
      expect(fixture.componentInstance.value(), 'Space should toggle value').toBe(true);
    });

    it('should not toggle on Enter when disabled', async () => {
      // Arrange: Create disabled component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeCheckBox(false, false, true);

      // Act: Tab to checkbox and press Enter.
      await user.tab();
      await user.keyboard('{Enter}');
      await fixture.whenStable();

      // Assert: Value unchanged.
      expect(fixture.componentInstance.value(), 'Enter should not toggle disabled checkbox').toBe(false);
    });

    it('should not toggle on Space when disabled', async () => {
      // Arrange: Create disabled component and user event setup.
      const user = userEvent.setup();
      const fixture = await arrangeCheckBox(false, false, true);

      // Act: Tab to checkbox and press Space.
      await user.tab();
      await user.keyboard(' ');
      await fixture.whenStable();

      // Assert: Value unchanged.
      expect(fixture.componentInstance.value(), 'Space should not toggle disabled checkbox').toBe(false);
    });

    it('should have tabindex 0 when enabled', async () => {
      // Arrange: Create enabled component.
      const fixture = await arrangeCheckBox();

      // Assert: Tabindex is 0.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('tabindex'), 'enabled checkbox should have tabindex 0').toBe('0');
    });

    it('should have tabindex -1 when disabled', async () => {
      // Arrange: Create disabled component.
      const fixture = await arrangeCheckBox(null, false, true);

      // Assert: Tabindex is -1.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('tabindex'), 'disabled checkbox should have tabindex -1').toBe('-1');
    });

    it('should have hidden button with id for label association', async () => {
      // Arrange: Create component with custom id.
      const fixture = await arrangeCheckBox(null, false, false, false, 'my-checkbox');

      // Assert: Hidden button with matching id exists.
      const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
      expect(hiddenButton, 'should render hidden button for label association').not.toBeNull();
      expect(hiddenButton.getAttribute('id'), 'hidden button id should match component id').toBe('my-checkbox');
      expect(hiddenButton.getAttribute('tabindex'), 'hidden button should not be focusable').toBe('-1');
      expect(hiddenButton.getAttribute('aria-hidden'), 'hidden button should be hidden from assistive technology').toBe('true');
    });

    it('should set aria-labelledby when label is provided', async () => {
      // Arrange: Create component with label input.
      const fixture = await arrangeCheckBox(null, false, false, false, 'test-checkbox', 'my-label');

      // Assert: aria-labelledby matches the label input.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.getAttribute('aria-labelledby'), 'aria-labelledby should match label input').toBe('my-label');
    });

    it('should not set aria-labelledby when label is empty', async () => {
      // Arrange: Create component without label input.
      const fixture = await arrangeCheckBox();

      // Assert: aria-labelledby is not present.
      const checkbox = fixture.nativeElement.querySelector('.checkbox');
      expect(checkbox.hasAttribute('aria-labelledby'), 'aria-labelledby should not be set when label is empty').toBe(false);
    });
  });
});
