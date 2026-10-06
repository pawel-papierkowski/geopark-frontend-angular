import { Component, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LabelActivation } from './popup-label-activation';

/** Host component wiring the guard the way production components do (constructor install,
 * view-owned boundary, ident for own-label detection). */
@Component({
  template: `<div #boundary data-testid="boundary"></div><label #label data-testid="label" for="guard-host"></label>`,
})
class GuardHostComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Guard instance under test. */
  public readonly labelActivation = new LabelActivation<'closed'>();

  /** Targets handed to `onOutsidePress`, in order. */
  public readonly outsidePresses: Node[] = [];

  /** Boundary element the guard checks presses against. */
  private readonly boundary = viewChild.required<ElementRef<HTMLDivElement>>('boundary');

  constructor() {
    this.labelActivation.installDocumentGuard({
      document,
      destroyRef: this.destroyRef,
      ident: () => 'guard-host',
      boundary: () => this.boundary().nativeElement,
      onOutsidePress: (target) => this.outsidePresses.push(target),
    });
  }
}

/**
 * Dispatch a cancellable bubbling mousedown, so capture-phase document listeners observe it
 * just like a real pointer press.
 * @param target Element the press lands on.
 * @returns The dispatched event, for `defaultPrevented` assertions.
 */
function press(target: EventTarget): MouseEvent {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/**
 * Unit tests of LabelActivation helper (label-activation markers + document guard).
 */
describe('LabelActivation', () => {
  describe('state', () => {
    it('should start with neither marker armed', () => {
      // Arrange: Fresh instance, nothing interacted with yet.
      const activation = new LabelActivation<'closed'>();

      // Act: None - initial state only.

      // Assert: No focus-open marker and no recorded decision.
      expect(activation.focusOpened(), 'focus-open marker should start disarmed').toBe(false);
      expect(activation.clickDecision(), 'decision should start as none').toBe('none');
    });

    it('should clear both markers on reset', () => {
      // Arrange: Both markers armed.
      const activation = new LabelActivation<'closed'>();
      activation.focusOpened.set(true);
      activation.clickDecision.set('closed');

      // Act: Reset to the fresh-interaction state.
      activation.reset();

      // Assert: Both markers are back to their initial values.
      expect(activation.focusOpened(), 'reset should clear the focus-open marker').toBe(false);
      expect(activation.clickDecision(), 'reset should clear the decision').toBe('none');
    });

    it('should return the current decision and clear it on consumeDecision', () => {
      // Arrange: A recorded decision plus an armed focus-open marker.
      const activation = new LabelActivation<'closed'>();
      activation.clickDecision.set('open');
      activation.focusOpened.set(true);

      // Act: Consume the decision once.
      const first = activation.consumeDecision();
      const second = activation.consumeDecision();

      // Assert: The decision was returned, then consumed; unrelated state untouched.
      expect(first, 'first consume should return the recorded decision').toBe('open');
      expect(second, 'second consume should find no decision left').toBe('none');
      expect(activation.clickDecision(), 'consume should clear the decision').toBe('none');
      expect(activation.focusOpened(), 'consume must not touch the focus-open marker').toBe(true);
    });
  });

  describe('document guard', () => {
    it('should prevent the default focus steal on the own label and report no outside press', () => {
      // Arrange: Host with its guard installed; label paired with the host ident.
      const fixture = TestBed.createComponent(GuardHostComponent);
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('[data-testid="label"]') as HTMLLabelElement;

      // Act: Press the own label.
      const event = press(label);

      // Assert: Default canceled (focus stays put), nothing reported as outside.
      expect(event.defaultPrevented, 'press on the own label should cancel the default').toBe(true);
      expect(fixture.componentInstance.outsidePresses, 'own label is inside, not an outside press').toHaveLength(0);
    });

    it('should let presses inside the boundary behave normally', () => {
      // Arrange: Host with its guard installed; press lands on the boundary element.
      const fixture = TestBed.createComponent(GuardHostComponent);
      fixture.detectChanges();
      const boundary = fixture.nativeElement.querySelector('[data-testid="boundary"]') as HTMLDivElement;

      // Act: Press inside the component.
      const event = press(boundary);

      // Assert: Default untouched, no outside report.
      expect(event.defaultPrevented, 'inside press must keep its default behavior').toBe(false);
      expect(fixture.componentInstance.outsidePresses, 'inside press is not an outside press').toHaveLength(0);
    });

    it('should report presses landing outside the boundary with their target', () => {
      // Arrange: Host with its guard installed; press lands on the body, outside the host.
      const fixture = TestBed.createComponent(GuardHostComponent);
      fixture.detectChanges();

      // Act: Press outside the component.
      press(document.body);

      // Assert: Exactly one outside report carrying the pressed target.
      expect(fixture.componentInstance.outsidePresses, 'outside press should be reported once').toHaveLength(1);
      expect(fixture.componentInstance.outsidePresses[0], 'report should carry the pressed target').toBe(document.body);
    });

    it('should reset both markers on every press', () => {
      // Arrange: Both markers armed, as if a previous activation left them behind.
      const fixture = TestBed.createComponent(GuardHostComponent);
      fixture.detectChanges();
      const activation = fixture.componentInstance.labelActivation;
      activation.focusOpened.set(true);
      activation.clickDecision.set('open');

      // Act: A fresh pointer press anywhere.
      press(document.body);

      // Assert: The press started a fresh interaction for both markers.
      expect(activation.focusOpened(), 'press should clear the focus-open marker').toBe(false);
      expect(activation.clickDecision(), 'press should clear the decision').toBe('none');
    });

    it('should stop listening after the owner is destroyed', () => {
      // Arrange: Host installed its guard, then the component is destroyed.
      const fixture = TestBed.createComponent(GuardHostComponent);
      fixture.detectChanges();
      const outsideBefore = fixture.componentInstance.outsidePresses.length;
      fixture.destroy();

      // Act: Press outside after destruction.
      press(document.body);

      // Assert: Destroy removed the listener, so nothing was reported.
      expect(fixture.componentInstance.outsidePresses, 'destroyed guard must not react to presses').toHaveLength(outsideBefore);
    });
  });
});
