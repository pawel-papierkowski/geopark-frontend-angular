import { environment } from '@/environments/environment';

import type { ProjectProp } from './types';
import { languages } from './translation-manifest';

/** Project properties. */
export const projectProp: ProjectProp = {
  title: 'GeoPark',
  author: 'Paweł Papierkowski',
  dateRange: '2026',
  build: environment.build,
  version: environment.version, // from package.json, defined in environment.ts and related
};

/* LANGUAGE */

/** Fallback language. It must exist in list of known languages. */
export const fallbackLang = 'en' satisfies typeof languages[number];

/** List of known languages. */
export { languages };

/* ROUTING */

/** Definition of sections existing in project. */
export const sections = ['public', 'dev', 'admin'] as const;

/* OTHER */

/** Storage keys. */
export const storageKeys = {
  /** Currently set language. */
  language: 'app.language',
};
