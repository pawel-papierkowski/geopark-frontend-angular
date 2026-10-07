import { TestBed, type ComponentFixture } from '@angular/core/testing';
import userEvent from '@testing-library/user-event';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { registerLabelPreventionTests, registerOutsidePressTests, type OutsidePressDriver } from '@/shared/ui/components/form/popup-panel/testing/label-guard-tests';
import { dispatchMousedown } from '@/shared/ui/components/form/popup-panel/testing/mouse';
import { installViewportStub, panelRect, registerPositioningTests, uninstallViewportStub, type PositioningDriver } from '@/shared/ui/components/form/popup-panel/testing/positioning-tests';

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

  beforeAll(() => {
    // Pin the viewport dimensions (always 0 without layout) shared by the positioning suite.
    installViewportStub();
  });

  afterAll(() => {
    uninstallViewportStub();
  });

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

      it('should show raw value when value is not in options', async () => {
        // Arrange: Create component with value not present among options and placeholder set.
        const fixture = await arrangeComboBox({ options: ['a', 'b'], value: 'ghost', placeholder: 'pick one' });

        // Assert: Raw value shown, placeholder not used.
        const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
        expect(selected.textContent, 'should show raw value even when not in options').toContain('ghost');
        expect(selected.textContent, 'placeholder is only for null value').not.toContain('pick one');
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
      });

      it('should suppress click after focus opened the list', async () => {
        // Arrange: Create component and open the list via focus.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);

        // Act: Click the already focused combobox (synthetic click after focus), then click again.
        root.click();
        fixture.detectChanges();

        // Assert: First click is suppressed, list stays open.
        expect(fixture.componentInstance.isOpen(), 'click after focus should not close the list').toBe(true);

        // Act: Second synthetic click - the first click consumed the focus-open suppression,
        // so this one must toggle instead of being swallowed.
        root.click();
        fixture.detectChanges();

        // Assert: List closed, proving the first click cleared the suppression flag.
        expect(fixture.componentInstance.isOpen(), 'suppression should be cleared after the first click').toBe(false);
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

      it('should open list when hidden button (label target) is clicked', async () => {
        // Arrange: Create component with closed list.
        const fixture = await arrangeComboBox();
        expect(fixture.componentInstance.isOpen(), 'list should start closed').toBe(false);

        // Act: Click hidden button; label activation forwards click here, which bubbles to combobox.
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        hiddenButton.click();
        fixture.detectChanges();

        // Assert: List is open.
        expect(fixture.componentInstance.isOpen(), 'click on hidden button should open the list').toBe(true);
      });

      it('should move focus to root when hidden button (label target) is clicked', async () => {
        // Arrange: Create component with closed list.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');

        // Act: Click hidden button (label activation target).
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        hiddenButton.click();
        fixture.detectChanges();

        // Assert: Focus was redirected to the combobox root, list is open.
        expect(document.activeElement, 'focus should move from hidden button to root').toBe(root);
        expect(fixture.componentInstance.isOpen(), 'list should be open after label-target click').toBe(true);
      });

      it('should redirect focus to root when hidden button receives focus directly', async () => {
        // Arrange: Create component with closed list.
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');

        // Act: Focus hidden button programmatically (as label activation does).
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        hiddenButton.focus();
        fixture.detectChanges();

        // Assert: Focus was redirected to root and list opened via focus handler.
        expect(document.activeElement, 'focus should be redirected to root').toBe(root);
        expect(fixture.componentInstance.isOpen(), 'redirected focus should open the list').toBe(true);
      });

      it('should keep list open and not emit touch on internal focus move to hidden button', async () => {
        // Arrange: Create component, open list via focus, spy on touch output.
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);

        // Act: Simulate root blur caused by label activation moving focus to hidden button inside root.
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        root.dispatchEvent(new FocusEvent('blur', { relatedTarget: hiddenButton }));
        fixture.detectChanges();

        // Assert: Internal focus move is not a real blur.
        expect(fixture.componentInstance.isOpen(), 'internal focus move should keep list open').toBe(true);
        expect(touchSpy, 'internal focus move should not emit touch').not.toHaveBeenCalled();
      });

      it('should toggle list closed on second hidden button click', async () => {
        // Arrange: Create component and open list via first label-target click.
        const fixture = await arrangeComboBox();
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        hiddenButton.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'first label-target click should open list').toBe(true);

        // Act: Click hidden button again (second label activation).
        hiddenButton.click();
        fixture.detectChanges();

        // Assert: List is closed (toggle behavior preserved).
        expect(fixture.componentInstance.isOpen(), 'second label-target click should close list').toBe(false);
      });

      it('should keep list closed when the forwarded click runs before the hidden button focus', async () => {
        // Arrange: Create component and open list via first label-target click.
        const fixture = await arrangeComboBox();
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        hiddenButton.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before second activation').toBe(true);

        // Act: Engines disagree on label activation order - WebKit forwards the click FIRST
        // (the click toggles the list closed) and only then focuses the hidden button, whose
        // focus redirect runs back into the root's focus handler.
        hiddenButton.click();
        hiddenButton.focus();
        fixture.detectChanges();

        // Assert: List stays closed - the focus must not read the just-closed list as a fresh
        // focus-opened activation and reopen it.
        expect(fixture.componentInstance.isOpen(), 'focus after the closing click must not reopen the list').toBe(false);
      });

      it('should not move focus or open list on hidden button click when disabled', async () => {
        // Arrange: Create disabled component.
        const fixture = await arrangeComboBox({ disabled: true });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');

        // Act: Click hidden button.
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        hiddenButton.click();
        fixture.detectChanges();

        // Assert: Focus not moved, list stays closed.
        expect(document.activeElement, 'disabled component should not take focus via label target').not.toBe(root);
        expect(fixture.componentInstance.isOpen(), 'disabled component should not open via label target').toBe(false);
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

      it('should highlight option under mouse pointer', async () => {
        // Arrange: Create component and open the list.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();

        // Act: Hover third option.
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_2"]');
        option.dispatchEvent(new MouseEvent('mouseenter'));
        fixture.detectChanges();

        // Assert: Hovered option is highlighted and referenced by aria-activedescendant.
        expect(fixture.componentInstance.highlightedIndex(), 'hover should highlight third option').toBe(2);
        expect(root.getAttribute('aria-activedescendant'), 'aria-activedescendant should reference hovered option').toBe('test-combo_option_2');
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

      it('should emit touch on blur even when list is already closed by selection', async () => {
        // Arrange: Create component, select an option (closes list without touch).
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_0"]');
        option.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'selection should close the list').toBe(false);
        expect(touchSpy, 'selection alone should not emit touch').not.toHaveBeenCalled();

        // Act: Simulate blur after leaving the component.
        root.dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        // Assert: Blur marks field touched even though list was already closed.
        expect(touchSpy, 'blur after selection should emit touch').toHaveBeenCalledTimes(1);
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

      it('should not emit touch on blur after the component became disabled', async () => {
        // Arrange: Enabled component with open list and touch spy.
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before disabling').toBe(true);

        // Act: Disable while focused (the effect closes the list), then focus leaves the root.
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        root.dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        // Assert: Losing focus after a programmatic close is not a user blur - no touch.
        expect(touchSpy, 'blur after disabling must not report touch').not.toHaveBeenCalled();
      });

      it('should clamp a stale highlight when options shrink while the list is open', async () => {
        // Arrange: Open list with the last option selected (highlight on the last index).
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'c' });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should start on the last option').toBe(2);

        // Act: Options shrink to a single entry while the list stays open.
        fixture.componentRef.setInput('options', ['a']);
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: Highlight clamped to the new last index and aria-activedescendant stays valid.
        expect(fixture.componentInstance.highlightedIndex(), 'stale highlight should clamp to the new last option').toBe(0);
        expect(root.getAttribute('aria-activedescendant'), 'aria-activedescendant must reference an existing option').toBe('test-combo_option_0');

        // Act: Enter selects through the clamped index.
        root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        fixture.detectChanges();

        // Assert: The remaining option is selected - without clamping the stale index would
        // resolve to undefined and select null.
        expect(fixture.componentInstance.value(), 'Enter after shrinking should select the remaining option').toBe('a');
      });

      it('should clear the highlight when options become empty while the list is open', async () => {
        // Arrange: Open list with the last option selected.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'c' });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should start on the last option').toBe(2);

        // Act: All options are removed while the list stays open.
        fixture.componentRef.setInput('options', []);
        fixture.detectChanges();
        await fixture.whenStable();

        // Assert: No dangling highlight or aria reference remains.
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should clear without options').toBe(-1);
        expect(root.hasAttribute('aria-activedescendant'), 'aria-activedescendant must not dangle').toBe(false);
      });
    });

    describe('outside press', () => {
      /**
       * Open the options list with a direct click on the combobox root.
       * @param fixture Fixture of the component under test.
       * @returns The root element of the combobox.
       */
      function openList(fixture: ComponentFixture<ComboBox>): HTMLElement {
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before act').toBe(true);
        return root;
      }

      const driver: OutsidePressDriver = {
        popup: 'list',
        subject: 'component',
        touchSource: 'blur',
        ident: 'test-combo',
        arrange: async () => {
          const fixture = await arrangeComboBox();
          return {
            open: async () => {
              openList(fixture);
            },
            isOpen: () => fixture.componentInstance.isOpen(),
            trackTouch: () => {
              const touchSpy = vi.fn();
              fixture.componentInstance.touch.subscribe(touchSpy);
              return touchSpy;
            },
            settle: async () => {
              fixture.detectChanges();
            },
            destroy: () => fixture.destroy(),
            assertClosedExtras: () => {
              expect(fixture.componentInstance.highlightedIndex(), 'highlight should be reset on outside close').toBe(-1);
            },
          };
        },
      };
      registerOutsidePressTests(driver);

      it('should keep list open when mousedown lands inside the component', async () => {
        // Arrange: Create component with open list.
        const fixture = await arrangeComboBox();
        const root = openList(fixture);

        // Act: Press the combobox root (its own mousedown handler runs as well).
        dispatchMousedown(root);
        fixture.detectChanges();

        // Assert: Root press must not close - it toggles through the subsequent click.
        expect(fixture.componentInstance.isOpen(), 'mousedown on the root should keep the list open').toBe(true);

        // Act: Press an option inside the open list (option handler cancels its default).
        dispatchMousedown(fixture.nativeElement.querySelector('[data-testid="test-combo_1"]'));
        fixture.detectChanges();

        // Assert: Option press must not close either - it selects through the subsequent click.
        expect(fixture.componentInstance.isOpen(), 'mousedown on an option should keep the list open').toBe(true);
      });
    });

    describe('positioning', () => {
      /**
       * Get the options list popup of given fixture.
       * @param fixture Fixture of the component.
       * @returns Options list element.
       */
      function getList(fixture: ComponentFixture<ComboBox>): HTMLElement {
        return fixture.nativeElement.querySelector('.combobox-options');
      }

      /**
       * Toggle the list with a click on the combobox root and flush pending component work.
       * Placement is resolved asynchronously after render, hence the stability flushes.
       * @param fixture Fixture of the component.
       */
      async function toggleList(fixture: ComponentFixture<ComboBox>): Promise<void> {
        fixture.nativeElement.querySelector('[data-testid="test-combo"]').click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      }

      /** Driver wiring the shared positioning suite to ComboBox. */
      const positioningDriver: PositioningDriver = {
        popup: 'list',
        subject: 'anchor',
        fittedRight: '0px',
        fittedPhrase: 'stay stretched to the anchor when it fits horizontally',
        arrange: async () => {
          const fixture = await arrangeComboBox();
          return {
            popup: () => getList(fixture),
            open: () => toggleList(fixture),
            close: () => toggleList(fixture),
            stubAnchor: (top) => {
              const anchor = fixture.nativeElement.querySelector('.combobox');
              vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
            },
          };
        },
      };

      it('should keep baseline placement when list fits into the viewport', async () => {
        // Arrange: Create component and stub list geometry to fit on both axes.
        const fixture = await arrangeComboBox();
        const list = getList(fixture);
        vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(panelRect());

        // Act: Open the list (placement is resolved after render).
        await toggleList(fixture);

        // Assert: List keeps the baseline (CSSOM normalizes unitless zero to pixels).
        expect(list.style.top, 'list should stay below the anchor when it fits vertically').toBe('100%');
        expect(list.style.bottom, 'list should stay below the anchor when it fits vertically').toBe('auto');
        expect(list.style.left, 'list should stay stretched to the anchor when it fits horizontally').toBe('0px');
        expect(list.style.right, 'list should stay stretched to the anchor when it fits horizontally').toBe('0px');
      });

      registerPositioningTests(positioningDriver);
    });

    describe('scrolling', () => {
      /** Eight options - enough to overflow any viewport used by these tests. */
      const eightOptions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

      /**
       * Get the options list popup of given fixture.
       * @param fixture Fixture of the component.
       * @returns Options list element.
       */
      function getList(fixture: ComponentFixture<ComboBox>): HTMLElement {
        return fixture.nativeElement.querySelector('.combobox-options');
      }

      /**
       * Get the combobox root of given fixture.
       * @param fixture Fixture of the component.
       * @returns Root element of the combobox.
       */
      function getRoot(fixture: ComponentFixture<ComboBox>): HTMLElement {
        return fixture.nativeElement.querySelector('[data-testid="test-combo"]');
      }

      /**
       * Open the list with a click and flush the async work (placement resolve and the
       * highlight reveal both settle after the next render).
       * @param fixture Fixture of the component.
       */
      async function openList(fixture: ComponentFixture<ComboBox>): Promise<void> {
        getRoot(fixture).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
      }

      /**
       * Stub the geometry jsdom cannot produce (no layout): the list viewport (its rect plus
       * the visible height) and every option's rect as if the content were laid out from the
       * top of an unscrolled list. The list rect doubles as the panel rect the placement
       * resolve measures, so it is a fitting `panelRect()` with an overridden top.
       * @param fixture Fixture of the component.
       * @param viewportHeight Visible height of the list viewport in px.
       * @param optionHeight Rendered height of a single option in px.
       */
      function stubListGeometry(fixture: ComponentFixture<ComboBox>, viewportHeight: number, optionHeight: number): void {
        const list = getList(fixture);
        vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(panelRect({ top: 100 }));
        Object.defineProperty(list, 'clientHeight', { value: viewportHeight, configurable: true });
        const options = fixture.nativeElement.querySelectorAll('.combobox-option');
        options.forEach((option: Element, index: number) => {
          vi.spyOn(option, 'getBoundingClientRect').mockReturnValue({ top: 100 + index * optionHeight, height: optionHeight } as DOMRect);
        });
      }

      it('should scroll the list to reveal the selected option on open', async () => {
        // Arrange: Eight 20px options in a 60px viewport; the last option (top 140, bottom 160)
        // lies below the fold of an unscrolled list.
        const fixture = await arrangeComboBox({ options: eightOptions, value: 'h' });
        stubListGeometry(fixture, 60, 20);

        // Act: Open the list (click seeds the highlight with the current value).
        await openList(fixture);

        // Assert: The list scrolled so the option's bottom (160) sits on the viewport bottom: 160 - 60 = 100.
        expect(getList(fixture).scrollTop, 'list should scroll to reveal the selected option').toBe(100);
      });

      it('should scroll to the highlighted option when navigating with End', async () => {
        // Arrange: Open list without a selection (nothing highlighted, starts unscrolled).
        const fixture = await arrangeComboBox({ options: eightOptions });
        stubListGeometry(fixture, 60, 20);
        await openList(fixture);
        expect(getList(fixture).scrollTop, 'list without a highlight should start unscrolled').toBe(0);

        // Act: End highlights the last option.
        getRoot(fixture).focus();
        await userEvent.setup().keyboard('{End}');
        fixture.detectChanges();

        // Assert: Option 7 (bottom 160) is scrolled into the 60px viewport: 160 - 60 = 100.
        expect(getList(fixture).scrollTop, 'list should scroll to the option highlighted by End').toBe(100);
      });

      it('should discard a stale scroll position when the list reopens', async () => {
        // Arrange: Open once and leave the list scrolled somewhere.
        const fixture = await arrangeComboBox({ options: eightOptions });
        stubListGeometry(fixture, 60, 20);
        await openList(fixture);
        getList(fixture).scrollTop = 123;

        // Act: Close and reopen (no selection, so nothing is revealed).
        getRoot(fixture).click();
        fixture.detectChanges();
        await openList(fixture);

        // Assert: The stale offset is gone - the reopened list starts at the top.
        expect(getList(fixture).scrollTop, 'reopen should reset a stale scroll position').toBe(0);
      });
    });
  });

  describe('focus', () => {
    it('should focus the root and open the list (FormUiControl.focus contract)', async () => {
      // Arrange: Enabled component with a closed list; focus() is the optional
      // FormUiControl.focus contract used by the signal-forms Field directive.
      const fixture = await arrangeComboBox();
      const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');

      // Act: Focus the control programmatically.
      fixture.componentInstance.focus();
      fixture.detectChanges();

      // Assert: Focus landed on the root (the aria-activedescendant owner) and its focus
      // handler opened the list, exactly like Tab does.
      expect(document.activeElement, 'focus() should move DOM focus to the combobox root').toBe(root);
      expect(root.getAttribute('aria-expanded'), 'focus() should open the list via the focus handler').toBe('true');
    });

    it('should be a no-op when disabled', async () => {
      // Arrange: Disabled component.
      const fixture = await arrangeComboBox({ disabled: true });
      const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');

      // Act: Focus the disabled control.
      fixture.componentInstance.focus();
      fixture.detectChanges();

      // Assert: Neither focus nor the list reacts.
      expect(document.activeElement, 'focus() must not focus a disabled control').not.toBe(root);
      expect(root.getAttribute('aria-expanded'), 'focus() must not open the list when disabled').toBe('false');
    });

    it('should forward the given focus options in a single focus call', async () => {
      // Arrange: Enabled component; the spy replaces the real focus, so this test asserts
      // option forwarding only (the open-on-focus path is covered by the first test).
      const fixture = await arrangeComboBox();
      const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
      const focusSpy = vi.spyOn(root, 'focus');

      // Act: Invoke the FormUiControl.focus contract with preventScroll.
      fixture.componentInstance.focus({ preventScroll: true });

      // Assert: Exactly one focus call, and it carries the caller's options.
      expect(focusSpy, 'focus() must focus the root in a single call').toHaveBeenCalledTimes(1);
      expect(focusSpy, 'focus() should pass the given options through to the root').toHaveBeenCalledWith({ preventScroll: true });
    });
  });

  describe('i18n', () => {
    it('should update placeholder and option labels on language switch', async () => {
      // Arrange: Create component with langPrefix and register English translations.
      const fixture = await arrangeComboBox({ value: null, options: ['a', 'b'], langPrefix: 'test.options', placeholder: 'test.pick' });
      const translateService = TestBed.inject(TranslateService);
      translateService.setTranslation('en', { test: { pick: 'Please pick', options: { a: 'Option A', b: 'Option B' } } });
      translateService.setTranslation('pl', { test: { pick: 'Wybierz opcję', options: { a: 'Opcja A', b: 'Opcja B' } } });
      
      await firstValueFrom(translateService.use('en'));
      await fixture.whenStable();
      const selected = fixture.nativeElement.querySelector('.combobox-selected-text');
      expect(selected.textContent, 'precondition: placeholder should show English text').toContain('Please pick');

      // Act: Activate Polish while the component is alive; no manual detectChanges,
      // so only a scheduler-driven refresh can update the DOM.
      await firstValueFrom(translateService.use('pl'));
      await fixture.whenStable();

      // Assert: Placeholder and option labels follow the language switch.
      expect(selected.textContent, 'placeholder should switch to Polish text').toContain('Wybierz opcję');
      const firstOption = fixture.nativeElement.querySelector('[data-testid="test-combo_0"]');
      expect(firstOption.textContent, 'first option label should switch to Polish text').toContain('Opcja A');
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

      it('should have role listbox with vertical orientation on options container and role option on each option', async () => {
        // Arrange: Create component with three options.
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Assert: Listbox declares vertical orientation (matches Up/Down navigation) and option
        // roles present.
        const list = fixture.nativeElement.querySelector('.combobox-options');
        expect(list.getAttribute('role'), 'container should have listbox role').toBe('listbox');
        expect(list.getAttribute('aria-orientation'), 'container should declare vertical orientation').toBe('vertical');
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

      it('should generate ids following combo-box-N pattern when ident is empty', async () => {
        // Arrange: Create component with empty ident (same state as ident not provided).
        const fixture = await arrangeComboBox({ ident: '' });

        // Assert: Generated ident is used consistently for root, listbox and options.
        const root = fixture.nativeElement.querySelector('.combobox');
        const ident = root.getAttribute('data-testid');
        expect(ident, 'generated ident should follow combo-box-N pattern').toMatch(/^combo-box-\d+$/);
        const list = fixture.nativeElement.querySelector('.combobox-options');
        expect(list.getAttribute('id'), 'listbox id should be based on generated ident').toBe(`${ident}_listbox`);
        expect(root.getAttribute('aria-controls'), 'aria-controls should use generated ident').toBe(`${ident}_listbox`);
        const options = fixture.nativeElement.querySelectorAll('.combobox-option');
        expect(options[0].getAttribute('id'), 'option id should be based on generated ident').toBe(`${ident}_option_0`);
        const hiddenButton = fixture.nativeElement.querySelector('button.hidden-label-button');
        expect(hiddenButton.getAttribute('id'), 'hidden button id should use generated ident').toBe(ident);
      });

      it('should generate different ids for components created without ident', async () => {
        // Arrange: Create two components without ident within same test module.
        const first = await arrangeComboBox({ ident: '' });
        const second = TestBed.createComponent(ComboBox);
        second.componentRef.setInput('options', ['a', 'b', 'c']);
        second.detectChanges();
        await second.whenStable();

        // Assert: Each component instance gets its own generated ident.
        const firstIdent = first.nativeElement.querySelector('.combobox').getAttribute('data-testid');
        const secondIdent = second.nativeElement.querySelector('.combobox').getAttribute('data-testid');
        expect(secondIdent, 'second component should get different generated ident').not.toBe(firstIdent);
      });

      it('should expose provided ident via resolvedIdent', async () => {
        // Arrange: Create component with custom ident.
        const fixture = await arrangeComboBox({ ident: 'my-combo' });

        // Assert: resolvedIdent mirrors ident.
        expect(fixture.componentInstance.resolvedIdent(), 'resolvedIdent should mirror ident').toBe('my-combo');
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

    describe('label', () => {
      registerLabelPreventionTests({
        ident: 'test-combo',
        arrange: async (ident) => {
          const fixture = await arrangeComboBox(ident === undefined ? {} : { ident });
          return { destroy: () => fixture.destroy() };
        },
      });

      it('should warn in dev mode when the label id matches no element', async () => {
        // Arrange: Spy on console.warn; label reference deliberately left dangling.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          // Act: Create the component - its dev-only effect checks the reference on first CD.
          await arrangeComboBox({ label: 'ghost-label' });

          // Assert: The dangling id is reported, naming this component.
          const messages = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
          expect(messages, 'dangling label id should be reported in dev mode').toContain('ghost-label');
          expect(messages, 'warning should name the emitting component').toContain('[combo-box]');
        } finally { // cleanup
          warnSpy.mockRestore();
        }
      });

      it('should not warn when the label id resolves to an element', async () => {
        // Arrange: Spy on console.warn; a real element carries the referenced id.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const labelElement = document.createElement('label');
        labelElement.id = 'real-label';
        document.body.appendChild(labelElement);

        try {
          // Act: Create the component - its dev-only effect checks the reference on first CD.
          await arrangeComboBox({ label: 'real-label' });

          // Assert: Resolvable reference is not a defect.
          const messages = warnSpy.mock.calls.map(call => String(call[0])).join('\n');
          expect(messages, 'resolvable label id must not warn').not.toContain('[combo-box]');
        } finally { // cleanup
          labelElement.remove();
          warnSpy.mockRestore();
        }
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
        // Close the list that focus just opened; Escape also clears the focus-open suppression.
        await user.keyboard('{Escape}');
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
        // Close the list that focus just opened; Escape also clears the focus-open suppression.
        await user.keyboard('{Escape}');
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

      it('should move highlight to first option on ArrowDown when open and nothing highlighted', async () => {
        // Arrange: Create component with value not in options and open list (nothing highlighted).
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'ghost' });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'value not in options leaves nothing highlighted').toBe(-1);

        // Act: Press ArrowDown.
        await user.keyboard('{ArrowDown}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight points to first option.
        expect(fixture.componentInstance.highlightedIndex(), 'ArrowDown from no highlight should point to first option').toBe(0);
      });

      it('should advance highlight exactly once when a keydown is dispatched on an option', async () => {
        // Arrange: Component with open list and nothing highlighted (value null not among options).
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open before act').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'nothing should be highlighted before act').toBe(-1);

        // Act: ArrowDown dispatched on an option element - it bubbles to the root, so the
        // root's keydown handler must be the only one handling it.
        const option = fixture.nativeElement.querySelector('[data-testid="test-combo_1"]');
        option.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();

        // Assert: Highlight advanced from -1 exactly one step (to 0), not two (to 1) - double
        // handling would run once on the option and once again on the root after bubbling.
        expect(fixture.componentInstance.highlightedIndex(), 'bubbled ArrowDown must be handled exactly once').toBe(0);
        expect(root.getAttribute('aria-activedescendant'), 'aria-activedescendant should reference the single-step result').toBe('test-combo_option_0');
      });

      it('should open list highlighting last option on ArrowUp when closed', async () => {
        // Arrange: Create component with closed list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        // Close the list that focus just opened; Escape also clears the focus-open suppression.
        await user.keyboard('{Escape}');

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

      it('should move highlight to last option on ArrowUp when open and nothing highlighted', async () => {
        // Arrange: Create component with value not in options and open list (nothing highlighted).
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'], value: 'ghost' });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'value not in options leaves nothing highlighted').toBe(-1);

        // Act: Press ArrowUp.
        await user.keyboard('{ArrowUp}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight points to last option.
        expect(fixture.componentInstance.highlightedIndex(), 'ArrowUp from no highlight should point to last option').toBe(2);
      });

      it('should open list and highlight first option on Home when closed', async () => {
        // Arrange: Create component with closed list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        // Close the list that focus just opened; Escape also clears the focus-open suppression.
        await user.keyboard('{Escape}');

        // Act: Press Home.
        await user.keyboard('{Home}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List open, first option highlighted.
        expect(fixture.componentInstance.isOpen(), 'Home should open closed list').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'Home should highlight first option').toBe(0);
      });

      it('should move highlight to first option on Home when open', async () => {
        // Arrange: Create component with open list, highlight on last option.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(2);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press Home.
        await user.keyboard('{Home}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight points to first option.
        expect(fixture.componentInstance.highlightedIndex(), 'Home should highlight first option').toBe(0);
      });

      it('should open list and highlight last option on End when closed', async () => {
        // Arrange: Create component with closed list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        // Close the list that focus just opened; Escape also clears the focus-open suppression.
        await user.keyboard('{Escape}');

        // Act: Press End.
        await user.keyboard('{End}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: List open, last option highlighted.
        expect(fixture.componentInstance.isOpen(), 'End should open closed list').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'End should highlight last option').toBe(2);
      });

      it('should move highlight to last option on End when open', async () => {
        // Arrange: Create component with open list, highlight on first option.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });
        fixture.componentInstance.isOpen.set(true);
        fixture.componentInstance.highlightedIndex.set(0);
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();

        // Act: Press End.
        await user.keyboard('{End}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight points to last option.
        expect(fixture.componentInstance.highlightedIndex(), 'End should highlight last option').toBe(2);
      });

      it('should open list on Enter when closed', async () => {
        // Arrange: Create component with closed list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox();
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        // Close the list that focus just opened; Escape also clears the focus-open suppression.
        await user.keyboard('{Escape}');

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

      it('should close list on Escape without emitting touch', async () => {
        // Arrange: Create component, open list, spy on touch output.
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

        // Assert: List closed, highlight reset, no touch (focus stays in component; blur emits later).
        expect(fixture.componentInstance.isOpen(), 'Escape should close the list').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'Escape should reset highlight').toBe(-1);
        expect(touchSpy, 'touch should not be emitted on Escape').toHaveBeenCalledTimes(0);
      });

      it('should do nothing on Escape when list is already closed', async () => {
        // Arrange: Create component, open list via focus, close it with first Escape.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox();
        const touchSpy = vi.fn();
        fixture.componentInstance.touch.subscribe(touchSpy);

        // Act: Open list.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();

        // Assert: List is actually opened.
        expect(fixture.componentInstance.isOpen(), 'list should be open after focus').toBe(true);

        // Act: Press Escape for first time.
        await user.keyboard('{Escape}');
        fixture.detectChanges();

        // Assert: List is actually closed.
        expect(fixture.componentInstance.isOpen(), 'first Escape should close the list').toBe(false);

        // Act: Press Escape again while already closed.
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: State unchanged, no touch emitted.
        expect(fixture.componentInstance.isOpen(), 'second Escape should keep list closed').toBe(false);
        expect(fixture.componentInstance.highlightedIndex(), 'highlight should stay reset').toBe(-1);
        expect(touchSpy, 'Escape should never emit touch').not.toHaveBeenCalled();
      });

      it('should ignore navigation keys when there are no options', async () => {
        // Arrange: Create component without options and focus it (empty list opens, nothing highlighted).
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: [] });

        // Act: Open list.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();

        // Assert: List is opened despite no options (deliberate behavior, as combobox doing nothing would be confusing).
        expect(fixture.componentInstance.isOpen(), 'focus should open empty list so user sees missing options').toBe(true);
        expect(fixture.componentInstance.highlightedIndex(), 'nothing to highlight without options').toBe(-1);

        // Act: Press all navigation keys.
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{ArrowUp}');
        await user.keyboard('{Home}');
        await user.keyboard('{End}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Highlight unchanged (still none, no NaN), list stays open.
        expect(fixture.componentInstance.highlightedIndex(), 'navigation keys should not change highlight without options').toBe(-1);
        expect(fixture.componentInstance.isOpen(), 'navigation keys should keep empty list open').toBe(true);
      });

      it('should close list on Escape when there are no options', async () => {
        // Arrange: Create component without options and focus it (empty list opens).
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: [] });

        // Act: Open list.
        const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
        root.focus();
        fixture.detectChanges();

        // Assert: List is actually opened.
        expect(fixture.componentInstance.isOpen(), 'focus should open empty list').toBe(true);

        // Act: Press Escape.
        await user.keyboard('{Escape}');
        await fixture.whenStable();
        fixture.detectChanges();

        // Assert: Empty list closed.
        expect(fixture.componentInstance.isOpen(), 'Escape should close empty list').toBe(false);
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
        // Arrange: Create component with open list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Arrange: Create focusable control after our combobox (simulates next component).
        const nextControl = document.createElement('button');
        nextControl.setAttribute('data-testid', 'next-control');
        document.body.appendChild(nextControl);

        try {
          // Act: Open list.
          const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
          root.focus();
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: List is actually opened.
          expect(fixture.componentInstance.isOpen(), 'list should be open before Tab').toBe(true);

          // Act: Press Tab.
          await user.tab();
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: List closed via blur, focus moved out of combobox.
          expect(fixture.componentInstance.isOpen(), 'Tab should close the list via blur').toBe(false);
          expect(document.activeElement, 'Tab should move focus to next control').toBe(nextControl);
        } finally { // cleanup
          nextControl.remove();
        }
      });

      it('should close list and move focus to previous control on Shift+Tab when open', async () => {
        // Arrange: Create component with open list.
        const user = userEvent.setup();
        const fixture = await arrangeComboBox({ options: ['a', 'b', 'c'] });

        // Arrange: Create focusable control before our combobox (simulates previous component).
        const prevControl = document.createElement('button');
        prevControl.setAttribute('data-testid', 'prev-control');
        document.body.insertBefore(prevControl, fixture.nativeElement);

        try {
          // Act: Open list.
          const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
          root.focus();
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: List is actually opened.
          expect(fixture.componentInstance.isOpen(), 'list should be open before Shift+Tab').toBe(true);

          // Act: Press Shift+Tab.
          await user.keyboard('{Shift>}{Tab}{/Shift}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: List closed via blur, focus moved out of combobox backwards.
          expect(fixture.componentInstance.isOpen(), 'Shift+Tab should close the list via blur').toBe(false);
          expect(document.activeElement, 'Shift+Tab should move focus to previous control').toBe(prevControl);
        } finally { // cleanup
          prevControl.remove();
        }
      });

      describe('typeahead', () => {
        /** Focus the combobox root so the list opens (no value selected -> nothing highlighted). */
        async function openList(fixture: ComponentFixture<ComboBox>): Promise<Element> {
          const root = fixture.nativeElement.querySelector('[data-testid="test-combo"]');
          root.focus();
          await fixture.whenStable();
          fixture.detectChanges();
          expect(fixture.componentInstance.isOpen(), 'list should be open before typing').toBe(true);
          return root;
        }

        it('should highlight the first option matching the typed character', async () => {
          // Arrange: Open list, nothing highlighted (no value selected).
          const user = userEvent.setup();
          const fixture = await arrangeComboBox({ options: ['apple', 'pear', 'banana'] });
          await openList(fixture);

          // Act: Type a character.
          await user.keyboard('p');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Highlight jumped to the matching option; the list stays open.
          expect(fixture.componentInstance.highlightedIndex(), 'typing should highlight the matching option').toBe(1);
          expect(fixture.componentInstance.isOpen(), 'typeahead must keep the list open').toBe(true);
        });

        it('should merge quick keystrokes into one prefix search', async () => {
          // Arrange: Open list; 'a' followed by 'p' within the buffer window must search 'ap'.
          const user = userEvent.setup();
          const fixture = await arrangeComboBox({ options: ['apple', 'apricot', 'pear'] });
          await openList(fixture);

          // Act: Type both characters quickly (well inside the 500 ms buffer window).
          await user.keyboard('a');
          await user.keyboard('p');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: 'a' highlighted 'apple' (index 0); the refined 'ap' then matched 'apricot'
          // (index 1) - without merging, a lone 'p' would match nothing and stay on index 0.
          expect(fixture.componentInstance.highlightedIndex(), 'quick keystrokes should merge into one search').toBe(1);
        });

        it('should restart the search buffer after 500 ms of inactivity', async () => {
          // Arrange: Open list; Date.now is controlled so the buffer window can pass instantly.
          const user = userEvent.setup();
          const fixture = await arrangeComboBox({ options: ['apple', 'apricot', 'pear'] });
          await openList(fixture);
          let now = 1_000_000;
          const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);

          try {
            // Act: Type 'a', jump past the 500 ms window, then type 'p'.
            await user.keyboard('a');
            now += 600;
            await user.keyboard('p');
            await fixture.whenStable();
            fixture.detectChanges();

            // Assert: The stale buffer was discarded - a fresh 'p' searched from after
            // 'apple' and hit 'pear' (index 2); a merged 'ap' would have hit 'apricot' (1).
            expect(fixture.componentInstance.highlightedIndex(), 'buffer should reset after the window').toBe(2);
          } finally { // cleanup
            nowSpy.mockRestore();
          }
        });

        it('should match the typed character case-insensitively', async () => {
          // Arrange: Open list with an option starting with an uppercase letter.
          const user = userEvent.setup();
          const fixture = await arrangeComboBox({ options: ['apple', 'Banana'] });
          await openList(fixture);

          // Act: Type the lowercase version.
          await user.keyboard('b');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: The uppercase option is still a match.
          expect(fixture.componentInstance.highlightedIndex(), 'typeahead should ignore case').toBe(1);
        });

        it('should drop the last buffered character on Backspace and re-search', async () => {
          // Arrange: Open list; build a two-character buffer ('p' then 'l' -> 'pl' -> 'plum').
          const user = userEvent.setup();
          const fixture = await arrangeComboBox({ options: ['apple', 'pear', 'plum'] });
          await openList(fixture);

          // Act: Type 'p', then 'l', then delete the 'l' again.
          await user.keyboard('p');
          await user.keyboard('l');
          await user.keyboard('{Backspace}');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: The buffer shrank to 'p', which now searches from after 'plum' and wraps
          // to 'pear' (index 1); keeping 'pl' would leave the highlight on 'plum' (index 2).
          expect(fixture.componentInstance.highlightedIndex(), 'Backspace should re-search with the shortened buffer').toBe(1);
        });

        it('should open the list and jump to a match when typing while closed', async () => {
          // Arrange: Focused combobox whose list was closed again with Escape.
          const user = userEvent.setup();
          const fixture = await arrangeComboBox({ options: ['apple', 'pear'] });
          await openList(fixture);
          await user.keyboard('{Escape}');
          await fixture.whenStable();
          fixture.detectChanges();
          expect(fixture.componentInstance.isOpen(), 'list should be closed before typing').toBe(false);

          // Act: Type a character while the list is closed.
          await user.keyboard('p');
          await fixture.whenStable();
          fixture.detectChanges();

          // Assert: Typing opened the list and highlighted the match, like ArrowDown does.
          expect(fixture.componentInstance.isOpen(), 'typing should open the closed list').toBe(true);
          expect(fixture.componentInstance.highlightedIndex(), 'typing should highlight the matching option').toBe(1);
        });
      });
    });
  });
});
