<script lang="ts">
  import { diagram } from '$lib/stores/diagram.svelte';
  import CollapsiblePanelSection from './CollapsiblePanelSection.svelte';
  import type {
    AccessModel,
    IdentityType,
    AccessGrant,
  } from '@terrastudio/types';
  import {
    KEY_VAULT_RBAC_ROLES,
    KEY_PERMISSIONS,
    SECRET_PERMISSIONS,
    CERTIFICATE_PERMISSIONS,
  } from '@terrastudio/types';

  interface Props {
    accessModel: AccessModel;
    accessGrants: AccessGrant[];
    onAccessModelChange: (model: AccessModel) => void;
    onGrantsChange: (grants: AccessGrant[]) => void;
  }

  let { accessModel, accessGrants, onAccessModelChange, onGrantsChange }: Props = $props();

  // UI state for the add form
  let showAddForm = $state(false);
  let editingGrantId = $state<string | null>(null);

  // Form state
  let formIdentityType = $state<IdentityType>('current_user');
  let formIdentityRef = $state<string>('');
  let formCustomPrincipalId = $state<string>('');
  let formRole = $state<string>('Key Vault Secrets User');
  let formKeyPermissions = $state<string[]>([]);
  let formSecretPermissions = $state<string[]>(['Get', 'List']);
  let formCertificatePermissions = $state<string[]>([]);

  // Get managed identities from diagram
  let managedIdentities = $derived(
    diagram.nodes
      .filter(n => n.data.typeId === 'azurerm/identity/user_assigned_identity')
      .map(n => ({ id: n.id, label: n.data.label as string }))
  );

  function resetForm() {
    formIdentityType = 'current_user';
    formIdentityRef = '';
    formCustomPrincipalId = '';
    formRole = 'Key Vault Secrets User';
    formKeyPermissions = [];
    formSecretPermissions = ['Get', 'List'];
    formCertificatePermissions = [];
    showAddForm = false;
    editingGrantId = null;
  }

  function generateId(): string {
    return `grant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function handleAddGrant() {
    const newGrant: AccessGrant = {
      id: editingGrantId ?? generateId(),
      identity_type: formIdentityType,
      identity_ref: formIdentityType === 'managed_identity' ? formIdentityRef : undefined,
      custom_principal_id: formIdentityType === 'custom' ? formCustomPrincipalId : undefined,
      role: accessModel === 'rbac' ? formRole : undefined,
      key_permissions: accessModel === 'access_policy' ? formKeyPermissions : undefined,
      secret_permissions: accessModel === 'access_policy' ? formSecretPermissions : undefined,
      certificate_permissions: accessModel === 'access_policy' ? formCertificatePermissions : undefined,
    };

    if (editingGrantId) {
      // Update existing grant
      onGrantsChange(accessGrants.map(g => g.id === editingGrantId ? newGrant : g));
    } else {
      // Add new grant
      onGrantsChange([...accessGrants, newGrant]);
    }
    resetForm();
  }

  function handleEditGrant(grant: AccessGrant) {
    editingGrantId = grant.id;
    formIdentityType = grant.identity_type;
    formIdentityRef = grant.identity_ref ?? '';
    formCustomPrincipalId = grant.custom_principal_id ?? '';
    formRole = grant.role ?? 'Key Vault Secrets User';
    formKeyPermissions = [...(grant.key_permissions ?? [])];
    formSecretPermissions = [...(grant.secret_permissions ?? [])];
    formCertificatePermissions = [...(grant.certificate_permissions ?? [])];
    showAddForm = true;
  }

  function handleDeleteGrant(grantId: string) {
    onGrantsChange(accessGrants.filter(g => g.id !== grantId));
  }

  function togglePermission(list: string[], permission: string): string[] {
    return list.includes(permission)
      ? list.filter(p => p !== permission)
      : [...list, permission];
  }

  function getIdentityLabel(grant: AccessGrant): string {
    switch (grant.identity_type) {
      case 'current_user':
        return 'Current User';
      case 'managed_identity': {
        const identity = managedIdentities.find(i => i.id === grant.identity_ref);
        return identity?.label ?? 'Unknown Identity';
      }
      case 'custom':
        return grant.custom_principal_id ?? 'Custom Principal';
      default:
        return 'Unknown';
    }
  }

  function getPermissionsSummary(grant: AccessGrant): string {
    if (accessModel === 'rbac') {
      return grant.role ?? '';
    }
    const parts: string[] = [];
    if (grant.key_permissions?.length) parts.push(`${grant.key_permissions.length} key`);
    if (grant.secret_permissions?.length) parts.push(`${grant.secret_permissions.length} secret`);
    if (grant.certificate_permissions?.length) parts.push(`${grant.certificate_permissions.length} cert`);
    return parts.join(', ') || 'No permissions';
  }

  // Validate form
  let isFormValid = $derived.by(() => {
    if (formIdentityType === 'managed_identity' && !formIdentityRef) return false;
    if (formIdentityType === 'custom' && !formCustomPrincipalId.trim()) return false;
    if (accessModel === 'rbac' && !formRole) return false;
    if (accessModel === 'access_policy') {
      const hasAnyPermission =
        formKeyPermissions.length > 0 ||
        formSecretPermissions.length > 0 ||
        formCertificatePermissions.length > 0;
      if (!hasAnyPermission) return false;
    }
    return true;
  });
</script>

<CollapsiblePanelSection id="props-kv-access-control" label="Access Control" count={accessGrants.length || undefined}>
  <div class="access-model-toggle">
    <label class="field-label">
      <span class="label-text">Access Model</span>
      <select
        value={accessModel}
        onchange={(e) => onAccessModelChange((e.target as HTMLSelectElement).value as AccessModel)}
      >
        <option value="rbac">Azure RBAC (Recommended)</option>
        <option value="access_policy">Vault Access Policy</option>
      </select>
    </label>
  </div>

  {#if accessGrants.length > 0}
    <div class="grants-list">
      {#each accessGrants as grant (grant.id)}
        <div class="grant-item">
          <div class="grant-info">
            <span class="grant-identity">{getIdentityLabel(grant)}</span>
            <span class="grant-permissions">{getPermissionsSummary(grant)}</span>
          </div>
          <div class="grant-actions">
            <button
              class="edit-btn"
              onclick={() => handleEditGrant(grant)}
              aria-label="Edit"
              title="Edit"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              class="delete-btn"
              onclick={() => handleDeleteGrant(grant.id)}
              aria-label="Delete"
              title="Delete"
            >&times;</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if showAddForm}
    <div class="add-form">
      <div class="form-header">
        <span>{editingGrantId ? 'Edit' : 'Add'} Access Grant</span>
        <button class="cancel-btn" onclick={resetForm}>&times;</button>
      </div>

      <div class="form-field">
        <label class="field-label">
          <span class="label-text">Identity</span>
          <select bind:value={formIdentityType}>
            <option value="current_user">Current User (Executing Identity)</option>
            <option value="managed_identity">Managed Identity</option>
            <option value="custom">Custom Principal ID</option>
          </select>
        </label>
      </div>

      {#if formIdentityType === 'managed_identity'}
        <div class="form-field">
          <label class="field-label">
            <span class="label-text">Select Identity</span>
            {#if managedIdentities.length > 0}
              <select bind:value={formIdentityRef}>
                <option value="">Select...</option>
                {#each managedIdentities as identity}
                  <option value={identity.id}>{identity.label}</option>
                {/each}
              </select>
            {:else}
              <span class="no-identities-hint">No managed identities in diagram</span>
            {/if}
          </label>
        </div>
      {/if}

      {#if formIdentityType === 'custom'}
        <div class="form-field">
          <label class="field-label">
            <span class="label-text">Principal ID</span>
            <input
              type="text"
              bind:value={formCustomPrincipalId}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
        </div>
      {/if}

      {#if accessModel === 'rbac'}
        <div class="form-field">
          <label class="field-label">
            <span class="label-text">Role</span>
            <select bind:value={formRole}>
              {#each KEY_VAULT_RBAC_ROLES as role}
                <option value={role.value}>{role.label}</option>
              {/each}
            </select>
          </label>
        </div>
      {:else}
        <div class="form-field permissions-field">
          <span class="label-text">Secret Permissions</span>
          <div class="permission-checkboxes">
            {#each SECRET_PERMISSIONS as perm}
              <label class="permission-checkbox">
                <input
                  type="checkbox"
                  checked={formSecretPermissions.includes(perm)}
                  onchange={() => { formSecretPermissions = togglePermission(formSecretPermissions, perm); }}
                />
                <span>{perm}</span>
              </label>
            {/each}
          </div>
        </div>

        <div class="form-field permissions-field">
          <span class="label-text">Key Permissions</span>
          <div class="permission-checkboxes">
            {#each KEY_PERMISSIONS as perm}
              <label class="permission-checkbox">
                <input
                  type="checkbox"
                  checked={formKeyPermissions.includes(perm)}
                  onchange={() => { formKeyPermissions = togglePermission(formKeyPermissions, perm); }}
                />
                <span>{perm}</span>
              </label>
            {/each}
          </div>
        </div>

        <div class="form-field permissions-field">
          <span class="label-text">Certificate Permissions</span>
          <div class="permission-checkboxes">
            {#each CERTIFICATE_PERMISSIONS as perm}
              <label class="permission-checkbox">
                <input
                  type="checkbox"
                  checked={formCertificatePermissions.includes(perm)}
                  onchange={() => { formCertificatePermissions = togglePermission(formCertificatePermissions, perm); }}
                />
                <span>{perm}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <button
        class="save-btn"
        disabled={!isFormValid}
        onclick={handleAddGrant}
      >
        {editingGrantId ? 'Update' : 'Add'} Grant
      </button>
    </div>
  {:else}
    <button class="add-grant-btn" onclick={() => { showAddForm = true; }}>
      + Add Access Grant
    </button>
  {/if}
</CollapsiblePanelSection>

<style>
  .access-model-toggle {
    margin-bottom: 12px;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .label-text {
    font-weight: 500;
  }

  select,
  input[type='text'] {
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  select:focus,
  input[type='text']:focus {
    border-color: var(--color-accent);
  }

  .grants-list {
    margin-bottom: 12px;
  }

  .grant-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    margin-bottom: 6px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .grant-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .grant-identity {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grant-permissions {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .grant-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .edit-btn,
  .delete-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 3px 5px;
    line-height: 1;
    transition: color 0.15s, border-color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .edit-btn:hover {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .delete-btn {
    font-size: 14px;
  }

  .delete-btn:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .add-grant-btn {
    width: 100%;
    padding: 8px;
    border: 1px dashed var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .add-grant-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .add-form {
    padding: 12px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text);
  }

  .cancel-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .cancel-btn:hover {
    color: var(--color-text);
  }

  .form-field {
    margin-bottom: 10px;
  }

  .permissions-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .permission-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    max-height: 120px;
    overflow-y: auto;
  }

  .permission-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-text);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    transition: all 0.15s;
  }

  .permission-checkbox:hover {
    border-color: var(--color-accent);
  }

  .permission-checkbox:has(input:checked) {
    background: rgba(59, 130, 246, 0.1);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .permission-checkbox input[type='checkbox'] {
    accent-color: var(--color-accent);
    width: 12px;
    height: 12px;
  }

  .no-identities-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    font-style: italic;
    padding: 8px;
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: 6px;
    text-align: center;
  }

  .save-btn {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 6px;
    background: var(--color-accent);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
