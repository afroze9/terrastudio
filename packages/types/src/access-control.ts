/** Access control model for Key Vault */
export type AccessModel = 'rbac' | 'access_policy';

/** Identity source type for access grants */
export type IdentityType = 'current_user' | 'managed_identity' | 'custom';

/** A single access grant configuration */
export interface AccessGrant {
  /** Unique ID for UI keying */
  readonly id: string;
  /** Type of identity being granted access */
  readonly identity_type: IdentityType;
  /** Node ID when identity_type === 'managed_identity' */
  readonly identity_ref?: string;
  /** Principal ID when identity_type === 'custom' */
  readonly custom_principal_id?: string;
  /** RBAC role name (used when access_model === 'rbac') */
  readonly role?: string;
  /** Key permissions (used when access_model === 'access_policy') */
  readonly key_permissions?: readonly string[];
  /** Secret permissions (used when access_model === 'access_policy') */
  readonly secret_permissions?: readonly string[];
  /** Certificate permissions (used when access_model === 'access_policy') */
  readonly certificate_permissions?: readonly string[];
}

/** Available Key Vault RBAC roles */
export const KEY_VAULT_RBAC_ROLES = [
  { label: 'Key Vault Administrator', value: 'Key Vault Administrator' },
  { label: 'Key Vault Secrets User', value: 'Key Vault Secrets User' },
  { label: 'Key Vault Secrets Officer', value: 'Key Vault Secrets Officer' },
  { label: 'Key Vault Crypto User', value: 'Key Vault Crypto User' },
  { label: 'Key Vault Crypto Officer', value: 'Key Vault Crypto Officer' },
  { label: 'Key Vault Certificates Officer', value: 'Key Vault Certificates Officer' },
  { label: 'Key Vault Reader', value: 'Key Vault Reader' },
] as const;

/** Available Key Vault key permissions */
export const KEY_PERMISSIONS = [
  'Get',
  'List',
  'Update',
  'Create',
  'Import',
  'Delete',
  'Recover',
  'Backup',
  'Restore',
  'Decrypt',
  'Encrypt',
  'UnwrapKey',
  'WrapKey',
  'Verify',
  'Sign',
  'Purge',
] as const;

/** Available Key Vault secret permissions */
export const SECRET_PERMISSIONS = [
  'Get',
  'List',
  'Set',
  'Delete',
  'Recover',
  'Backup',
  'Restore',
  'Purge',
] as const;

/** Available Key Vault certificate permissions */
export const CERTIFICATE_PERMISSIONS = [
  'Get',
  'List',
  'Update',
  'Create',
  'Import',
  'Delete',
  'Recover',
  'Backup',
  'Restore',
  'ManageContacts',
  'ManageIssuers',
  'GetIssuers',
  'ListIssuers',
  'SetIssuers',
  'DeleteIssuers',
  'Purge',
] as const;
