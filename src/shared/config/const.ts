import { environment } from '@/environments/environment';

import type { ProjectProp } from './types';
import { languages } from './translation-manifest';

/** Project properties. */
export const projectProp: ProjectProp = {
  title: 'GeoPark',
  author: 'Paweł Papierkowski',
  dateRange: '2026',
  build: environment.build,
  version: environment.version, // from package.json in environment.dev.ts/environment.prod.ts; default environment.ts hardcodes '0.0.0'
};

/* LANGUAGE */

/** Fallback language. It must exist in the list of known languages. */
export const fallbackLang = 'en' satisfies typeof languages[number];

/** List of known languages. */
export { languages };

/* ROUTING */

/** Definition of the sections existing in the project. */
export const sections = ['public', 'dev', 'admin'] as const;

/* OTHER */

/** Storage keys. */
export const storageKeys = {
  /** Currently set language. */
  language: 'app.language',
};
