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
