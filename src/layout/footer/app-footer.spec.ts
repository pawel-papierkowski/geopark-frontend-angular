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
    // Needed by every test asserting translated text: 'should display correct top text'
    // (footer.repository.text), 'should preserve the repository URL...' (footer.repository.label),
    // 'should warn the link opens in a new tab' (footer.repository.newTabHint)
    // and 'should display correct bottom text' (footer.copyright).
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      footer: {
        repository: {
          text: "Repository",
          label: "Repository for geopark-frontend-angular project on GitHub.",
          newTabHint: "Opens in a new tab."
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
    // The attribute may list several ids, so only require the repository description among them.
    expect(link?.getAttribute('aria-describedby')?.split(' '), 'the link should reference its description')
      .toContain(description?.id);
    expect(description?.textContent, 'description should be translated').toBe('Repository for geopark-frontend-angular project on GitHub.');
    expect(description?.hidden, 'supplementary text should not change the visible footer').toBe(true);
  });

  it('should warn the link opens in a new tab', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();

    // Act: Read the link and its description references.
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector<HTMLAnchorElement>('[data-testid="footer-repository-link"]');
    const newTabHint = compiled.querySelector<HTMLElement>('#footer-repository-newtab');
    const describedBy = link?.getAttribute('aria-describedby')?.split(' ') ?? [];

    // Assert: The link opens a new tab and its accessible description warns about it,
    // separately from the repository description.
    expect(link?.getAttribute('target'), 'link should open a new tab').toBe('_blank');
    expect(describedBy, 'description should reference both the repository text and the new-tab hint')
      .toContain('footer-repository-newtab');
    expect(describedBy, 'the original repository description must stay referenced')
      .toContain('footer-repository-description');
    expect(newTabHint?.textContent, 'new-tab hint should be translated').toBe('Opens in a new tab.');
    expect(newTabHint?.hidden, 'supplementary text should not change the visible footer').toBe(true);
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
