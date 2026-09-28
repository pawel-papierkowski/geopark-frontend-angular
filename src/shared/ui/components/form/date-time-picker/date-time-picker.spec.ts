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
  });
});
