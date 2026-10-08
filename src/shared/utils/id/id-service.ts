import { Service } from '@angular/core';

/**
 * Service generating unique identifiers for components whose `ident` input was not provided.
 * Generated ids follow `<prefix>-<number>` pattern (e.g. `text-box-1`), where prefix is the
 * component name, so results stay readable in devtools, unique across the whole application and
 * always valid as CSS selectors (needed by components querying their elements via `querySelector`).
 * Numbering is per prefix and monotonic within the service lifetime, which keeps ids deterministic
 * for a given creation order (unit tests get a fresh service, so numbering starts from 1 there).
 */
@Service()
export class IdService {
  /** Last issued number for each prefix. */
  private readonly counters = new Map<string, number>();

  /**
   * Generate next unique identifier for given prefix.
   * @param ident Ident. If invalid, generate a custom identifier.
   * @param prefix Component-specific prefix, kebab-case component name (e.g. `text-box`).
   * @returns Original identifier if valid or a generated identifier in the form `<prefix>-<number>`, e.g. `text-box-1`.
   */
  public next(ident: unknown, prefix: string): string {
    if (this.isValid(ident)) return ident as string;

    const value = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, value);
    return `${prefix}-${value}`;
  }

  /**
   * Check if given ident is a valid value.
   * @param ident Ident to verify.
   * @returns True if ident is valid, otherwise false.
   */
  private isValid(ident: unknown): boolean {
    if (typeof ident === 'string' && ident.trim() === '') return false;
    if (ident) return true;
    return false;
  }
}
