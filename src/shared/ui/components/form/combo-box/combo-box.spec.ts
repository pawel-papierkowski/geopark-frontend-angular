import { TestBed } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { TranslateService } from '@ngx-translate/core';

import { ComboBox } from './combo-box';

/**
 * Unit tests of combo-box component.
 */
describe('ComboBox', () => {
  interface ComboBoxTestOptions {
    /** Initial value. */
    value?: number | string | null;
    /** Array of options. */
    options?: (number | string | null)[];
    /** Prefix for translating option labels and placeholder. */
    langPrefix?: string;
    /** Placeholder text or translation key. */
    placeholder?: string;
    /** Whether the component is required. */
    required?: boolean;
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
  async function arrangeComboBox(opts: ComboBoxTestOptions = {}) {
    const {
      value = null,
      options = ['a', 'b', 'c'],
      langPrefix = '',
      placeholder = '',
      required = false,
      disabled = false,
      invalid = false,
      ident = 'test-combo',
      label = '',
    } = opts;

    await TestBed.configureTestingModule({
      imports: [ComboBox],
    }).compileComponents();

    const fixture = TestBed.createComponent(ComboBox);
    fixture.componentRef.setInput('ident', ident);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('langPrefix', langPrefix);
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
    describe('rendering&display', () => {
      it('should render with default values', async () => {
        // Arrange: Create component with defaults.
        const fixture = await arrangeComboBox();

        // Assert: Component renders, value is null, list is closed.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root, 'should render combobox element').not.toBeNull();
        expect(fixture.componentInstance.value(), 'default value should be null').toBeNull();
        expect(fixture.componentInstance.isOpen(), 'list should be closed by default').toBe(false);
        expect(root.getAttribute('aria-expanded'), 'aria-expanded should be false by default').toBe('false');
      });

      it('should render all options in DOM with list hidden', async () => {
        // Arrange: Create component with three options.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Assert: Three option elements rendered, list is hidden.
        const options = fixture.nativeElement.querySelectorAll('[data-testid^="test-combo_"]');
        expect(options.length, 'should render three options').toBe(3);
        const list = fixture.nativeElement.querySelector('.combobox-options');
        expect(list.style.display, 'list should be hidden when closed').toBe('none');
      });

      it('should show raw selected text without langPrefix', async () => {
        // Arrange: Create component with selected string option.
        const fixture = await arrangeComboBox({ value: 'b' });

        // Assert: Selected text shows raw option value.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show raw option b').toContain('b');
      });

      it('should show placeholder when value is null and null is not in options', async () => {
        // Arrange: Create component without null option and with placeholder.
        const fixture = await arrangeComboBox({ value: null, options: ['a', 'b'], placeholder: 'pick one' });

        // Assert: Placeholder text is shown.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show placeholder text').toContain('pick one');
      });

      it('should not show placeholder when null is in options', async () => {
        // Arrange: Create component with null option and placeholder set.
        const fixture = await arrangeComboBox({ value: null, options: [null, 'a'], placeholder: 'pick one' });

        // Assert: Placeholder text is not shown.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'placeholder should not be used when null is an option').not.toContain('pick one');
      });

      it('should show translated selected text with langPrefix', async () => {
        // Arrange: Create component with langPrefix and set translations.
        const fixture = await arrangeComboBox({ value: 'a', options: ['a', 'b'], langPrefix: 'test.options' });
        const translateService = TestBed.inject(TranslateService);
        translateService.setTranslation('en', {
          test: { options: { a: 'Option A', b: 'Option B' } },
        });
        translateService.use('en');
        fixture.detectChanges();

        // Assert: Selected text is translated.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show translated selected text').toContain('Option A');
      });

      it('should show translated placeholder with langPrefix', async () => {
        // Arrange: Create component with langPrefix and placeholder key, set translations.
        const fixture = await arrangeComboBox({
          value: null,
          options: ['a', 'b'],
          langPrefix: 'test.options',
          placeholder: 'test.pick',
        });
        const translateService = TestBed.inject(TranslateService);
        translateService.setTranslation('en', {
          test: { pick: 'Please pick' },
        });
        translateService.use('en');
        fixture.detectChanges();

        // Assert: Placeholder is resolved via translation key.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show translated placeholder').toContain('Please pick');
      });

      it('should update display when value changes programmatically', async () => {
        // Arrange: Create component with null value.
        const fixture = await arrangeComboBox({ value: null });

        // Act: Set value programmatically.
        fixture.componentRef.setInput('value', 'a');
        fixture.detectChanges();

        // Assert: DOM reflects the new value.
        expect(fixture.componentInstance.value(), 'value should update to a').toBe('a');
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show option a after update').toContain('a');
      });

      it('should handle numeric options', async () => {
        // Arrange: Create component with numeric options.
        const fixture = await arrangeComboBox({ options: [1, 2, 3], value: 2 });

        // Assert: Selected text shows numeric value, options rendered via testids.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show numeric value 2').toContain('2');
        expect(fixture.nativeElement.querySelector('[data-testid="test-combo_1"]'), 'second option should exist').not.toBeNull();
      });

      it('should have disabled class when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeComboBox({ disabled: true });

        // Assert: Disabled class present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.classList.contains('disabled'), 'should have disabled class').toBe(true);
      });

      it('should have invalid class when invalid', async () => {
        // Arrange: Create invalid component.
        const fixture = await arrangeComboBox({ invalid: true });

        // Assert: Invalid class present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.classList.contains('invalid'), 'should have invalid class').toBe(true);
      });

      it('should have both disabled and invalid classes when both inputs are true', async () => {
        // Arrange: Create component with both disabled and invalid.
        const fixture = await arrangeComboBox({ disabled: true, invalid: true });

        // Assert: Both classes present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.classList.contains('disabled'), 'should have disabled class').toBe(true);
        expect(root.classList.contains('invalid'), 'should have invalid class').toBe(true);
      });
    });

    describe('open/close&selection', () => {
      it('should open list on click', async () => {
        // Arrange: Create component with closed list.
        const fixture = await arrangeComboBox();
        expect(fixture.componentInstance.isOpen(), 'list should start closed').toBe(false);

        // Act: Click the combobox.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Assert: List is open and visible.
        expect(fixture.componentInstance.isOpen(), 'list should be open after click').toBe(true);
        const list = fixture.nativeElement.querySelector('.combobox-options');
        expect(list.style.display, 'list should be visible when open').not.toBe('none');
      });

      it('should close list and reset highlight on second click', async () => {
        // Arrange: Create component and open the list.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before second click').toBe(true);

        // Act: Click the combobox again.
        root.click();
        fixture.detectChanges();

        // Assert: List is closed and highlight is reset.
        expect(fixture.componentInstance.isOpen(), 'list should be closed after second click').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should be reset on close').toBe(-1);
      });

      it('should open list on focus', async () => {
        // Arrange: Create component with closed list.
        const fixture = await arrangeComboBox();

        // Act: Focus the combobox.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();

        // Assert: List is open.
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);
        expect(fixture.componentInstance.focusOpened(), 'focus should mark list as focus-opened').toBe(true);
      });

      it('should suppress click after focus opened the list', async () => {
        // Arrange: Create component and open the list via focus.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);

        // Act: Click the already focused combobox (synthetic click after focus).
        root.click();
        fixture.detectChanges();

        // Assert: List stays open, suppression flag cleared.
        expect(fixture.componentInstance.isOpen(), 'click after focus should not close the list').toBe(true);
        expect(fixture.componentInstance.focusOpened(), 'suppression flag should be cleared after click').toBe(false);
      });

      it('should toggle closed when mousedown resets focus suppression', async () => {
        // Arrange: Create component and open the list via focus.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);

        // Act: Real click flow: mousedown then click.
        root.dispatchEvent(new Event('mousedown', { bubbles: true }));
        root.click();
        fixture.detectChanges();

        // Assert: List is closed (mousedown cancelled focus-open suppression, click toggled).
        expect(fixture.componentInstance.isOpen(), 'list should close on real second click').toBe(false);
      });

      it('should select option by click, close list and reset highlight', async () => {
        // Arrange: Create component and open the list.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Act: Click second option.
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_1"]');
        option.click();
        fixture.detectChanges();

        // Assert: Value selected, list closed, highlight reset.
        expect(fixture.componentInstance.value(), 'value should be b after click').toBe('b');
        expect(fixture.componentInstance.isOpen(), 'list should close after selection').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should be reset after selection').toBe(-1);
      });

      it('should set value to null when null option is clicked', async () => {
        // Arrange: Create component with null option and selected value.
        const fixture = await arrangeComboBox({ options: [null, 'a'], value: 'a' });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Act: Click first option (null).
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_0"]');
        option.click();
        fixture.detectChanges();

        // Assert: Value set to null.
        expect(fixture.componentInstance.value(), 'clicking null option should set value to null').toBeNull();
      });

      it('should highlight current value when opening', async () => {
        // Arrange: Create component with selected value present in options.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'b' });

        // Act: Open the list.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Assert: Second option is highlighted and referenced by aria-activedescendant.
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should point to value index').toBe(1);
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_1"]');
        expect(option.classList.contains('highlighted'), 'option with current value should have highlighted class').toBe(true);
        expect(root.getAttribute('aria-activedescendant'), 'aria-activedescendant should reference highlighted option').toBe('test-combo_option_1');
      });

      it('should not emit touch when selecting an option', async () => {
        // Arrange: Create component, open list, spy on touch output.
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Act: Click first option.
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_0"]');
        option.click();
        fixture.detectChanges();

        // Assert: Selection does not count as blur, no touch emitted.
        expect(touchSpy, 'touch should not be emitted on selection').not.toHaveBeenCalled();
      });

      it('should close list and emit touch on blur', async () => {
        // Arrange: Create component, open list, spy on touch output.
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before blur').toBe(true);

        // Act: Simulate blur.
        root.dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        // Assert: List closed, highlight reset, touch emitted.
        expect(fixture.componentInstance.isOpen(), 'list should close on blur').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should be reset on blur').toBe(-1);
        expect(touchSpy, 'touch event should be emitted on blur').toHaveBeenCalledTimes(1);
      });

      it('should not open list on focus when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeComboBox({ disabled: true });

        // Act: Focus the combobox.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();

        // Assert: List stays closed.
        expect(fixture.componentInstance.isOpen(), 'disabled component should not open on focus').toBe(false);
      });

      it('should not open list on click when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeComboBox({ disabled: true });

        // Act: Click the combobox.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Assert: List stays closed.
        expect(fixture.componentInstance.isOpen(), 'disabled component should not open on click').toBe(false);
      });

      it('should not select option when disabled even if list is open', async () => {
        // Arrange: Create disabled component with forced open list (before effect flush).
        const fixture = await arrangeComboBox({ options: ['a', 'b'], value: 'a', disabled: true });
        fixture.componentInstance.isOpen.set(true);

        // Act: Click second option directly.
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_1"]');
        option.click();

        // Assert: Value unchanged (selectOption guard).
        expect(fixture.componentInstance.value(), 'disabled component should not change value').toBe('a');
      });

      it('should still open and select when invalid', async () => {
        // Arrange: Create invalid component.
        const fixture = await arrangeComboBox({ options: ['a', 'b'], invalid: true });

        // Act: Open list and select first option.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'invalid component should open list').toBe(true);
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_0"]');
        option.click();
        fixture.detectChanges();

        // Assert: Value updated and list closed despite invalid state.
        expect(fixture.componentInstance.value(), 'invalid component should still update value').toBe('a');
        expect(fixture.componentInstance.isOpen(), 'list should close after selection').toBe(false);
      });

      it('should close open list when disabled becomes true', async () => {
        // Arrange: Create enabled component and open the list.
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);

        // Act: Open list in combobox.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Assert: List is actually open at this moment.
        expect(fixture.componentInstance.isOpen(), 'list should be open before disabling').toBe(true);

        // Act: Disable component programmatically while list is open.
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: Effect closed the list via hidePanel.
        expect(fixture.componentInstance.isOpen(), 'list should close when component becomes disabled').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should be reset when disabled').toBe(-1);
        expect(touchSpy, 'closing programmatically should not emit touch').toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('accessibility', () => {
    describe('aria', () => {
      it('should have role combobox and aria-haspopup listbox on root', async () => {
        // Arrange: Create component.
        const fixture = await arrangeComboBox();

        // Assert: Combobox roles present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('role'), 'should have combobox role').toBe('combobox');
        expect(root.getAttribute('aria-haspopup'), 'should have listbox popup').toBe('listbox');
      });

      it('should set aria-expanded false when closed and true when open', async () => {
        // Arrange: Create component with closed list.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('aria-expanded'), 'aria-expanded should be false when closed').toBe('false');

        // Act: Open the list.
        root.click();
        fixture.detectChanges();

        // Assert: aria-expanded is true.
        expect(root.getAttribute('aria-expanded'), 'aria-expanded should be true when open').toBe('true');
      });

      it('should link aria-controls to listbox id', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeComboBox({ ident: 'my-combo' });

        // Assert: aria-controls matches listbox element id.
        const root = fixture.nativeElement.querySelector('[data-testid="my-combo"]');
        const list = fixture.nativeElement.querySelector('.combobox-options');
        expect(root.getAttribute('aria-controls'), 'aria-controls should be my-combo_listbox').toBe('my-combo_listbox');
        expect(list.getAttribute('id'), 'listbox id should be my-combo_listbox').toBe('my-combo_listbox');
        expect(root.getAttribute('aria-controls'), 'aria-controls should reference listbox id').toBe(list.getAttribute('id'));
      });

      it('should not set aria-activedescendant when nothing is highlighted', async () => {
        // Arrange: Create component without open list.
        const fixture = await arrangeComboBox();

        // Assert: aria-activedescendant is not present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.hasAttribute('aria-activedescendant'), 'aria-activedescendant should be absent').toBe(false);
      });

      it('should set aria-activedescendant to highlighted option id when open', async () => {
        // Arrange: Create component with selected value.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'b' });

        // Act: Open the list.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Assert: aria-activedescendant references option with matching id.
        expect(root.getAttribute('aria-activedescendant'), 'should reference highlighted option').toBe('test-combo_option_1');
      });

      it('should have role listbox on options container and role option on each option', async () => {
        // Arrange: Create component with three options.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Assert: Listbox and option roles present.
        const list = fixture.nativeElement.querySelector('.combobox-options');
        expect(list.getAttribute('role'), 'container should have listbox role').toBe('listbox');
        const options = fixture.nativeElement.querySelectorAll('.combobox-option');
        expect(options.length, 'should render three options').toBe(3);
        for (const option of options) {
          expect(option.getAttribute('role'), 'each option should have option role').toBe('option');
        }
      });

      it('should set aria-selected true only on selected option', async () => {
        // Arrange: Create component with second option selected.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'b' });

        // Assert: Only second option is aria-selected.
        const options = fixture.nativeElement.querySelectorAll('.combobox-option');
        expect(options[0].getAttribute('aria-selected'), 'first option should not be selected').toBe('false');
        expect(options[1].getAttribute('aria-selected'), 'second option should be selected').toBe('true');
        expect(options[2].getAttribute('aria-selected'), 'third option should not be selected').toBe('false');
      });

      it('should have option ids following ident_option_N pattern', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeComboBox({ ident: 'my-combo' });

        // Assert: Each option has the expected id.
        const options = fixture.nativeElement.querySelectorAll('.combobox-option');
        expect(options[0].getAttribute('id'), 'first option id should follow pattern').toBe('my-combo_option_0');
        expect(options[1].getAttribute('id'), 'second option id should follow pattern').toBe('my-combo_option_1');
        expect(options[2].getAttribute('id'), 'third option id should follow pattern').toBe('my-combo_option_2');
      });

      it('should have hidden button with id for label association', async () => {
        // Arrange: Create component with custom id.
        const fixture = await arrangeComboBox({ ident: 'my-combo' });

        // Assert: Hidden button with matching id exists.
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        expect(hiddenButton, 'should render hidden button for label association').not.toBeNull();
        expect(hiddenButton.getAttribute('id'), 'hidden button id should match component id').toBe('my-combo');
        expect(hiddenButton.getAttribute('tabindex'), 'hidden button should not be focusable').toBe('-1');
        expect(hiddenButton.getAttribute('aria-hidden'), 'hidden button should be hidden from assistive technology').toBe('true');
      });

      it('should set aria-labelledby when label is provided', async () => {
        // Arrange: Create component with label input.
        const fixture = await arrangeComboBox({ label: 'my-label' });

        // Assert: aria-labelledby matches label input.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('aria-labelledby'), 'aria-labelledby should match label input').toBe('my-label');
      });

      it('should not set aria-labelledby when label is empty', async () => {
        // Arrange: Create component without label input.
        const fixture = await arrangeComboBox();

        // Assert: aria-labelledby is not present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.hasAttribute('aria-labelledby'), 'aria-labelledby should not be set when label is empty').toBe(false);
      });

      it('should set aria-required when required is true', async () => {
        // Arrange: Create required component.
        const fixture = await arrangeComboBox({ required: true });

        // Assert: aria-required is true.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('aria-required'), 'aria-required should be true when required').toBe('true');
      });

      it('should not set aria-required when required is false', async () => {
        // Arrange: Create component without required.
        const fixture = await arrangeComboBox();

        // Assert: aria-required is not present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.hasAttribute('aria-required'), 'aria-required should not be set when not required').toBe(false);
      });

      it('should set aria-invalid when invalid is true', async () => {
        // Arrange: Create invalid component.
        const fixture = await arrangeComboBox({ invalid: true });

        // Assert: aria-invalid is true.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('aria-invalid'), 'aria-invalid should be true when invalid').toBe('true');
      });

      it('should not set aria-invalid when invalid is false', async () => {
        // Arrange: Create component without invalid.
        const fixture = await arrangeComboBox();

        // Assert: aria-invalid is not present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.hasAttribute('aria-invalid'), 'aria-invalid should not be set when not invalid').toBe(false);
      });

      it('should set aria-disabled when disabled is true', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeComboBox({ disabled: true });

        // Assert: aria-disabled is true.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('aria-disabled'), 'aria-disabled should be true when disabled').toBe('true');
      });

      it('should not set aria-disabled when disabled is false', async () => {
        // Arrange: Create component without disabled.
        const fixture = await arrangeComboBox();

        // Assert: aria-disabled is not present.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.hasAttribute('aria-disabled'), 'aria-disabled should not be set when not disabled').toBe(false);
      });

      it('should have tabindex 0 when enabled', async () => {
        // Arrange: Create enabled component.
        const fixture = await arrangeComboBox();

        // Assert: Tabindex is 0.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('tabindex'), 'enabled combobox should have tabindex 0').toBe('0');
      });

      it('should have tabindex -1 when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeComboBox({ disabled: true });

        // Assert: Tabindex is -1.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        expect(root.getAttribute('tabindex'), 'disabled combobox should have tabindex -1').toBe('-1');
      });

      it('should not be able to focus options with Tab (options have tabindex -1)', async () => {
        // Arrange: Create component with options.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Assert: Options are not tab stops (highlight uses aria-activedescendant on root).
        const options = fixture.nativeElement.querySelectorAll('.combobox-option');
        expect(options.length, 'should render three options').toBe(3);
        for (const option of options) {
          expect(option.getAttribute('tabindex'), 'option should not be a tab stop').toBe('-1');
        }
      });

      it('should set data-testid from ident on root and options', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeComboBox({ ident: 'my-combo' });

        // Assert: Root and options have expected testids.
        expect(fixture.nativeElement.querySelector('[data-testid="my-combo"]'), 'root should use ident as data-testid').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="my-combo_0"]'), 'first option should use ident_index data-testid').not.toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="my-combo_2"]'), 'third option should use ident_index data-testid').not.toBeNull();
      });
    });

    describe('keyboard', () => {
      it('should open list and highlight first option on ArrowDown when closed', async () => {
        // Arrange: Create component with closed list and user event setup.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Act: Focus combobox and press ArrowDown.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.componentInstance.isOpen.set(false);
        fixture.componentInstance.focusOpened.set(false);
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List open, first option highlighted.
        expect(fixture.componentInstance.isOpen(), 'ArrowDown should open closed list').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'ArrowDown should highlight first option').toBe(0);
      });

      it('should prefer highlighting current value on ArrowDown when closed', async () => {
        // Arrange: Create component with selected value in options.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'b' });

        // Act: Focus combobox and press ArrowDown.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.componentInstance.isOpen.set(false);
        fixture.componentInstance.focusOpened.set(false);
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight points to current value, not first option.
        expect(fixture.componentInstance.isOpen(), 'ArrowDown should open list').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should prefer current value').toBe(1);
      });

      it('should move highlight down with wraparound on ArrowDown when open', async () => {
        // Arrange: Create component with open list, highlight on last option.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(2);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press ArrowDown from last option.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight wrapped to first option.
        expect(fixture.componentInstance.highlightedIndex(), 'ArrowDown from last should wrap to first').toBe(0);
      });

      it('should open list highlighting last option on ArrowUp when closed', async () => {
        // Arrange: Create component with closed list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.componentInstance.isOpen.set(false);
        fixture.componentInstance.focusOpened.set(false);

        // Act: Press ArrowUp.
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List open, last option highlighted.
        expect(fixture.componentInstance.isOpen(), 'ArrowUp should open closed list').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'ArrowUp should highlight last option').toBe(2);
      });

      it('should move highlight up with wraparound on ArrowUp when open', async () => {
        // Arrange: Create component with open list, highlight on first option.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(0);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press ArrowUp from first option.
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight wrapped to last option.
        expect(fixture.componentInstance.highlightedIndex(), 'ArrowUp from first should wrap to last').toBe(2);
      });

      it('should open list on Enter when closed', async () => {
        // Arrange: Create component with closed list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.componentInstance.isOpen.set(false);
        fixture.componentInstance.focusOpened.set(false);

        // Act: Press Enter.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List is open.
        expect(fixture.componentInstance.isOpen(), 'Enter should open closed list').toBe(true);
      });

      it('should select highlighted option and close list on Enter when open', async () => {
        // Arrange: Create component with open list and highlighted option.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(1);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press Enter.
        await user.keyboard('{Enter}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Second option selected, list closed.
        expect(fixture.componentInstance.value(), 'Enter should select highlighted option').toBe('b');
        expect(fixture.componentInstance.isOpen(), 'list should close after Enter selection').toBe(false);
      });

      it('should select highlighted option and close list on Space when open', async () => {
        // Arrange: Create component with open list and highlighted option.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(2);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press Space.
        await user.keyboard(' ');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Third option selected, list closed.
        expect(fixture.componentInstance.value(), 'Space should select highlighted option').toBe('c');
        expect(fixture.componentInstance.isOpen(), 'list should close after Space selection').toBe(false);
      });

      it('should close list and emit touch on Escape', async () => {
        // Arrange: Create component and spy on touch output.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);

        // Act: Set up component.
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(0);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press Escape. Note that it closes list, but we are still focused on combobox (no blur).
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List closed, highlight reset, touch emitted.
        expect(fixture.componentInstance.isOpen(), 'Escape should close the list').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'Escape should reset highlight').toBe(-1);
        expect(touchSpy, 'touch event should not be emitted on Escape').toHaveBeenCalledTimes(0);
      });

      it('should not respond to arrows, Enter or Space when disabled', async () => {
        // Arrange: Create disabled component with forced open list and user event setup.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'a', disabled: true });
        fixture.componentInstance.isOpen.set(true);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press ArrowDown, Enter and Space.
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{Enter}');
        await user.keyboard(' ');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Value unchanged, highlight unchanged.
        expect(fixture.componentInstance.value(), 'disabled component should not change value via keyboard').toBe('a');
        expect(fixture.componentInstance.highlightedIndex(), 'disabled component should not move highlight').toBe(-1);
      });

      it('should close list and move focus to next control on Tab when open', async () => {
        // Arrange: Create component with open list and a focusable control after it (simulates next component).
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before Tab').toBe(true);

        // Act: Press Tab.
        await user.tab();
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List closed via blur, focus moved out of combobox.
        expect(fixture.componentInstance.isOpen(), 'Tab should close the list via blur').toBe(false);
        expect(document.activeElement, 'Tab should move focus to next control').toBe(nextControl);
        nextControl.remove();
      });
    });
  });
});
