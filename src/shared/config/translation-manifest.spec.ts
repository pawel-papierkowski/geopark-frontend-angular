import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { ModuleKind, transpileModule } from 'typescript';

interface GeneratedMetadata {
  languages: readonly string[];
  translationManifest: Record<string, readonly string[]>;
}

/**
 * Unit tests of translation manifest generation.
 */
describe('translation manifest generation', () => {
  let root: string;
  let outputFile: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'geopark-i18n-'));
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'public', 'i18n'), { recursive: true });
    mkdirSync(join(root, 'src', 'shared', 'config'), { recursive: true });
    copyFileSync(
      resolve('scripts/generate-i18n-manifest.mjs'),
      join(root, 'scripts', 'generate-i18n-manifest.mjs'),
    );
    outputFile = join(root, 'src', 'shared', 'config', 'translation-manifest.ts');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function addFile(path: string, content = '{}') {
    const file = join(root, 'public', 'i18n', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  function generate() {
    return spawnSync(process.execPath, [join(root, 'scripts', 'generate-i18n-manifest.mjs')], {
      cwd: root,
      encoding: 'utf-8',
    });
  }

  function readMetadata(): GeneratedMetadata {
    const source = readFileSync(outputFile, 'utf-8');
    const { outputText } = transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS },
    });
    const context = { exports: {} };
    runInNewContext(outputText, context);
    return context.exports as GeneratedMetadata;
  }

  it('discovers sorted languages and nested JSON files from the same folders', () => {
    // Arrange
    addFile('pl/layout/header.json');
    addFile('pl/common.json');
    addFile('en/layout/footer.json');
    addFile('en/common.json');
    addFile('en/ignored.txt');
    addFile('ignored.json');

    // Act
    const result = generate();

    // Assert
    expect(result.status, result.stderr).toBe(0);
    const metadata = readMetadata();
    expect(metadata.languages, 'languages should be sorted folder names').toEqual(['en', 'pl']);
    expect(metadata.translationManifest, 'only nested JSON files should be listed').toEqual({
      en: ['common', 'layout/footer'],
      pl: ['common', 'layout/header'],
    });
    expect(Object.keys(metadata.translationManifest), 'manifest keys should match languages').toEqual(metadata.languages);
    expect(readFileSync(outputFile, 'utf-8'), 'generated exports should preserve literal types').toContain(
      'as const satisfies Record<typeof languages[number], readonly string[]>',
    );
  });

  it('produces identical output for unchanged folders', () => {
    // Arrange
    addFile('en/common.json');
    expect(generate().status, 'initial generation should succeed').toBe(0);
    const first = readFileSync(outputFile, 'utf-8');

    // Act
    const result = generate();

    // Assert
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(outputFile, 'utf-8'), 'generation should be deterministic').toBe(first);
  });

  it('updates both exports when language folders are added or removed', () => {
    // Arrange
    addFile('en/common.json');
    expect(generate().status, 'initial generation should succeed').toBe(0);

    // Act
    addFile('de/common.json');
    expect(generate().status, 'generation after addition should succeed').toBe(0);
    const added = readMetadata();
    rmSync(join(root, 'public', 'i18n', 'en'), { recursive: true });
    expect(generate().status, 'generation after removal should succeed').toBe(0);
    const removed = readMetadata();

    // Assert
    expect(added.languages, 'new folder should become a language').toEqual(['de', 'en']);
    expect(Object.keys(added.translationManifest), 'manifest should include the new language').toEqual(added.languages);
    expect(removed.languages, 'removed folder should no longer be a language').toEqual(['de']);
    expect(Object.keys(removed.translationManifest), 'manifest should exclude the removed language').toEqual(removed.languages);
  });

  it('rejects an empty language set without overwriting existing output', () => {
    // Arrange
    writeFileSync(outputFile, 'previous output');
    addFile('ignored.json');

    // Act
    const result = generate();

    // Assert
    expect(result.status, 'generation should fail without language folders').not.toBe(0);
    expect(result.stderr, 'failure should identify missing language directories').toContain('No language directories found');
    expect(readFileSync(outputFile, 'utf-8'), 'validation should happen before writing').toBe('previous output');
  });

  it('rejects a language without JSON files before writing any output', () => {
    // Arrange
    addFile('en/common.json');
    addFile('pl/nested/ignored.txt');
    writeFileSync(outputFile, 'previous output');

    // Act
    const result = generate();

    // Assert
    expect(result.status, 'generation should fail for an empty language').not.toBe(0);
    expect(result.stderr, 'failure should explain the invalid directory').toContain('contains no JSON files');
    expect(result.stderr, 'failure should identify the language').toContain(join('i18n', 'pl'));
    expect(readFileSync(outputFile, 'utf-8'), 'no partial manifest should be written').toBe('previous output');
  });
});
