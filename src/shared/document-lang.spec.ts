import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DocumentLang } from './document-lang';

describe('DocumentLang', () => {
  it('should update the injected document language in both directions', () => {
    const testDocument = document.implementation.createHTMLDocument();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: testDocument }],
    });
    const service = TestBed.inject(DocumentLang);

    service.setDocumentLang('pl');

    expect(testDocument.documentElement.lang, 'document language should be Polish').toBe('pl');

    service.setDocumentLang('en');

    expect(testDocument.documentElement.lang, 'document language should return to English').toBe('en');
  });
});
