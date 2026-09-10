import { version } from '../../package.json';
import { ProjectEnv } from "@/shared/config/types";

/** Environment variables for DEV environment. */
export const environment: ProjectEnv = {
  production: false,
  build: 'DEV',
  version: version, // updates version automatically from package.json
  apiUrl: '', // TODO will be filled later
};
