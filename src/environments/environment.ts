/** Used in test environment. Will be replaced with other environment file as configured in angular.json. */
import { ProjectEnv } from "@/shared/config/types";

/** Environment variables for test environment. */
export const environment: ProjectEnv = {
  production: false,
  build: 'TEST',
  version: '0.0.0',
  apiUrl: '',
};
