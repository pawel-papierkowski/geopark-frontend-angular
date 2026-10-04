import { isDevMode } from '@angular/core';

/**
 * Dev-only diagnostic for components that turn a consumer-provided `label` id into an
 * `aria-labelledby` reference (date-time-picker family). When the id matches no element,
 * the reference dangles: the browser's name computation resolves nothing and the component
 * deliberately suppresses its `aria-label` fallback whenever `label` is set, so the input
 * ends up with NO accessible name (WCAG 4.1.2 failure) that no test in the app would catch.
 * The warning surfaces that typo early, naming the offending id and the component instance.
 *
 * Behaviour:
 * - No-op when `labelId` is empty (component falls back to its `aria-label`, nothing to resolve).
 * - No-op outside dev mode - optimized/production builds define `ngDevMode` as `false`, so
 *   `isDevMode()` returns false and the call is skipped at runtime.
 * - Resolves against the passed document only; checks the id at the moment of the call, so a
 *   label element rendered later (e.g. behind `@defer`) can produce a warning that was accurate
 *   when emitted but is not retracted once the element appears (the caller re-runs on `label`
 *   changes, not on arbitrary DOM changes).
 *
 * Usage:
 * ```
 * effect(() => warnDanglingLabel(this.document, this.label(), this.ident(), 'date-picker'));
 * ```
 * @param document Document the id is resolved against (inject `DOCUMENT`, not the global).
 * @param labelId Id referenced by the component's `label` input.
 * @param ident Ident of the component instance (points the developer at the concrete field).
 * @param component Component selector emitting the warning.
 */
export function warnDanglingLabel(document: Document, labelId: string, ident: string, component: string): void {
  if (labelId === '') return;
  if (!isDevMode()) return;
  if (document.getElementById(labelId) !== null) return;

  console.warn(
    `[${component}] "label" input references id "${labelId}" (ident "${ident}"), but no element with that id exists in the document. ` +
    'The input will have no accessible name. Pass the id of an existing element, usually the <label> describing this picker.'
  );
}
