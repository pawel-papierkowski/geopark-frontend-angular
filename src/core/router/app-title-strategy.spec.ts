import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { AppTitleStrategy } from './app-title-strategy';

/**
 * Builds a minimal router state snapshot containing a single chain of primary routes.
 * The strategy only reads `data` and primary `children`, so real ActivatedRouteSnapshot
 * instances (which need router-internal constructor arguments) are not required.
 * @param rootData Route data of the root route.
 * @param rest Route data of every deeper route, ending with the leaf.
 * @returns Snapshot accepted by the title strategy.
 */
function stateWith(rootData: Record<string, unknown>, ...rest: Record<string, unknown>[]): RouterStateSnapshot {
  const nodes = [rootData, ...rest].map(data => ({ outlet: 'primary', data, children: [] as unknown[] }));
  for (let index = 1; index < nodes.length; index++) {
    nodes[index - 1].children.push(nodes[index]);
  }
  return { url: '/', root: nodes[0], state: {} } as unknown as RouterStateSnapshot;
}

/**
 * Unit tests of the localized document title strategy.
 */
describe('AppTitleStrategy', () => {
  let strategy: AppTitleStrategy;
  let translateService: TranslateService;
  let titleService: Title;

  /** Prepare an isolated translation environment with English and Polish page titles. */
  beforeEach(() => {
    TestBed.configureTestingModule({});
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', { app: { page: { about: 'About', notFound: '404 Page Not Found' } } });
    translateService.setTranslation('pl', { app: { page: { about: 'O nas', notFound: '404 Strona Nie Odnaleziona' } } });
    strategy = TestBed.inject(AppTitleStrategy);
    titleService = TestBed.inject(Title);
  });

  describe('buildTitle', () => {
    it('should pair the translated page name with the project name', () => {
      // Arrange: Route chain whose leaf declares a translated title key.
      const snapshot = stateWith({ section: 'public' }, { titleKey: 'app.page.about' });

      // Act: Build the title of the state.
      const title = strategy.buildTitle(snapshot);

      // Assert: Title is composed as "Page - GeoPark".
      expect(title, 'translated page title should be suffixed with the project name').toBe('About - GeoPark');
    });

    it('should fall back to the project name when no route declares a title key', () => {
      // Arrange: Route chain without any title key (landing page case).
      const snapshot = stateWith({ section: 'public' }, {});

      // Act: Build the title of the state.
      const title = strategy.buildTitle(snapshot);

      // Assert: Bare project name is used.
      expect(title, 'landing page should use the bare project name').toBe('GeoPark');
    });

    it('should prefer the deepest declared title key', () => {
      // Arrange: Parent and leaf both declare a title key.
      const snapshot = stateWith({ titleKey: 'app.page.about' }, { titleKey: 'app.page.notFound' });

      // Act: Build the title of the state.
      const title = strategy.buildTitle(snapshot);

      // Assert: Deepest declaration wins.
      expect(title, 'deepest route title key should win').toBe('404 Page Not Found - GeoPark');
    });

    it('should return undefined while the title translation is not available', () => {
      // Arrange: Route chain with a key that has no translation yet.
      const snapshot = stateWith({ titleKey: 'app.page.dashboard' });

      // Act: Build the title of the state.
      const title = strategy.buildTitle(snapshot);

      // Assert: No title is produced, so the current document title stays untouched.
      expect(title, 'missing translation should defer the title update').toBeUndefined();
    });
  });

  describe('updateTitle', () => {
    it('should write the built title to the document', () => {
      // Arrange: Route chain with a translated title key.
      const snapshot = stateWith({ titleKey: 'app.page.about' });

      // Act: Apply the navigation state.
      strategy.updateTitle(snapshot);

      // Assert: Document title describes the page.
      expect(titleService.getTitle(), 'document title should show the current page').toBe('About - GeoPark');
    });

    it('should keep the previous title when the new translation is unavailable', () => {
      // Arrange: A known title was already applied.
      strategy.updateTitle(stateWith({ titleKey: 'app.page.about' }));

      // Act: Apply a navigation whose key has no translation.
      strategy.updateTitle(stateWith({ titleKey: 'app.page.dashboard' }));

      // Assert: The valid title is not overwritten.
      expect(titleService.getTitle(), 'untranslated navigation must not overwrite the title').toBe('About - GeoPark');
    });
  });

  describe('language change', () => {
    it('should rebuild the remembered title when a language becomes active', () => {
      // Arrange: English title applied for a remembered navigation.
      strategy.updateTitle(stateWith({ titleKey: 'app.page.about' }));
      expect(titleService.getTitle(), 'precondition - English title should be applied').toBe('About - GeoPark');

      // Act: Activate Polish translations.
      translateService.use('pl');

      // Assert: Document title follows the newly activated language.
      expect(titleService.getTitle(), 'title should be rebuilt in Polish').toBe('O nas - GeoPark');
    });

    it('should leave the document untouched before the first navigation', () => {
      // Arrange: Known document title, but no navigation was applied yet.
      titleService.setTitle('GeoPark');

      // Act: Activate Polish translations.
      translateService.use('pl');

      // Assert: Without a remembered navigation there is nothing to rebuild.
      expect(titleService.getTitle(), 'language change before navigation must not touch the title').toBe('GeoPark');
    });
  });
});
