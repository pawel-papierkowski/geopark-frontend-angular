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
