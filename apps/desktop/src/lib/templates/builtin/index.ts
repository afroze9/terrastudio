import type { Template } from '../types';
import { blankTemplate } from './blank';
import { blankAwsTemplate } from './blank-aws';
import { blankMulticloudTemplate } from './blank-multicloud';
import { webAppSqlTemplate } from './web-app-sql';
import { secureWebAppTemplate } from './secure-web-app';
import { serverlessFunctionsTemplate } from './serverless-functions';
import { vmNetworkingTemplate } from './vm-networking';
import { hubSpokeNetworkingTemplate } from './hub-spoke-networking';
import { microservicesKeyVaultTemplate } from './microservices-keyvault';
import { serverlessDataApiTemplate } from './serverless-data-api';
import { appServiceBaselineTemplate } from './app-service-baseline';

export const builtinTemplates: Template[] = [
  blankTemplate,
  blankAwsTemplate,
  blankMulticloudTemplate,
  webAppSqlTemplate,
  secureWebAppTemplate,
  serverlessFunctionsTemplate,
  vmNetworkingTemplate,
  hubSpokeNetworkingTemplate,
  microservicesKeyVaultTemplate,
  serverlessDataApiTemplate,
  appServiceBaselineTemplate,
];
