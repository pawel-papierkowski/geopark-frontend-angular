import { setTimeout as delay } from 'node:timers/promises';
import { test, expect, type Page } from '@playwright/test';

/**
 * Assert agreement between translated labels, selected buttons, document language,
 * and the persisted preference. Poll the snapshot so asynchronous activation can finish.
 * @param page Browser page containing the application.
 * @param language Language expected to be active everywhere.
 * @returns Promise resolved once the language state agrees.
 */
async function expectLanguage(page: Page, language: 'en' | 'pl'): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    title: document.querySelector('[data-testid="lang-switcher.pl"]')?.getAttribute('title'),
    englishPressed: document.querySelector('[data-testid="lang-switcher.en"]')?.getAttribute('aria-pressed'),
    polishPressed: document.querySelector('[data-testid="lang-switcher.pl"]')?.getAttribute('aria-pressed'),
    documentLanguage: document.documentElement.lang,
    storedLanguage: localStorage.getItem('app.language'),
  })), {
    message: 'Translations, selected buttons, document language, and storage should agree',
    timeout: 15_000,
  }).toEqual({
    title: language === 'en' ? 'Polish' : 'Polski',
    englishPressed: String(language === 'en'),
    polishPressed: String(language === 'pl'),
    documentLanguage: language,
    storedLanguage: language,
  });
}

/**
 * Browser-level language switching, delayed loading, and persistence coverage.
 */
test.describe('Language', () => {
  test.use({ locale: 'en-GB' });

  test.describe('language switching', () => {
    test('from English to Polish', async ({ page }) => {
      // Arrange: Start on default public page. By default, english is picked.
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Assert: We have English language on page.
      await expect(page.getByTestId('lang-switcher.pl')).toHaveAttribute('title', 'Polish');

      // Act: Click on Polish language button.
      await page.getByTestId('lang-switcher.pl').click();

      // Assert: We have Polish language on page.
      await expect(page.getByTestId('lang-switcher.pl')).toHaveAttribute('title', 'Polski');
    });

    test('should synchronize English to Polish and back and retain the selection on reload', async ({ page }) => {
      // Arrange: Start with an English browser and an isolated, empty storage context.
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expectLanguage(page, 'en');

      // Act: Switch to Polish, reload, then switch back to English and reload again.
      await page.getByTestId('lang-switcher.pl').click();
      await expectLanguage(page, 'pl');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expectLanguage(page, 'pl');
      await page.getByTestId('lang-switcher.en').click();
      await expectLanguage(page, 'en');
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Assert: Reload restores the last confirmed English preference.
      await expectLanguage(page, 'en');
    });
  });

  test.describe('delayed loading', () => {
    test('should retain English until held Polish translations are released', async ({ page }) => {
      // Arrange: Hold both top-level and nested Polish translation requests.
      let releaseResponses!: () => void;
      const responseGate = new Promise<void>(resolve => {
        releaseResponses = resolve;
      });
      let heldRequests = 0;
      await page.route(/\/i18n\/pl\/.*\.json(?:\?.*)?$/, async route => {
        heldRequests++;
        await responseGate;
        const response = await route.fetch();
        await route.fulfill({ response });
      });

      try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expectLanguage(page, 'en');

        // Act: Select Polish while its responses remain blocked.
        await page.getByTestId('lang-switcher.pl').click();
        await expect.poll(() => heldRequests, { message: 'Polish requests should reach the response gate' }).toBeGreaterThan(0);

        // Assert: Check English before and after a 300 ms window with the gate still closed.
        await expectLanguage(page, 'en');
        await delay(300);
        await expectLanguage(page, 'en');

        // Act: Release real translation responses from the development server.
        releaseResponses();

        // Assert: Only successful loading confirms and persists Polish.
        await expectLanguage(page, 'pl');
      } finally {
        releaseResponses();
        if (!page.isClosed()) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      }
    });
  });

  test.describe('persisted preference', () => {
    test('should initialize Polish from storage instead of the English browser preference', async ({ page }) => {
      // Arrange: Seed the lowercase Polish preference before application initialization.
      await page.addInitScript(() => localStorage.setItem('app.language', 'pl'));

      // Act: Load the application without clicking any language button.
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Assert: The stored preference wins over the browser language.
      await expectLanguage(page, 'pl');
    });
  });
});
