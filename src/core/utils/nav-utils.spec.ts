import { NavUtils } from './NavUtils';

/**
 * Unit tests of NavUtils focus navigation.
 * Focus fixtures are appended to `document.body` (focus requires an attached element) and removed
 * again by the owning test, so document order stays deterministic for every case - only the
 * document-ownership case builds its fixtures in a secondary document instead.
 */
describe('NavUtils', () => {
  /**
   * Create a button for the navigation fixtures.
   * @param testid Value of the `data-testid` attribute identifying the control.
   * @param opts Whether the button is disabled or deliberately untabbable.
   * @returns The button, NOT yet attached to the document.
   */
  function createButton(testid: string, opts: { disabled?: boolean; untabbable?: boolean } = {}): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-testid', testid);
    if (opts.disabled) button.disabled = true;
    if (opts.untabbable) button.tabIndex = -1;
    return button;
  }

  /**
   * Append the given controls to a fresh container in `document.body`.
   * @param controls Controls in the order they should appear in the document.
   * @returns The container holding the controls (remove it when done).
   */
  function arrangeRow(...controls: HTMLElement[]): HTMLElement {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'nav-row');
    controls.forEach((control) => container.appendChild(control));
    document.body.appendChild(container);
    return container;
  }

  /**
   * Find the fixture element carrying the given testid.
   * @param testid Testid of the element to look up.
   * @returns The element with that testid, or null when it is not in the document. Callers
   * compare it against `document.activeElement` to assert who owns focus.
   */
  function focusedBy(testid: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  }

  describe('FocusNext', () => {
    it('should focus the next focusable element in document order', () => {
      // Arrange: Two buttons with the first one focused.
      const first = createButton('nav-first');
      const second = createButton('nav-second');
      const row = arrangeRow(first, second);

      try {
        first.focus();

        // Act: Move forwards from the first button.
        const moved = NavUtils.FocusNext(first);

        // Assert: Focus advanced to the element right after it, and the move is reported.
        expect(document.activeElement, 'FocusNext should focus the following focusable element').toBe(focusedBy('nav-second'));
        expect(moved, 'FocusNext should report a successful move').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip controls excluded by the focusable selector', () => {
      // Arrange: A disabled button and an untabbable button sit between the two focusable ones.
      const first = createButton('nav-first');
      const disabled = createButton('nav-disabled', { disabled: true });
      const untabbable = createButton('nav-untabbable', { untabbable: true });
      const last = createButton('nav-last');
      const row = arrangeRow(first, disabled, untabbable, last);

      try {
        first.focus();

        // Act: Move forwards past the excluded controls.
        NavUtils.FocusNext(first);

        // Assert: Disabled and tabindex="-1" controls were not focused.
        expect(document.activeElement, 'FocusNext should skip disabled and untabbable controls').toBe(focusedBy('nav-last'));
      } finally { // cleanup
        row.remove();
      }
    });

    it('should do nothing when the current element is the last focusable one', () => {
      // Arrange: Two buttons with the second one focused.
      const first = createButton('nav-first');
      const second = createButton('nav-second');
      const row = arrangeRow(first, second);

      try {
        second.focus();

        // Act: Move forwards from the last control.
        const moved = NavUtils.FocusNext(second);

        // Assert: There is no element after it, so focus did not move and the failure is reported.
        expect(document.activeElement, 'FocusNext must not move focus past the last control').toBe(focusedBy('nav-second'));
        expect(moved, 'FocusNext should report a failed move when nothing follows').toBe(false);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should do nothing when there is no current element', () => {
      // Arrange: A focusable button and focus parked outside the fixture.
      const first = createButton('nav-first');
      const row = arrangeRow(first);
      document.body.focus();

      try {
        // Act: Call without a current element.
        const moved = NavUtils.FocusNext(null);

        // Assert: Focus was not moved anywhere and the failure is reported.
        expect(document.activeElement, 'FocusNext(null) must be a no-op').toBe(document.body);
        expect(moved, 'FocusNext(null) should report failure').toBe(false);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should do nothing when the current element is not focusable itself', () => {
      // Arrange: A plain container (matches none of the focusable selectors) holding a button.
      const container = document.createElement('div');
      container.setAttribute('data-testid', 'nav-container');
      const inner = createButton('nav-inner');
      container.appendChild(inner);
      document.body.appendChild(container);

      try {
        // Act: Start from the non-focusable container.
        const moved = NavUtils.FocusNext(container);

        // Assert: A control that is not part of the focusable list resolves to no position.
        expect(document.activeElement, 'FocusNext from a non-focusable element must be a no-op').not.toBe(focusedBy('nav-inner'));
        expect(moved, 'FocusNext from a non-focusable element should report failure').toBe(false);
      } finally { // cleanup
        container.remove();
      }
    });

    it('should skip candidates hidden by the hidden attribute', () => {
      // Arrange: A focusable button carrying the `hidden` attribute sits between two reachable ones.
      const first = createButton('nav-first');
      const hidden = createButton('nav-hidden');
      hidden.hidden = true;
      const last = createButton('nav-last');
      const row = arrangeRow(first, hidden, last);

      try {
        first.focus();

        // Act: Move forwards past the hidden candidate.
        const moved = NavUtils.FocusNext(first);

        // Assert: The unreachable candidate was skipped, not focused.
        expect(document.activeElement, 'FocusNext should skip a [hidden] candidate').toBe(focusedBy('nav-last'));
        expect(moved, 'FocusNext should report the move past the hidden candidate').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip candidates inside an inert subtree', () => {
      // Arrange: A button wrapped in an `inert` container sits between two reachable ones.
      const first = createButton('nav-first');
      const inertBox = document.createElement('div');
      inertBox.setAttribute('inert', '');
      inertBox.appendChild(createButton('nav-inert'));
      const last = createButton('nav-last');
      const row = arrangeRow(first, inertBox, last);

      try {
        first.focus();

        // Act: Move forwards past the inert candidate.
        const moved = NavUtils.FocusNext(first);

        // Assert: The candidate inside the inert subtree was skipped, not focused.
        expect(document.activeElement, 'FocusNext should skip an [inert] candidate').toBe(focusedBy('nav-last'));
        expect(moved, 'FocusNext should report the move past the inert candidate').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip candidates hidden by inline display:none or visibility:hidden', () => {
      // Arrange: Two focusable buttons made unreachable through inline styles.
      const first = createButton('nav-first');
      const displayNone = createButton('nav-display-none');
      displayNone.style.display = 'none';
      const visibilityHidden = createButton('nav-visibility-hidden');
      visibilityHidden.style.visibility = 'hidden';
      const last = createButton('nav-last');
      const row = arrangeRow(first, displayNone, visibilityHidden, last);

      try {
        first.focus();

        // Act: Move forwards past the style-hidden candidates.
        const moved = NavUtils.FocusNext(first);

        // Assert: Both unreachable candidates were skipped.
        expect(document.activeElement, 'FocusNext should skip style-hidden candidates').toBe(focusedBy('nav-last'));
        expect(moved, 'FocusNext should report the move past the style-hidden candidates').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should continue past a candidate whose focus() call silently fails', () => {
      // Arrange: A candidate whose focus() no-ops (as a browser does for unreachable elements)
      // sits between the focused first button and the real target.
      const first = createButton('nav-first');
      const stubborn = createButton('nav-stubborn');
      const last = createButton('nav-last');
      const row = arrangeRow(first, stubborn, last);
      const focusSpy = vi.spyOn(stubborn, 'focus').mockImplementation(() => {
        // Simulates the browser rejecting focus on an unreachable element: no state change.
      });

      try {
        first.focus();

        // Act: Move forwards through the candidate that refuses focus.
        const moved = NavUtils.FocusNext(first);

        // Assert: The failed attempt was made once, then focus continued to the next candidate.
        expect(focusSpy, 'FocusNext should attempt the failing candidate exactly once').toHaveBeenCalledTimes(1);
        expect(document.activeElement, 'FocusNext should continue to the candidate after a failed focus()').toBe(focusedBy('nav-last'));
        expect(moved, 'FocusNext should report the eventual successful move').toBe(true);
      } finally { // cleanup
        focusSpy.mockRestore();
        row.remove();
      }
    });
  });

  describe('FocusPrev', () => {
    it('should focus the previous focusable element in document order', () => {
      // Arrange: Two buttons with the second one focused.
      const first = createButton('nav-first');
      const second = createButton('nav-second');
      const row = arrangeRow(first, second);

      try {
        second.focus();

        // Act: Move backwards from the second button.
        const moved = NavUtils.FocusPrev(second);

        // Assert: Focus advanced to the element right before it, and the move is reported.
        expect(document.activeElement, 'FocusPrev should focus the preceding focusable element').toBe(focusedBy('nav-first'));
        expect(moved, 'FocusPrev should report a successful move').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip controls excluded by the focusable selector', () => {
      // Arrange: Focusable, excluded, focusable controls with focus on the last one.
      const first = createButton('nav-first');
      const untabbable = createButton('nav-untabbable', { untabbable: true });
      const last = createButton('nav-last');
      const row = arrangeRow(first, untabbable, last);

      try {
        last.focus();

        // Act: Move backwards past the excluded control.
        NavUtils.FocusPrev(last);

        // Assert: The tabindex="-1" control was not focused.
        expect(document.activeElement, 'FocusPrev should skip untabbable controls').toBe(focusedBy('nav-first'));
      } finally { // cleanup
        row.remove();
      }
    });

    it('should do nothing when the current element is the first focusable one', () => {
      // Arrange: Two buttons with the first one focused.
      const first = createButton('nav-first');
      const second = createButton('nav-second');
      const row = arrangeRow(first, second);

      try {
        first.focus();

        // Act: Move backwards from the first control.
        const moved = NavUtils.FocusPrev(first);

        // Assert: There is no element before it, so focus did not move and the failure is reported.
        expect(document.activeElement, 'FocusPrev must not move focus before the first control').toBe(focusedBy('nav-first'));
        expect(moved, 'FocusPrev should report a failed move when nothing precedes').toBe(false);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should do nothing when there is no current element', () => {
      // Arrange: A focusable button and focus parked outside the fixture.
      const first = createButton('nav-first');
      const row = arrangeRow(first);
      document.body.focus();

      try {
        // Act: Call without a current element.
        const moved = NavUtils.FocusPrev(null);

        // Assert: Focus was not moved anywhere and the failure is reported.
        expect(document.activeElement, 'FocusPrev(null) must be a no-op').toBe(document.body);
        expect(moved, 'FocusPrev(null) should report failure').toBe(false);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip candidates hidden by the hidden attribute', () => {
      // Arrange: A focusable button carrying the `hidden` attribute sits between two reachable ones.
      const first = createButton('nav-first');
      const hidden = createButton('nav-hidden');
      hidden.hidden = true;
      const last = createButton('nav-last');
      const row = arrangeRow(first, hidden, last);

      try {
        last.focus();

        // Act: Move backwards past the hidden candidate.
        const moved = NavUtils.FocusPrev(last);

        // Assert: The unreachable candidate was skipped, not focused.
        expect(document.activeElement, 'FocusPrev should skip a [hidden] candidate').toBe(focusedBy('nav-first'));
        expect(moved, 'FocusPrev should report the move past the hidden candidate').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip candidates inside an inert subtree', () => {
      // Arrange: A button wrapped in an `inert` container sits between two reachable ones.
      const first = createButton('nav-first');
      const inertBox = document.createElement('div');
      inertBox.setAttribute('inert', '');
      inertBox.appendChild(createButton('nav-inert'));
      const last = createButton('nav-last');
      const row = arrangeRow(first, inertBox, last);

      try {
        last.focus();

        // Act: Move backwards past the inert candidate.
        const moved = NavUtils.FocusPrev(last);

        // Assert: The candidate inside the inert subtree was skipped, not focused.
        expect(document.activeElement, 'FocusPrev should skip an [inert] candidate').toBe(focusedBy('nav-first'));
        expect(moved, 'FocusPrev should report the move past the inert candidate').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should skip candidates hidden by inline display:none or visibility:hidden', () => {
      // Arrange: Two focusable buttons made unreachable through inline styles.
      const first = createButton('nav-first');
      const displayNone = createButton('nav-display-none');
      displayNone.style.display = 'none';
      const visibilityHidden = createButton('nav-visibility-hidden');
      visibilityHidden.style.visibility = 'hidden';
      const last = createButton('nav-last');
      const row = arrangeRow(first, displayNone, visibilityHidden, last);

      try {
        last.focus();

        // Act: Move backwards past the style-hidden candidates.
        const moved = NavUtils.FocusPrev(last);

        // Assert: Both unreachable candidates were skipped.
        expect(document.activeElement, 'FocusPrev should skip style-hidden candidates').toBe(focusedBy('nav-first'));
        expect(moved, 'FocusPrev should report the move past the style-hidden candidates').toBe(true);
      } finally { // cleanup
        row.remove();
      }
    });

    it('should continue past a candidate whose focus() call silently fails', () => {
      // Arrange: A candidate whose focus() no-ops (as a browser does for unreachable elements)
      // sits between the focused last button and the real target.
      const first = createButton('nav-first');
      const stubborn = createButton('nav-stubborn');
      const last = createButton('nav-last');
      const row = arrangeRow(first, stubborn, last);
      const focusSpy = vi.spyOn(stubborn, 'focus').mockImplementation(() => {
        // Simulates the browser rejecting focus on an unreachable element: no state change.
      });

      try {
        last.focus();

        // Act: Move backwards through the candidate that refuses focus.
        const moved = NavUtils.FocusPrev(last);

        // Assert: The failed attempt was made once, then focus continued to the previous candidate.
        expect(focusSpy, 'FocusPrev should attempt the failing candidate exactly once').toHaveBeenCalledTimes(1);
        expect(document.activeElement, 'FocusPrev should continue to the candidate after a failed focus()').toBe(focusedBy('nav-first'));
        expect(moved, 'FocusPrev should report the eventual successful move').toBe(true);
      } finally { // cleanup
        focusSpy.mockRestore();
        row.remove();
      }
    });
  });

  describe('FocusNextInside', () => {
    it('should focus the first focusable element inside the given element', () => {
      // Arrange: Container holding a button.
      const container = document.createElement('div');
      container.setAttribute('data-testid', 'nav-container');
      const inner = createButton('nav-inner');
      container.appendChild(inner);
      document.body.appendChild(container);

      try {
        // Act: Focus the first focusable control within the container.
        NavUtils.FocusNextInside(container);

        // Assert: The nested button took focus.
        expect(document.activeElement, 'FocusNextInside should focus the first nested focusable element').toBe(focusedBy('nav-inner'));
      } finally { // cleanup
        container.remove();
      }
    });

    it('should focus the given element itself when it holds no focusable element', () => {
      // Arrange: A focusable container without any focusable children.
      const container = document.createElement('div');
      container.setAttribute('data-testid', 'nav-container');
      container.tabIndex = 0;
      document.body.appendChild(container);

      try {
        // Act: Ask for the first focusable inside it.
        NavUtils.FocusNextInside(container);

        // Assert: Focus fell back to the container itself.
        expect(document.activeElement, 'FocusNextInside should fall back to the container').toBe(focusedBy('nav-container'));
      } finally { // cleanup
        container.remove();
      }
    });
  });

  describe('document ownership', () => {
    it('should search the current element\'s own document, not the global one', () => {
      // Arrange: Two buttons living in a SECONDARY document - they are invisible to any query
      // running against the global `document`, so only an ownerDocument-based lookup finds them.
      const otherDoc = document.implementation.createHTMLDocument('other');
      const first = createButton('nav-other-first');
      const second = createButton('nav-other-second');
      otherDoc.body.appendChild(first);
      otherDoc.body.appendChild(second);
      const focusSpy = vi.spyOn(second, 'focus');

      try {
        // Act: Move forwards from the element of the secondary document.
        NavUtils.FocusNext(first);

        // Assert: The sibling of the SAME document took focus.
        expect(focusSpy, 'FocusNext should resolve focusables through the element own document').toHaveBeenCalledTimes(1);
      } finally { // cleanup
        focusSpy.mockRestore();
      }
    });
  });
});
