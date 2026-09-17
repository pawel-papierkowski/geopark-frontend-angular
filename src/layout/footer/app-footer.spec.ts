import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { AppFooter } from './app-footer';

// Mock production config. We only care about build, as it is shown in footer.
vi.mock('@/shared/config/const', () => ({
  projectProp: {
    title: "GeoPark",
    author: "Paweł Papierkowski",
    dateRange: "2026",
    build: "PROD",
    version: "1.0.0",
  },
}));

describe('AppFooter', () => {
  let translateService: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ AppFooter ],
    }).compileComponents();

    // Note we manually set relevant translation keys for this test suite.
    // Needed for test 'should display correct bottom text'.
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      footer: {
        repository: {
          text: "Repository",
          label: "Repository for geopark-frontend-angular project on GitHub."
        },
        copyright: '© {{dateRange}} {{author}} | v. {{version}} {{build}}',
      },
    });
  });

  it('should display correct top text', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();

    // Assert: Footer contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p:nth-of-type(1)')?.textContent).toContain('Repository');
  });

  it('should preserve the repository URL and reference a separate description', async () => {
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector<HTMLAnchorElement>('[data-testid="footer-repository-link"]');
    const description = compiled.querySelector<HTMLElement>('#footer-repository-description');

    expect(link?.textContent?.trim(), 'link text should remain the full URL').toBe('https://github.com/pawel-papierkowski/geopark-frontend-angular');
    expect(link?.hasAttribute('aria-label'), 'the visible URL must not be overridden').toBe(false);
    expect(link?.getAttribute('aria-describedby'), 'the link should reference its description').toBe(description?.id);
    expect(description?.textContent, 'description should be translated').toBe('Repository for geopark-frontend-angular project on GitHub.');
    expect(description?.hidden, 'supplementary text should not change the visible footer').toBe(true);
  });

  it('should display correct bottom text', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();

    // Assert: Footer contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p:nth-of-type(2)')?.textContent).toContain('PROD'); // without mock it would be TEST
  });
});
