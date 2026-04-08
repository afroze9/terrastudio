<script lang="ts">
  import { git } from '$lib/stores/git.svelte';
  import { project } from '$lib/stores/project.svelte';
  import { gitBranchList, gitBranchCreate, gitBranchSwitch, refreshGitState } from '$lib/services/git-service';

  let showDropdown = $state(false);
  let branches = $state<string[]>([]);
  let newBranchName = $state('');
  let showNewBranch = $state(false);

  async function loadBranches() {
    if (!project.path) return;
    try {
      branches = await gitBranchList(project.path);
    } catch {
      branches = [];
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
    if (showDropdown) {
      loadBranches();
      showNewBranch = false;
      newBranchName = '';
    }
  }

  async function switchBranch(name: string) {
    if (!project.path || name === git.branch) return;
    showDropdown = false;
    await gitBranchSwitch(project.path, name);
    await refreshGitState(project.path);
  }

  async function createBranch() {
    if (!project.path || !newBranchName.trim()) return;
    showDropdown = false;
    await gitBranchCreate(project.path, newBranchName.trim());
    await refreshGitState(project.path);
    newBranchName = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') createBranch();
    if (e.key === 'Escape') {
      showNewBranch = false;
      newBranchName = '';
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="branch-bar">
  <button class="branch-btn" onclick={toggleDropdown}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
      <path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>
    </svg>
    <span class="branch-name">{git.branch || 'HEAD'}</span>
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 6 8 10 12 6"/>
    </svg>
  </button>

  {#if showDropdown}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="backdrop" onclick={() => (showDropdown = false)}></div>
    <div class="dropdown">
      {#each branches as branch}
        <button
          class="dropdown-item"
          class:active={branch === git.branch}
          onclick={() => switchBranch(branch)}
        >
          {branch}
          {#if branch === git.branch}
            <span class="check">✓</span>
          {/if}
        </button>
      {/each}

      {#if !showNewBranch}
        <button class="dropdown-item new-branch" onclick={() => (showNewBranch = true)}>
          + New branch
        </button>
      {:else}
        <div class="new-branch-input">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            placeholder="Branch name..."
            bind:value={newBranchName}
            onkeydown={handleKeydown}
            autofocus
          />
          <button class="create-btn" onclick={createBranch} disabled={!newBranchName.trim()}>
            Create
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .branch-bar {
    position: relative;
    padding: 6px 12px;
    border-bottom: 1px solid var(--color-border);
  }
  .branch-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--font-12);
  }
  .branch-btn:hover {
    background: var(--color-surface-hover);
  }
  .branch-name {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
  .dropdown {
    position: absolute;
    left: 12px;
    right: 12px;
    top: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    color: var(--color-text);
    font-size: var(--font-12);
    cursor: pointer;
    text-align: left;
  }
  .dropdown-item:hover {
    background: var(--color-surface-hover);
  }
  .dropdown-item.active {
    color: var(--color-accent);
  }
  .dropdown-item.new-branch {
    color: var(--color-accent);
    border-top: 1px solid var(--color-border);
  }
  .check {
    margin-left: auto;
    font-size: 11px;
  }
  .new-branch-input {
    display: flex;
    gap: 4px;
    padding: 6px;
    border-top: 1px solid var(--color-border);
  }
  .new-branch-input input {
    flex: 1;
    padding: 3px 6px;
    font-size: var(--font-11);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    color: var(--color-text);
    outline: none;
  }
  .new-branch-input input:focus {
    border-color: var(--color-accent);
  }
  .create-btn {
    padding: 3px 8px;
    font-size: var(--font-11);
    background: var(--color-accent);
    color: var(--color-bg);
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }
  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
