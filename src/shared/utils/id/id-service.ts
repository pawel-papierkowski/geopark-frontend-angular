import { Service } from '@angular/core';

/**
 * Service generating unique identifiers for components whose `ident` input was not provided.
 * Generated ids follow `<prefix>-<number>` pattern (e.g. `text-box-1`), where prefix is the
 * component name, so results stay readable in devtools and unique across the whole application.
 * Numbering is per prefix and monotonic within the service lifetime, which keeps ids deterministic
 * for a given creation order (unit tests get a fresh service, so numbering starts from 1 there).
 *
 * Guarantees: the result is always a non-empty string. A provided ident is passed through
 * VERBATIM, even when it is not a valid CSS selector (e.g. `123` or `has space`) - components
 * deliberately support arbitrary idents (see radio-box, which replaced selector queries with
 * `viewChildren` for that reason), so consumers must never build `querySelector('#' + id)` from
 * the result; use `getElementById`, a quoted attribute selector (`[id="..."]`) or `viewChildren`.
 */
@Service()
export class IdService {
  /** Last issued number for each prefix. */
  private readonly counters = new Map<string, number>();

  /**
   * Generate the next unique identifier for a given prefix.
   * @param ident Ident: a non-empty string, or `null`/`undefined` when absent. Non-strings are
   * rejected by the type system; the runtime guard additionally generates an identifier for any
   * non-string that slips through (e.g. via an `as`-cast or plain JS caller).
   * @param prefix Component-specific prefix, kebab-case component name (e.g. `text-box`).
   * @returns Given ident when it is a non-empty string (verbatim, even if not a valid CSS
   * selector), otherwise a generated identifier in the form `<prefix>-<number>`, e.g. `text-box-1`.
   * Always a string.
   */
  public next(ident: string | null | undefined, prefix: string): string {
    if (this.isValid(ident)) return ident;

    const value = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, value);
    return `${prefix}-${value}`;
  }

  /**
   * Check if given ident is a valid value: a non-empty string (after trimming).
   * Type guard, so callers get `string` narrowing without a cast.
   * @param ident Ident to verify.
   * @returns True if ident is a non-empty string, otherwise false.
   */
  private isValid(ident: string | null | undefined): ident is string {
    if (typeof ident !== 'string') return false;
    if (ident.trim() === '') return false;
    return true;
  }
}
