import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import globals from 'globals';

/**
 * Custom rule plugin enforcing the kebab-case file-name convention from AGENTS.md
 * (e.g. `language-service.ts`, never `LanguageService.ts`). Defined inline with core ESLint
 * only - no filename-case plugin needed. Dots are allowed between lowercase segments so
 * Angular-conventional compound names like `environment.prod.ts` keep passing.
 */
const filenameConventionPlugin = {
  rules: {
    'kebab-case': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          notKebab: 'File name "{{name}}" must be kebab-case: lowercase segments separated by hyphens (dots allowed, as in environment.prod.ts).',
        },
      },
      /**
       * Report the file when its basename (extension and `.spec` marker stripped) is not
       * kebab-case. Reports on the `Program` node because file names have no AST anchor.
       * @param context ESLint rule context.
       * @returns Listeners mapping AST nodes to handlers.
       */
      create(context) {
        return {
          Program() {
            const base = context.filename.split(/[\\/]/).pop() ?? context.filename;
            const stem = base.replace(/(\.spec)?\.(ts|mts|cts)$/, '');
            if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(stem)) {
              context.report({ loc: { line: 1, column: 0 }, messageId: 'notKebab', data: { name: base } });
            }
          },
        };
      },
    },
  },
};

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
      // Guards against legacy RxJS 6 (and older) import paths. Since RxJS 7 the single public
      // API surface is 'rxjs' - creation functions and operators alike (`import { map } from 'rxjs'`).
      // 'rxjs/operators' is a compatibility path kept only for RxJS 6 code, and 'rxjs/add/*' are
      // RxJS 5 static patch imports removed in RxJS 7.
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'rxjs/operators',
            message: "Import operators from 'rxjs' instead, e.g. `import { map } from 'rxjs';`.",
          },
        ],
        patterns: [
          {
            group: ['rxjs/add/**'],
            message: "RxJS 5 patch imports are removed; import the operator from 'rxjs' instead, e.g. `import { map } from 'rxjs';`.",
          },
        ],
      }],
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
    // Guards against production code reaching for ambient browser globals instead of an injected
    // dependency:
    // - `document`: a document-wide lookup inside a component silently resolves to a foreign
    //   element when idents collide - use an injected DOCUMENT or an element-scoped lookup
    //   (`viewChild` / `ownerDocument`).
    // - `localStorage` / `sessionStorage`: the storage reference must be resolvable through DI
    //   (and therefore replaceable in tests) - use inject(StorageService).
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error',
        {
          name: 'document',
          message: 'Use inject(DOCUMENT) or an element-scoped lookup (viewChild / ownerDocument) instead of the global document.',
        },
        {
          name: 'localStorage',
          message: "Use inject(StorageService) from '@/shared/utils/storage/storage-service' instead of the global localStorage.",
        },
        {
          name: 'sessionStorage',
          message: "Use inject(StorageService) from '@/shared/utils/storage/storage-service' instead of the global sessionStorage.",
        },
      ],
    },
  },
  {
    // Specs legitimately read document.activeElement to assert focus and poke localStorage to
    // seed language preferences; e2e files live outside src, so their page.evaluate callbacks
    // are never matched by the rule above.
    files: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    // Test-only suite factories and helpers in `testing/` folders hold verbatim spec bodies
    // shared between component specs (register* suites), so they drive the global document
    // exactly like specs do - and must stay free of component/DI context to remain portable.
    files: ['src/**/testing/**/*.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    // File-name convention from AGENTS.md: application and e2e sources are kebab-case
    // (`nav-utils.ts`, never `NavUtils.ts`). Root tooling configs (vitest.config.ts, ...)
    // follow their ecosystem's camelCase convention and are deliberately not covered.
    files: ['src/**/*.ts', 'e2e/**/*.ts'],
    plugins: {
      'filename-convention': filenameConventionPlugin,
    },
    rules: {
      'filename-convention/kebab-case': 'error',
    },
  },
]);
