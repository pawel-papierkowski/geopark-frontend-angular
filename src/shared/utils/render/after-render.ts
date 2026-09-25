import { afterNextRender, Injector } from '@angular/core';

/**
 * Waits until Angular renders pending state changes. Browser-only equivalent of Vue's
 * `await nextTick()` - resolve after the DOM reflects state written before the call.
 * Note: registering the hook schedules change detection itself, so it resolves even when
 * nothing else is pending. It never resolves if the injector's context is destroyed before
 * the render happens.
 * @param injector Injector used for hook registration and cleanup. Pass the component's
 * injector so the hook is dropped together with the component.
 * @returns Promise resolved after the next render pass.
 */
export function afterRender(injector: Injector): Promise<void> {
  return new Promise(resolve => afterNextRender(() => resolve(), { injector }));
}
