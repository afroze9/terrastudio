<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { ui } from '$lib/stores/ui.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { t } from '$lib/i18n';
  import { invoke } from '@tauri-apps/api/core';
  import { gitShowFile } from '$lib/services/git-service';
  import CollapsibleSection from '../CollapsibleSection.svelte';

  /** Filter file statuses to only terraform-related files */
  const tfFiles = $derived(
    git.fileStatuses.filter(
      (f) => f.path.startsWith('terraform/') && !f.path.includes('.terraform/'),
    ),
  );

  function statusIcon(status: string): string {
    switch (status) {
      case 'A':
      case '?': return '+';
      case 'D': return '−';
      case 'M': return '~';
      default: return '~';
    }
  }

  function statusClass(status: string): string {
    switch (status) {
      case 'A':
      case '?': return 'added';
      case 'D': return 'removed';
      default: return 'modified';
    }
  }

  function displayPath(path: string): string {
    return path.replace(/^terraform\//, '');
  }

  async function openFileDiff(filePath: string) {
    if (!project.path) return;
    try {
      // Get committed version from HEAD
      let beforeText = '';
      try {
        beforeText = await gitShowFile(project.path, 'HEAD', filePath);
      } catch {
        // File didn't exist in HEAD (newly added)
      }

      // Get current version from disk
      let afterText = '';
      try {
        const tfRelPath = filePath.replace(/^terraform\//, '');
        afterText = await invoke<string>('read_terraform_file', {
          projectPath: project.path,
          filename: tfRelPath,
        });
      } catch {
        // File was deleted
      }

      // Set the diff data and open view
      git.setDiffFile(displayPath(filePath), beforeText, afterText);

      // If diff view is already open, it will switch to terraform mode.
      // Otherwise open a new diff tab.
      if (!git.diffMode) {
        // Need to enter diff mode with empty diagram data
        const emptySnapshot = { nodes: [], edges: [], modules: [], moduleInstances: [] };
        const emptyDiff = { resources: [], connections: [], modules: [], instances: [] };
        git.enterDiffMode(`Terraform: ${displayPath(filePath)}`, emptySnapshot, emptySnapshot, emptyDiff, 'terraform');
      }
      ui.openDiffTab(`Terraform: ${displayPath(filePath)}`);
    } catch (e) {
      git.setError(`Failed to open file diff: ${e}`);
    }
  }
</script>

<CollapsibleSection id="git-terraform" label={t('git.terraform')} count={tfFiles.length}>
  {#if tfFiles.length === 0}
    <div class="empty">{t('git.noTerraformChanges')}</div>
  {:else}
    <div class="file-list">
      {#each tfFiles as file (file.path)}
        <button class="file-item {statusClass(file.status)}" onclick={() => openFileDiff(file.path)}>
          <span class="status-icon">{statusIcon(file.status)}</span>
          <span class="file-path">{displayPath(file.path)}</span>
        </button>
      {/each}
    </div>
  {/if}
</CollapsibleSection>

<style>
  .file-list {
    display: flex;
    flex-direction: column;
  }
  .empty {
    padding: 12px 16px;
    font-size: var(--font-11);
    color: var(--color-text-muted);
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 16px;
    background: none;
    border: none;
    color: var(--color-text);
    font-size: var(--font-12);
    font-family: var(--font-mono, monospace);
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .file-item:hover {
    background: var(--color-surface-hover);
  }
  .status-icon {
    width: 14px;
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
  }
  .file-item.added .status-icon { color: var(--color-success, #4ec96b); }
  .file-item.removed .status-icon { color: var(--color-error, #ff5050); }
  .file-item.modified .status-icon { color: var(--color-warning, #e8a838); }
  .file-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-11);
  }
</style>
