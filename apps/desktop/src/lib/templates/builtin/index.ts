import type { Template } from '../types';
import { blankTemplate } from './blank';
import { webAppSqlTemplate } from './web-app-sql';
import { secureWebAppTemplate } from './secure-web-app';
import { serverlessFunctionsTemplate } from './serverless-functions';
import { vmNetworkingTemplate } from './vm-networking';

export const builtinTemplates: Template[] = [
  blankTemplate,
  webAppSqlTemplate,
  secureWebAppTemplate,
  serverlessFunctionsTemplate,
  vmNetworkingTemplate,
];
