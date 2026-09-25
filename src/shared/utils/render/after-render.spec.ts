import { Component, inject, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { afterRender } from './after-render';

/** Host component providing an injector and simple DOM for render tests. */
@Component({
  template: `<div data-testid="after-render-box"></div>`,
})
class HostComponent {
  /** Injector used to register render hooks. */
  readonly injector = inject(Injector);
}

/**
 * Unit tests of afterRender utility.
 */
describe('afterRender', () => {
  it('should resolve after next render pass', async () => {
    // Arrange: Create host component and track promise resolution.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let resolved = false;

    // Act: Register render hook, then run change detection.
    const promise = afterRender(fixture.componentInstance.injector).then(() => {
      resolved = true;
    });
    fixture.detectChanges();
    await promise;

    // Assert: Promise resolved once render finished.
    expect(resolved, 'promise should resolve after render').toBe(true);
  });

  it('should resolve without manual change detection', async () => {
    // Arrange: Create host component without any dirty state.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let resolved = false;

    // Act: Register render hook only - its registration schedules render itself.
    const promise = afterRender(fixture.componentInstance.injector).then(() => {
      resolved = true;
    });
    await promise;

    // Assert: Hook ran, so render happened without manual change detection.
    expect(resolved, 'promise should resolve').toBe(true);
  });

  it('should not resolve synchronously after registration', async () => {
    // Arrange: Create host component.
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let resolved = false;

    // Act: Register render hook without running change detection yet.
    const promise = afterRender(fixture.componentInstance.injector).then(() => {
      resolved = true;
    });

    // Assert: Hook cannot run before render pass.
    expect(resolved, 'promise should stay pending before render').toBe(false);

    // Cleanup: Flush the hook so it does not leak.
    fixture.detectChanges();
    await promise;
  });
});
