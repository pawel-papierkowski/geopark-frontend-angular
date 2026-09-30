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
]);
