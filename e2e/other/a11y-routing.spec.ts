import { test, expect, type Page } from '@playwright/test';

/**
 * Keyboard bypass, focus management, and scroll restoration.
 *
 * These cover three SPA behaviours that a full page load gives for free but a routed
 * document does not: a skip link past the header (WCAG 2.4.1), focus landing on the new
 * page's main landmark after a client-side navigation (WCAG 2.4.3), and the router
 * scrolling to a #fragment target in the destination page.
 */

/**
 * Give the document enough height to scroll, then jump to an offset near the bottom.
 *
 * The routed pages are intentionally short, so the tests inject a spacer rather than rely
 * on content that may change. The spacer is appended to `document.body` (outside any
 * component), so no re-render removes it while the navigation is in flight.
 * @param page Page under test.
 * @param offset Vertical offset to scroll to.
 * @returns The offset the document actually settled at.
 */
async function makeScrollableAndScrollTo(page: Page, offset: number): Promise<number> {
  return page.evaluate((target) => {
    const spacer = document.createElement('div');
    spacer.setAttribute('data-testid', 'scroll-spacer');
    spacer.style.height = '3000px';
    document.body.appendChild(spacer);
    window.scrollTo(0, target);
    return window.scrollY;
  }, offset);
}

/**
 * Wait until the router has finished its initial navigation and rendered the first page.
 * @param page Page under test.
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('main#main-content');
}

test.describe('Skip link', () => {
  test('is the first tab stop and moves focus to the main landmark on activation', async ({ page }) => {
    await test.step('Arrange', async () => {
      await page.addInitScript(() => localStorage.setItem('app.language', 'en'));
      await page.goto('/');
      await waitForAppReady(page);
    });

    await test.step('Act', async () => {
      // First Tab from a fresh load reaches the skip link before any header control.
      await page.keyboard.press('Tab');
    });

    await test.step('Assert', async () => {
      const skipLink = page.getByTestId('skip-link');
      await expect(skipLink, 'skip link should be the first tab stop').toBeFocused();
      await expect(skipLink).toHaveAttribute('href', '#main-content');

      // Activation moves focus onto the main landmark the link targets.
      await page.keyboard.press('Enter');
      await expect(page.locator('main#main-content'), 'activating the skip link should focus main').toBeFocused();
    });
  });

  test('bypasses the header, whose controls come after the skip link in tab order', async ({ page }) => {
    await test.step('Arrange', async () => {
      await page.addInitScript(() => localStorage.setItem('app.language', 'en'));
      await page.goto('/');
      await waitForAppReady(page);
    });

    await test.step('Act', async () => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
    });

    await test.step('Assert', async () => {
      // Tab from main must continue into content, never fall back into the header above it.
      await page.keyboard.press('Tab');
      const insideHeader = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('header')),
      );
      expect(insideHeader, 'tabbing from main must not re-enter the header').toBe(false);
    });
  });
});

test.describe('Focus management on navigation', () => {
  test('initial load does not steal focus', async ({ page }) => {
    await test.step('Arrange', async () => {
      await page.addInitScript(() => localStorage.setItem('app.language', 'en'));
    });

    await test.step('Act', async () => {
      await page.goto('/');
      await waitForAppReady(page);
    });

    await test.step('Assert', async () => {
      const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
      expect(focusedId, 'first paint must not move focus off the address bar').not.toBe('main-content');
    });
  });

  test('moves focus to the new page main landmark after a routed navigation', async ({ page }) => {
    await test.step('Arrange', async () => {
      await page.addInitScript(() => localStorage.setItem('app.language', 'en'));
      await page.goto('/');
      await waitForAppReady(page);
      await expect(page.locator('main#main-content')).not.toBeFocused();
    });

    await test.step('Act', async () => {
      await page.getByTestId('public-nav.about').click();
      await expect(page).toHaveURL('/about');
    });

    await test.step('Assert', async () => {
      await expect(page.locator('main#main-content'), 'navigation should focus the new page main landmark').toBeFocused();
    });
  });
});

test.describe('Anchor scrolling', () => {
  test('scrolls to the #fragment target on a client-side navigation', async ({ page }) => {
    let settledOffset = 0;

    await test.step('Arrange', async () => {
      // Short viewport, so the injected spacer makes the document meaningfully tall.
      await page.setViewportSize({ width: 800, height: 300 });
      await page.addInitScript(() => localStorage.setItem('app.language', 'en'));
      await page.goto('/');
      await waitForAppReady(page);
      settledOffset = await makeScrollableAndScrollTo(page, 2000);
      expect(settledOffset, 'test setup should have scrolled the page down').toBeGreaterThan(0);
    });

    await test.step('Act', async () => {
      // Same-document fragment navigation is what `anchorScrolling: 'enabled'` handles:
      // the router sees a URL change with a fragment and scrolls to the target itself.
      await page.evaluate(() => { window.location.hash = '#main-content'; });
      await expect(page).toHaveURL(/#main-content$/);
    });

    await test.step('Assert', async () => {
      await expect
        .poll(() => page.evaluate(() => window.scrollY), {
          message: 'a #fragment navigation should scroll to its target near the top',
        })
        .toBeLessThan(50);
    });
  });
});
