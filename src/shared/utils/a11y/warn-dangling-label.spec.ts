import { warnDanglingLabel } from './warn-dangling-label';

/**
 * Unit tests of warnDanglingLabel utility.
 * Dev mode is implicitly active under vitest (`ngDevMode` is undefined there), which is exactly
 * the mode the warning targets; the production no-op path is delegated to `isDevMode()` itself.
 */
describe('warnDanglingLabel', () => {
  describe('conditions', () => {
    it('should warn when the label id matches no element', () => {
      // Arrange: Spy on console.warn; no element in the document carries the ghost id.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Act: Report a dangling reference.
        warnDanglingLabel(document, 'ghost-label', 'dateId_x_input', 'date-picker');

        // Assert: Exactly one warning naming component, ident and the offending id.
        expect(warnSpy, 'warning should be emitted for a dangling id').toHaveBeenCalledTimes(1);
        const message = String(warnSpy.mock.calls[0]?.[0]);
        expect(message, 'message should name the emitting component').toContain('date-picker');
        expect(message, 'message should name the component ident').toContain('dateId_x_input');
        expect(message, 'message should name the dangling id').toContain('ghost-label');
      } finally { // cleanup
        warnSpy.mockRestore();
      }
    });

    it('should stay silent when the label id resolves to an element', () => {
      // Arrange: Element carrying the referenced id plus a spy on console.warn.
      const label = document.createElement('label');
      label.id = 'resolved-label';
      document.body.appendChild(label);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Act: Report a resolvable reference.
        warnDanglingLabel(document, 'resolved-label', 'dateId_x_input', 'date-picker');

        // Assert: Resolvable id is not a defect.
        expect(warnSpy, 'resolvable label id must not warn').not.toHaveBeenCalled();
      } finally { // cleanup
        warnSpy.mockRestore();
        label.remove();
      }
    });

    it('should stay silent when the label id is empty', () => {
      // Arrange: Spy on console.warn only - an empty label carries no reference at all.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Act: Report an empty reference.
        warnDanglingLabel(document, '', 'dateId_x_input', 'date-picker');

        // Assert: Empty label falls back to aria-label, there is nothing to resolve.
        expect(warnSpy, 'empty label id must not warn').not.toHaveBeenCalled();
      } finally { // cleanup
        warnSpy.mockRestore();
      }
    });
  });
});
