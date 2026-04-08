import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '$lib/logger';
import { git, type GitFileStatus, type GitLogEntry, type GitRemoteStatus } from '$lib/stores/git.svelte';
import { project } from '$lib/stores/project.svelte';
import { computeDiagramDiff, type DiffableSnapshot } from './diff-engine';
import { diagram } from '$lib/stores/diagram.svelte';
import { generateAndWrite } from './terraform-service';

// ─── Low-level invoke wrappers ───────────────────────────────────────────────

export async function gitIsRepo(projectPath: string): Promise<boolean> {
  return invoke<boolean>('git_is_repo', { projectPath });
}

export async function gitInit(projectPath: string): Promise<boolean> {
  return invoke<boolean>('git_init', { projectPath });
}

export async function gitStatus(projectPath: string): Promise<GitFileStatus[]> {
  return invoke<GitFileStatus[]>('git_status', { projectPath });
}

export async function gitCommit(projectPath: string, message: string): Promise<boolean> {
  return invoke<boolean>('git_commit', { projectPath, message });
}

export async function gitLog(projectPath: string, count?: number): Promise<GitLogEntry[]> {
  return invoke<GitLogEntry[]>('git_log', { projectPath, count: count ?? 50 });
}

export async function gitShowFile(
  projectPath: string,
  gitRef: string,
  filePath: string,
): Promise<string> {
  return invoke<string>('git_show_file', { projectPath, gitRef, filePath });
}

export async function gitPush(projectPath: string): Promise<boolean> {
  const unlisteners: UnlistenFn[] = [];
  const appWindow = getCurrentWindow();

  try {
    unlisteners.push(
      await appWindow.listen<{ stream: string; line: string }>('git:stdout', (event) => {
        logger.debug(`[git push] ${event.payload.line}`);
      }),
    );
    unlisteners.push(
      await appWindow.listen<{ stream: string; line: string }>('git:stderr', (event) => {
        logger.debug(`[git push] ${event.payload.line}`);
      }),
    );

    return await invoke<boolean>('git_push', { projectPath });
  } finally {
    for (const unlisten of unlisteners) unlisten();
  }
}

export async function gitPull(projectPath: string): Promise<boolean> {
  const unlisteners: UnlistenFn[] = [];
  const appWindow = getCurrentWindow();

  try {
    unlisteners.push(
      await appWindow.listen<{ stream: string; line: string }>('git:stdout', (event) => {
        logger.debug(`[git pull] ${event.payload.line}`);
      }),
    );
    unlisteners.push(
      await appWindow.listen<{ stream: string; line: string }>('git:stderr', (event) => {
        logger.debug(`[git pull] ${event.payload.line}`);
      }),
    );

    return await invoke<boolean>('git_pull', { projectPath });
  } finally {
    for (const unlisten of unlisteners) unlisten();
  }
}

export async function gitBranchList(projectPath: string): Promise<string[]> {
  return invoke<string[]>('git_branch_list', { projectPath });
}

export async function gitBranchCreate(projectPath: string, name: string): Promise<boolean> {
  return invoke<boolean>('git_branch_create', { projectPath, name });
}

export async function gitBranchSwitch(projectPath: string, name: string): Promise<boolean> {
  return invoke<boolean>('git_branch_switch', { projectPath, name });
}

export async function gitRemoteStatus(projectPath: string): Promise<GitRemoteStatus> {
  return invoke<GitRemoteStatus>('git_remote_status', { projectPath });
}

export async function gitCurrentBranch(projectPath: string): Promise<string> {
  return invoke<string>('git_current_branch', { projectPath });
}

// ─── High-level orchestration ────────────────────────────────────────────────

/**
 * Full refresh of git state: repo check, branch, status, remote, history, and semantic diff.
 */
export async function refreshGitState(projectPath: string): Promise<void> {
  git.setLoading(true);
  git.setError(null);

  try {
    const isRepo = await gitIsRepo(projectPath);
    if (!isRepo) {
      git.setRepoState(false, '');
      git.setChanges(null, []);
      git.setHistory([]);
      return;
    }

    // Run these in parallel
    const [branch, fileStatuses, remoteStatus, history] = await Promise.all([
      gitCurrentBranch(projectPath).catch(() => 'HEAD'),
      gitStatus(projectPath).catch(() => [] as GitFileStatus[]),
      gitRemoteStatus(projectPath).catch(() => ({ ahead: 0, behind: 0, has_remote: false })),
      gitLog(projectPath).catch(() => [] as GitLogEntry[]),
    ]);

    git.setRepoState(true, branch);
    git.setRemoteStatus(remoteStatus);
    git.setHistory(history);

    // Always compute semantic diff (compares HEAD diagram vs in-memory state).
    // In-memory changes exist before the user saves, so git status alone won't detect them.
    let diagramDiff = null;
    if (history.length > 0) {
      try {
        diagramDiff = await computeSemanticDiff(projectPath);
      } catch (e) {
        logger.warn(`Failed to compute semantic diff: ${e}`);
      }
    }

    git.setChanges(diagramDiff, fileStatuses);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    git.setError(message);
    logger.error(`Failed to refresh git state: ${e}`);
  } finally {
    git.setLoading(false);
  }
}

/**
 * Compute semantic diff between HEAD and current diagram state.
 */
async function computeSemanticDiff(projectPath: string) {
  const committedJson = await gitShowFile(projectPath, 'HEAD', 'diagrams/main.json');
  const committed = JSON.parse(committedJson) as DiffableSnapshot;

  const current: DiffableSnapshot = {
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      parentId: n.parentId,
      width: n.measured?.width ?? n.width,
      height: n.measured?.height ?? n.height,
    })),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: e.data,
    })),
    modules: diagram.modules,
    moduleInstances: diagram.moduleInstances,
  };

  return computeDiagramDiff(committed, current);
}

/**
 * Auto-generate HCL, then commit all changes.
 */
export async function commitWithHclGeneration(
  projectPath: string,
  message: string,
): Promise<void> {
  git.setLoading(true);
  git.setError(null);

  try {
    // Step 1: Generate HCL from current diagram
    git.appendOutput('> Generating Terraform files...');
    await generateAndWrite();
    git.appendOutput('  Terraform files generated');

    // Step 2: Commit everything
    git.appendOutput(`> git add -A && git commit -m "${message}"`);
    await gitCommit(projectPath, message);
    git.appendOutput('  Commit successful');

    // Step 3: Refresh state
    await refreshGitState(projectPath);

    logger.info('Commit successful');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    git.setError(message);
    logger.error(`Commit failed: ${e}`);
    throw e;
  } finally {
    git.setLoading(false);
  }
}

/**
 * Initialize git repo and refresh state.
 */
export async function initializeRepo(projectPath: string): Promise<void> {
  git.setLoading(true);
  git.setError(null);

  try {
    git.appendOutput('> git init');
    await gitInit(projectPath);
    git.appendOutput('  Repository initialized, .gitignore created');
    await refreshGitState(projectPath);
    logger.info('Git repository initialized');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    git.setError(message);
    logger.error(`Failed to initialize git repo: ${e}`);
  } finally {
    git.setLoading(false);
  }
}

/**
 * Push and refresh state.
 */
export async function pushAndRefresh(projectPath: string): Promise<void> {
  git.setLoading(true);
  git.setError(null);

  try {
    git.appendOutput('> git push');
    await gitPush(projectPath);
    git.appendOutput('  Push complete');
    await refreshGitState(projectPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    git.setError(msg);
    logger.error(`Push failed: ${e}`);
  } finally {
    git.setLoading(false);
  }
}

/**
 * Pull (fast-forward only) and refresh state.
 */
export async function pullAndRefresh(projectPath: string): Promise<void> {
  git.setLoading(true);
  git.setError(null);

  try {
    git.appendOutput('> git pull --ff-only');
    await gitPull(projectPath);
    git.appendOutput('  Pull complete');
    await refreshGitState(projectPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    git.setError(msg);
    logger.error(`Pull failed: ${e}`);
  } finally {
    git.setLoading(false);
  }
}

/**
 * Get committed diagram snapshot for a given ref (for diff view).
 */
export async function getSnapshotAtRef(
  projectPath: string,
  ref: string,
): Promise<DiffableSnapshot> {
  const json = await gitShowFile(projectPath, ref, 'diagrams/main.json');
  return JSON.parse(json) as DiffableSnapshot;
}
