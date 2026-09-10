import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { LangSwitcher } from './lang-switcher';
import { storageKeys } from "@/shared/config/const";

describe('LangSwitcher', () => {
  let translateService: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ LangSwitcher ],
    }).compileComponents();

    // note we manually set relevant translation keys
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      'app.language.pl': 'Polish',
      'app.language.en': 'English',
      'app.language.flag.en': '🇬🇧',
      'app.language.flag.pl': '🇵🇱',
    });
    translateService.setTranslation('pl', {
      'app.language.pl': 'Polski',
      'app.language.en': 'Angielski',
      'app.language.flag.en': '🇬🇧',
      'app.language.flag.pl': '🇵🇱',
    });
  });

  it('should render flags', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(LangSwitcher);
    await fixture.whenStable();

    // Assert: Default language is English.
    expect(translateService.currentLang()).toBe('en');

    // Assert: Language switcher contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    const flags = compiled.querySelectorAll('.flag');

    expect(flags[0].textContent).toContain('🇬🇧');
    expect(flags[0].getAttribute('title')).toBe('English');
    expect(flags[1].textContent).toContain('🇵🇱');
    expect(flags[1].getAttribute('title')).toBe('Polish');
  });

  it('should switch language', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(LangSwitcher);
    fixture.detectChanges();

    // Act: Change language.
    fixture.componentInstance.selectLang('pl');
    await fixture.whenStable();

    // Assert: Current language is Polish.
    expect(translateService.currentLang()).toBe('pl');
    // Assert: Language in storage is also Polish.
    expect(localStorage.getItem(storageKeys.language)).toBe('pl');

    // Assert: Language switcher contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    const flags = compiled.querySelectorAll('.flag');

    expect(flags[0].textContent).toContain('🇬🇧');
    expect(flags[0].getAttribute('title')).toBe('Angielski');
    expect(flags[1].textContent).toContain('🇵🇱');
    expect(flags[1].getAttribute('title')).toBe('Polski');
  });
});
