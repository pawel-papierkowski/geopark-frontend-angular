import { version } from '../../package.json';
import { ProjectEnv } from "@/shared/config/types";

/** Environment variables for PROD environment. */
export const environment: ProjectEnv = {
  production: true,
  build: 'PROD',
  version: version, // updates version automatically from package.json
  apiUrl: '', // TODO will be filled later
};
