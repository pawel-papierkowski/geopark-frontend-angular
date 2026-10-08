/**
 * Dispatch a real bubbling mousedown on the given target so it reaches a component's
 * document-level listener, mimicking a pointer press anywhere on the page.
 * @param target Element the press lands on.
 * @returns The dispatched event, for defaultPrevented assertions.
 */
export function dispatchMousedown(target: Element): Event {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
