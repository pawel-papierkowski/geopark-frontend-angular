import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { AppFooter } from './app-footer';

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

    // note we manually set relevant translation keys
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      'footer.repository': 'Repository',
      'footer.copyright': '© {{dateRange}} {{author}} | v. {{version}} {{build}}',
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

  it('should display correct bottom text', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();

    // Assert: Footer contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p:nth-of-type(2)')?.textContent).toContain('PROD'); // without mock it would be TEST
  });
});
