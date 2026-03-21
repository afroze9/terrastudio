import type { InfraPlugin, ResourceTypeId, ResourceTypeRegistration } from '@terrastudio/types';
import { stickyNoteRegistration } from './resources/sticky-note/index.js';
import { userRegistration } from './resources/user/index.js';
import { userGroupRegistration } from './resources/user-group/index.js';
import { serverRegistration } from './resources/server/index.js';
import { clientRegistration } from './resources/client/index.js';
import { browserRegistration } from './resources/browser/index.js';
import { mobileDeviceRegistration } from './resources/mobile-device/index.js';
import { genericAppRegistration } from './resources/generic-app/index.js';
import { externalDatabaseRegistration } from './resources/external-database/index.js';
import { regionRegistration } from './resources/region/index.js';

const resourceTypes = new Map<ResourceTypeId, ResourceTypeRegistration>([
  ['_annotation/general/sticky_note', stickyNoteRegistration],
  ['_annotation/general/user', userRegistration],
  ['_annotation/general/user_group', userGroupRegistration],
  ['_annotation/general/server', serverRegistration],
  ['_annotation/general/client', clientRegistration],
  ['_annotation/general/browser', browserRegistration],
  ['_annotation/general/mobile_device', mobileDeviceRegistration],
  ['_annotation/general/generic_app', genericAppRegistration],
  ['_annotation/general/external_database', externalDatabaseRegistration],
  ['_annotation/general/region', regionRegistration],
]);

const plugin: InfraPlugin = {
  id: '@terrastudio/plugin-annotations',
  name: 'Annotations',
  version: '0.1.0',
  providerId: '_annotation',

  resourceTypes,
  connectionRules: [],

  paletteCategories: [
    {
      id: 'general',
      label: 'Annotations',
      order: 0,
    },
  ],
};

export default plugin;
