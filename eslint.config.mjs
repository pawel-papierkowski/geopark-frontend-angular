import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import globals from 'globals';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '.angular/**',
    'dist/**',
    'tmp/**',
    'bazel-out/**',
    '.history/**',
    'blob-report/**',
    'out-tsc/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'playwright/.cache/**',
    'playwright/.auth/**',
    'src/shared/config/translation-manifest.ts',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        // Type-aware linting: required by rules that need type information
        // (e.g. @typescript-eslint/no-floating-promises).
        projectService: {
          // Files not covered by any tsconfig (root tsconfig only has references).
          allowDefaultProject: ['vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  {
    // Guards against production code reaching for the global document instead of an injected
    // DOCUMENT or an element-scoped lookup (`viewChild` / `ownerDocument`) - a document-wide
    // lookup inside a component silently resolves to a foreign element when idents collide.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', {
        name: 'document',
        message: 'Use inject(DOCUMENT) or an element-scoped lookup (viewChild / ownerDocument) instead of the global document.',
      }],
    },
  },
  {
    // Specs legitimately read document.activeElement to assert focus; e2e files live outside
    // src, so their page.evaluate callbacks are never matched by the rule above.
    files: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
]);
