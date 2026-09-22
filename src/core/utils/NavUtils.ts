/** Navigation-related utility functions. */
export class NavUtils {
  static readonly focusable =
    'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

  /**
   * Starting from the current element, focus on the next focusable element on the page. Does nothing in case of failure.
   * @param currElement Current element.
   */
  public static FocusNext(currElement: HTMLElement | null) {
    if (!currElement) return;

    const allFocusable = document.querySelectorAll<HTMLElement>(NavUtils.focusable);
    const idx = Array.from(allFocusable).indexOf(currElement as HTMLElement);
    if (idx === -1) return; // current element is not focusable anyway

    let nextElement: HTMLElement | null;
    if (idx + 1 < allFocusable.length) {
      nextElement = allFocusable[idx + 1] || null;
      nextElement!.focus();
    }
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
