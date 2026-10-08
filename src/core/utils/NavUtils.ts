/** Navigation-related utility functions. */
export class NavUtils {
  static readonly focusable =
    'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

  /**
   * Static reachability check of a focusable-list candidate: no `hidden`/`inert` blocker on it
   * or any ancestor, and no inline style that removes it from the focus order. This covers the
   * cases a test environment can reproduce; stylesheet-level hiding can only be proven by an
   * actual `focus()` attempt, which `focusReachable` verifies.
   * @param element Candidate to check.
   * @returns True when no static blocker is found.
   */
  private static isReachable(element: HTMLElement): boolean {
    if (element.closest('[hidden]') !== null) return false;
    if (element.closest('[inert]') !== null) return false;
    if (element.style.display === 'none') return false;
    if (element.style.visibility === 'hidden') return false;
    return true;
  }

  /**
   * Walk `candidates` from `startIndex` in `step` direction and return the first element that
   * verifiably takes focus. Each candidate passes `isReachable` first, then gets an attempted
   * `focus()` whose success is checked against `ownerDocument.activeElement` - `focus()`
   * silently no-ops on elements the browser deems unreachable (stylesheet-hidden content,
   * content in a closed `<details>`, `visibility:hidden` via CSS, ...), and a failed attempt
   * fires no events, so continuing the walk is side-effect free.
   * @param candidates Focusable candidates in document order.
   * @param startIndex Index to start from (inclusive; may be out of range - the walk then no-ops).
   * @param step Direction of the walk: 1 forward, -1 backward.
   * @param ownerDocument Document whose `activeElement` verifies each attempt.
   * @returns The element that took focus, or null when none did.
   */
  private static focusReachable(
    candidates: NodeListOf<HTMLElement>,
    startIndex: number,
    step: 1 | -1,
    ownerDocument: Document,
  ): HTMLElement | null {
    for (let i = startIndex; i >= 0 && i < candidates.length; i += step) {
      const candidate = candidates[i]!;
      if (!NavUtils.isReachable(candidate)) continue;
      candidate.focus();
      if (ownerDocument.activeElement === candidate) return candidate;
    }
    return null;
  }

  /**
   * Starting from the current element, focus the next REACHABLE focusable element on the page.
   * Hidden or inert candidates are skipped, every `focus()` attempt is verified against
   * `activeElement`, and the outcome is reported so callers can react when focus did not move
   * (e.g. close a popup without stranding focus inside it). Does nothing but report failure in
   * case of failure.
   * The focusable list is read from the element's OWN document (`ownerDocument`), never from the
   * global one, so the call behaves correctly for elements outside the main document as well.
   * @param currElement Current element.
   * @returns True when focus verifiably landed on a following element, false otherwise.
   */
  public static FocusNext(currElement: HTMLElement | null): boolean {
    if (!currElement) return false;

    const ownerDocument = currElement.ownerDocument;
    const allFocusable = ownerDocument.querySelectorAll<HTMLElement>(NavUtils.focusable);
    const idx = Array.from(allFocusable).indexOf(currElement);
    if (idx === -1) return false; // current element is not focusable anyway

    return NavUtils.focusReachable(allFocusable, idx + 1, 1, ownerDocument) !== null;
  }

  /**
   * Starting from the current element, focus the previous REACHABLE focusable element on the
   * page. Hidden or inert candidates are skipped, every `focus()` attempt is verified against
   * `activeElement`, and the outcome is reported so callers can react when focus did not move
   * (e.g. close a popup without stranding focus inside it). Does nothing but report failure in
   * case of failure.
   * The focusable list is read from the element's OWN document (`ownerDocument`), never from the
   * global one, so the call behaves correctly for elements outside the main document as well.
   * @param currElement Current element.
   * @returns True when focus verifiably landed on a preceding element, false otherwise.
   */
  public static FocusPrev(currElement: HTMLElement | null): boolean {
    if (!currElement) return false;

    const ownerDocument = currElement.ownerDocument;
    const allFocusable = ownerDocument.querySelectorAll<HTMLElement>(NavUtils.focusable);
    const idx = Array.from(allFocusable).indexOf(currElement);
    if (idx <= 0) return false; // current element is not focusable or is the first one

    return NavUtils.focusReachable(allFocusable, idx - 1, -1, ownerDocument) !== null;
  }

  /**
   * Starting from the current element, focus on the first focusable element INSIDE the current element. If it fails, focus on the current element.
   * @param currElement Current element.
   */
  public static FocusNextInside(currElement: HTMLElement | null) {
    if (!currElement) return;

    const firstFocusable = currElement.querySelector<HTMLElement>(NavUtils.focusable);
    (firstFocusable ?? currElement).focus();
  }
}
