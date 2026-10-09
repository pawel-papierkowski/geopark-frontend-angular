import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StorageService } from './storage-service';

/**
 * Unit tests of StorageService utility.
 */
describe('StorageService', () => {
  it('should write to and read from the browsing context storage', () => {
    // Arrange: Prepare a clean key in the real storage.
    const key = 'storage-service.spec.round-trip';
    localStorage.removeItem(key);
    const storageService = TestBed.inject(StorageService);

    // Act: Persist a value through the service.
    storageService.setItem(key, 'pl');

    // Assert: The value reaches the underlying storage and reads back through the service.
    expect(localStorage.getItem(key), 'setItem should persist the value in localStorage').toBe('pl');
    expect(storageService.getItem(key), 'getItem should return the persisted value').toBe('pl');

    // Cleanup: Do not leak the probe key into other tests.
    localStorage.removeItem(key);
    expect(storageService.getItem(key), 'getItem should report a removed key as null').toBeNull();
  });

  it('should degrade to null reads and no-op writes without a browsing context', () => {
    // Arrange: Provide a detached document, whose defaultView (and therefore storage) is null.
    const detachedDocument = document.implementation.createHTMLDocument();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: detachedDocument }],
    });
    const storageService = TestBed.inject(StorageService);

    // Act / Assert: Reads degrade to null and writes do nothing instead of throwing.
    expect(storageService.getItem('storage-service.spec.detached'), 'a document without browsing context has no storage').toBeNull();
    expect(() => storageService.setItem('storage-service.spec.detached', 'pl'), 'writing without storage must not throw').not.toThrow();
  });
});
