import { DestroyRef, inject, Service, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { fallbackLang, languages, storageKeys } from '@/shared/config/const';
import type { Lang } from '@/shared/config/types';
import { DocumentService } from '@/shared/utils/document/document-service';

/**
 * Application-wide coordinator for language selection and activation.
 *
 * Single owner of language state:
 * - resolves the initial preference (stored value, then browser language, then fallback)
 * - performs all activation requests
 * - synchronizes confirmed activation to `<html lang>` and persisted preference
 *
 * A language is confirmed only when `TranslateService` reports it through
 * `onLangChange`, so stale or failed loads never claim success.
 *
 * This service uses two subscriptions:
 * - track `translateService.onLangChange`: this language has actually become active (single for entire service)
 * - track `translateService.use(language)`: watch an individual activation request for failure (instanced)
 */
@Service()
export class LanguageService {
  private readonly translateService = inject(TranslateService);
  private readonly documentService = inject(DocumentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly active = signal<Lang | null>(null);
  private readonly pending = signal<Lang | null>(null);
  /** True once initialization or first selection happened; initialization is a one-shot. */
  private initialized = false;
  /** Monotonic identity of the latest request; older requests must not react to outcomes. */
  private requestSequence = 0;
  /** Subscription group of the latest request, cancelled when a newer one starts or on teardown. */
  private requestSubscription = new Subscription();
  /** Language of the latest request; only its activation may be confirmed. */
  private requestedLanguage: Lang | null = null;

  /** Language whose translations are currently active, or null before the first activation. */
  readonly activeLanguage = this.active.asReadonly();
  /** Language of the latest outstanding request, or null when no request is in flight. */
  readonly pendingLanguage = this.pending.asReadonly();

  /** Listens for real activations and cancels coordinator requests on teardown. */
  constructor() {
    // Subscription: when ngx-translate activates a language.
    this.translateService.onLangChange // observable that emits an event when ngx-translate activates a language
      .pipe(takeUntilDestroyed()) // automatically end this subscription when Angular destroys the service
      .subscribe({ // we use only `next` callback, no need for `error` or `complete`
        next: event => {
          const lang = event.lang;
          if (!this.isLanguage(lang) || lang !== this.requestedLanguage) return; // reject unsupported or no-longer-requested languages
          // Set all relevant language state in application.
          this.active.set(lang);
          this.pending.set(null);
          this.documentService.setDocumentLang(lang);
          this.persistLanguage(lang);
        }
      });
    this.destroyRef.onDestroy(() => this.requestSubscription.unsubscribe());
  }

  /**
   * Resolve and activate the initial language. Idempotent; later calls do nothing.
   * Resolution order: stored preference, browser language, fallback language.
   * Stored codes are lowercased before validation; invalid or unreadable values
   * are skipped in favor of the browser language. Successful activation persists
   * the confirmed lowercase code on a best-effort basis.
   */
  initialize(): void {
    if (this.initialized || this.destroyRef.destroyed) return;
    this.initialized = true;
    const storedLang = this.readLanguage();
    if (storedLang && this.isLanguage(storedLang)) {
      this.activate(storedLang, true); // Stored language is valid.
      return;
    }
    // Stored language is invalid. Fall back to browser language first then final fallback if all else fails.
    const browserLang = this.translateService.getBrowserLang();
    const finalLang = browserLang && this.isLanguage(browserLang) ? browserLang : fallbackLang;
    this.activate(finalLang, true);
  }

  /**
   * Activate the language chosen by the user. The last confirmed language remains
   * visible until the request activates; if it fails, confirmed language is restored
   * or, without one, the fallback language is attempted once.
   * @param language Selected language.
   */
  select(language: Lang): void {
    if (this.destroyRef.destroyed) return;
    this.initialized = true;
    const supersedesPending = this.pending() !== null && this.pending() !== language;
    this.activate(language, true, supersedesPending);
  }

  /**
   * Request activation of a language.
   *
   * On failure the latest request may attempt recovery: reactivating the confirmed language
   * (from cache) or activating the fallback language once.
   * Obsolete requests do nothing; a superseding selection over a pending older request is
   * allowed to retry the fallback language, so an older pending load cannot activate through
   * ngx-translate rollback.
   * @param language Language to activate.
   * @param allowRecovery True when failure of this request may start recovery.
   * @param retryFallback True when even the fallback language may be retried on failure.
   */
  private activate(language: Lang, allowRecovery: boolean, retryFallback = false): void {
    const sequence = ++this.requestSequence; // Track current activation request.
    this.requestSubscription.unsubscribe(); // Stop listening to previous request, if any.

    // New subscription per activation request. That prevents potential race conditions.
    const subscription = new Subscription();
    this.requestSubscription = subscription;
    this.requestedLanguage = language;
    this.pending.set(language);

    // Subscription: watch an individual activation request for failure.
    subscription.add(this.translateService.use(language).subscribe({
      // We use only `error` callback. Success is handled by other subscription.
      error: (error: unknown) => {
        // We handle this failure only if this is still the latest request and the service is still alive.
        if (sequence !== this.requestSequence || this.destroyRef.destroyed) return;
        console.error(`Failed to activate language '${language}'.`, error);
        // Attempt to restore the last confirmed language or use fallback if allowed.
        const confirmed = this.active();
        if (allowRecovery && confirmed !== null) {
          this.activate(confirmed, false);
        } else if (allowRecovery && (language !== fallbackLang || retryFallback)) {
          this.activate(fallbackLang, false);
        } else {
          this.pending.set(null);
        }
      },
    }));
  }

  /**
   * Check if the given code is a language known to this project.
   * @param language Language code to check.
   * @returns True if the code is known, otherwise false.
   */
  private isLanguage(language: string): language is Lang {
    return languages.some(candidate => candidate === language);
  }

  /**
   * Read the persisted language preference from web storage.
   * @returns Stored language code (lowercase) or null when missing or storage is unavailable.
   */
  private readLanguage(): string | null {
    try {
      const storedLang = localStorage.getItem(storageKeys.language);
      return storedLang?.toLowerCase() || null;
    } catch {
      return null;
    }
  }

  /**
   * Persist the language preference in web storage. Best-effort: failures are ignored so that
   * storage problems never interrupt language synchronization.
   * @param language Language code to store.
   */
  private persistLanguage(language: Lang): void {
    try {
      localStorage.setItem(storageKeys.language, language);
    } catch {
      return;
    }
  }
}
