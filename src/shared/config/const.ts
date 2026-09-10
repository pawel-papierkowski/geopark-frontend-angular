import { environment } from '@/environments/environment';

import type { ProjectProp } from './types';

/** Project properties. */
export const projectProp: ProjectProp = {
  title: "GeoPark",
  author: "Paweł Papierkowski",
  dateRange: "2026",
  build: environment.build,
  version: environment.version, // from package.json, defined in environment.ts and related
};

//

/** Fallback language. */
export const fallbackLang = 'en';

/** List of known languages. */
export const languages: string[] = [ 'en', 'pl' ];

//

/** Storage keys. */
export const storageKeys = {
  /** Currently set language. */
  language: 'app.language',
};
