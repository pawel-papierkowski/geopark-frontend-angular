import type { Route } from '@angular/router';

/* GENERAL */

/** Shape of environment constant. */
export type ProjectEnv = {
  production: boolean;
  build: string;
  version: string;
  apiUrl: string;
};

/** Fundamental project properties. More or less constant. */
export type ProjectProp = {
  title: string;
  author: string;
  dateRange: string;
  build: string;
  version: string;
};

/* ROUTING */

/** Definition of sections existing in project. */
export const sections = ['public', 'dev', 'admin'] as const;

/** Definition of type describing sections. */
export type Section = typeof sections[number];

/** Route with enforced section data. */
export type SectionRoute = Route & { data?: { section: Section } };
