import { TestBed } from '@angular/core/testing';

import { DateTimePicker } from './date-time-picker';

/**
 * Unit tests of date-time-picker component.
 * Note: DateTimePicker is pretty much only wrapper for DatePicker and TimePicker subcomponents, so tests
 * are limited to checking their presence and interactions between them.
 * TODO: right now it is placeholder.
 */
describe('DateTimePicker', () => {
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
});
