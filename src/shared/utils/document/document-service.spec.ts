import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DocumentService } from './document-service';

/**
 * Unit tests of DocumentService utility.
 */
describe('DocumentLang', () => {
  it('should update the injected document language in both directions', () => {
    // Arrange: Prepare document.
    const testDocument = document.implementation.createHTMLDocument();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: testDocument }],
    });
    const documentService = TestBed.inject(DocumentService);

    // Act: Set document language to Polish.
    documentService.setDocumentLang('pl');
    // Assert: Document language is actually Polish.
    expect(testDocument.documentElement.lang, 'document language should be Polish').toBe('pl');

    // Act: Set document language to English.
    documentService.setDocumentLang('en');
    // Assert: Document language is actually English.
    expect(testDocument.documentElement.lang, 'document language should return to English').toBe('en');
  });
});
