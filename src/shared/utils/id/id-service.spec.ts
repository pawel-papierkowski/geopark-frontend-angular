import { TestBed } from '@angular/core/testing';

import { IdService } from './id-service';

/**
 * Unit tests of IdService utility.
 */
describe('IdService', () => {
  it('should generate identifiers following prefix-number pattern', () => {
    // Arrange: Prepare service.
    const service = TestBed.inject(IdService);

    // Act: Request first identifier.
    const id = service.next('text-box');

    // Assert: Identifier uses given prefix and starts numbering from 1.
    expect(id, 'identifier should be text-box-1').toBe('text-box-1');
  });

  it('should increment numbers within the same prefix', () => {
    // Arrange: Prepare service.
    const service = TestBed.inject(IdService);

    // Act: Request two identifiers with the same prefix.
    const first = service.next('combo-box');
    const second = service.next('combo-box');

    // Assert: Second identifier has greater number than first one.
    expect(first, 'first identifier should be combo-box-1').toBe('combo-box-1');
    expect(second, 'second identifier should be combo-box-2').toBe('combo-box-2');
  });

  it('should keep separate numbering sequences per prefix', () => {
    // Arrange: Prepare service.
    const service = TestBed.inject(IdService);

    // Act: Request identifiers for different prefixes interleaved.
    const textBox = service.next('text-box');
    const checkBox = service.next('check-box');
    const textBoxAgain = service.next('text-box');

    // Assert: Each prefix counts independently.
    expect(textBox, 'first text-box identifier should be text-box-1').toBe('text-box-1');
    expect(checkBox, 'first check-box identifier should be check-box-1').toBe('check-box-1');
    expect(textBoxAgain, 'second text-box identifier should be text-box-2').toBe('text-box-2');
  });

  it('should never return the same identifier twice', () => {
    // Arrange: Prepare service.
    const service = TestBed.inject(IdService);

    // Act: Request many identifiers across prefixes.
    const ids = Array.from({ length: 50 }, (_, i) => service.next(i % 2 === 0 ? 'radio-box' : 'combo-box'));

    // Assert: All identifiers are unique.
    expect(new Set(ids).size, 'generated identifiers should be unique').toBe(ids.length);
  });
});
