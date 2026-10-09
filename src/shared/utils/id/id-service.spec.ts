import { TestBed } from '@angular/core/testing';

import { IdService } from './id-service';

/**
 * Unit tests of IdService utility.
 */
describe('IdService', () => {
  describe('conditions', () => {
    it('should use given identifier if correct', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act: Request actual identifier.
      const id = service.next('proper-ident', 'text-box');

      // Assert: Used actual identifier.
      expect(id, 'identifier should be proper-ident').toBe('proper-ident');
    });

    it('should pass through string identifier that is not a valid CSS selector', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act: Request identifiers that cannot appear in a `#...` selector.
      const numeric = service.next('123', 'text-box');
      const spaced = service.next('has space', 'text-box');

      // Assert: Identifiers are returned verbatim (components support arbitrary idents).
      expect(numeric, 'identifier should be 123 verbatim').toBe('123');
      expect(spaced, 'identifier should be "has space" verbatim').toBe('has space');
    });

    it('should generate identifier if ident is not a string', () => {
      // Arrange: Prepare service. The parameter type rejects non-strings, so bypass it the way
      // a cast or plain JS caller would - this exercises the runtime guard.
      const service = TestBed.inject(IdService);

      // Act and Assert: Verify identifiers.
      const number = service.next(42 as unknown as string, 'text-box');
      expect(number, 'non-string number should produce text-box-1').toBe('text-box-1');

      const bool = service.next(true as unknown as string, 'text-box');
      expect(bool, 'non-string boolean should produce text-box-2').toBe('text-box-2');

      const object = service.next({} as unknown as string, 'text-box');
      expect(object, 'non-string object should produce text-box-3').toBe('text-box-3');
    });

    it('should use generated identifier if invalid value', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act and Assert: Verify identifiers.
      const id0 = service.next(undefined, '');
      expect(id0, 'identifier should be -1').toBe('-1');

      const idNull = service.next(null, '');
      expect(idNull, 'identifier should be -2').toBe('-2');

      const id1 = service.next('', '');
      expect(id1, 'identifier should be -3').toBe('-3');

      const id2 = service.next('   ', '');
      expect(id2, 'identifier should be -4').toBe('-4');
    });
  });

  describe('generated', () => {
    it('should generate identifiers following prefix-number pattern', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act: Request first identifier.
      const id = service.next(undefined, 'text-box');

      // Assert: Identifier uses given prefix and starts numbering from 1.
      expect(id, 'identifier should be text-box-1').toBe('text-box-1');
    });

    it('should increment numbers within the same prefix', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act: Request two identifiers with the same prefix.
      const first = service.next(undefined, 'combo-box');
      const second = service.next(undefined, 'combo-box');

      // Assert: Second identifier has greater number than first one.
      expect(first, 'first identifier should be combo-box-1').toBe('combo-box-1');
      expect(second, 'second identifier should be combo-box-2').toBe('combo-box-2');
    });

    it('should keep separate numbering sequences per prefix', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act: Request identifiers for different prefixes interleaved.
      const textBox = service.next(undefined, 'text-box');
      const checkBox = service.next(undefined, 'check-box');
      const textBoxAgain = service.next(undefined, 'text-box');

      // Assert: Each prefix counts independently.
      expect(textBox, 'first text-box identifier should be text-box-1').toBe('text-box-1');
      expect(checkBox, 'first check-box identifier should be check-box-1').toBe('check-box-1');
      expect(textBoxAgain, 'second text-box identifier should be text-box-2').toBe('text-box-2');
    });

    it('should never return the same identifier twice', () => {
      // Arrange: Prepare service.
      const service = TestBed.inject(IdService);

      // Act: Request many identifiers across prefixes.
      const ids = Array.from({ length: 50 }, (_, i) => service.next(undefined, i % 2 === 0 ? 'radio-box' : 'combo-box'));

      // Assert: All identifiers are unique.
      expect(new Set(ids).size, 'generated identifiers should be unique').toBe(ids.length);
    });
  });
});
