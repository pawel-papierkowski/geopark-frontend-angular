import type { Route } from '@angular/router';
import { languages, sections } from './const';

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

/* LANGUAGE */

/** Definition of type describing known languages for this project. */
export type Lang = typeof languages[number];

/* ROUTING */

/** Definition of type describing sections. */
export type Section = typeof sections[number];

/** Route with enforced section data. */
export type SectionRoute = Route & { data?: { section: Section } };
