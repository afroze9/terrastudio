import type { DiagramDiff, DiffableSnapshot } from '$lib/services/diff-engine';

export interface GitFileStatus {
  status: string; // "A" | "M" | "D" | "?" | "R"
  path: string;
}

export interface GitLogEntry {
  hash: string;
  short_hash: string;
  message: string;
  date: string;
  author: string;
}

export interface GitRemoteStatus {
  ahead: number;
  behind: number;
  has_remote: boolean;
}

class GitStore {
  // --- Repository state ---
  isRepo = $state(false);
  branch = $state('');
  ahead = $state(0);
  behind = $state(0);
  hasRemote = $state(false);

  // --- Changes ---
  changes = $state<DiagramDiff | null>(null);
  fileStatuses = $state<GitFileStatus[]>([]);

  // --- History ---
  history = $state<GitLogEntry[]>([]);

  // --- Output log (like VS Code's Git output channel) ---
  outputLines = $state<{ line: string; timestamp: string }[]>([]);

  // --- UI state ---
  loading = $state(false);
  error = $state<string | null>(null);

  // --- Diff view state ---
  diffMode = $state(false);
  diffTitle = $state('');
  diffBefore = $state<DiffableSnapshot | null>(null);
  diffAfter = $state<DiffableSnapshot | null>(null);
  diffResult = $state<DiagramDiff | null>(null);
  /** For terraform text diff: the selected file's before/after content */
  diffFileBeforeText = $state('');
  diffFileAfterText = $state('');
  diffFileName = $state('');
  /** Which diff mode to open in: 'diagram' or 'terraform' */
  diffInitialMode = $state<'diagram' | 'terraform'>('diagram');

  /** Whether there are any uncommitted changes */
  get hasChanges(): boolean {
    if (this.changes) {
      return (
        this.changes.resources.length > 0 ||
        this.changes.connections.length > 0 ||
        this.changes.modules.length > 0 ||
        this.changes.instances.length > 0
      );
    }
    return this.fileStatuses.length > 0;
  }

  /** Total number of resource-level changes */
  get changeCount(): number {
    if (!this.changes) return this.fileStatuses.length;
    return (
      this.changes.resources.length +
      this.changes.connections.length +
      this.changes.modules.length +
      this.changes.instances.length
    );
  }

  setRepoState(isRepo: boolean, branch: string) {
    this.isRepo = isRepo;
    this.branch = branch;
  }

  setRemoteStatus(status: GitRemoteStatus) {
    this.ahead = status.ahead;
    this.behind = status.behind;
    this.hasRemote = status.has_remote;
  }

  setChanges(changes: DiagramDiff | null, fileStatuses: GitFileStatus[]) {
    this.changes = changes;
    this.fileStatuses = fileStatuses;
  }

  setHistory(history: GitLogEntry[]) {
    this.history = history;
  }

  setLoading(loading: boolean) {
    this.loading = loading;
  }

  setError(error: string | null) {
    this.error = error;
  }

  appendOutput(line: string) {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    this.outputLines = [...this.outputLines, { line, timestamp }];
  }

  clearOutput() {
    this.outputLines = [];
  }

  enterDiffMode(title: string, before: DiffableSnapshot, after: DiffableSnapshot, diff: DiagramDiff, mode: 'diagram' | 'terraform' = 'diagram') {
    this.diffMode = true;
    this.diffTitle = title;
    this.diffBefore = before;
    this.diffAfter = after;
    this.diffResult = diff;
    this.diffInitialMode = mode;
  }

  setDiffFile(fileName: string, beforeText: string, afterText: string) {
    this.diffFileName = fileName;
    this.diffFileBeforeText = beforeText;
    this.diffFileAfterText = afterText;
    this.diffInitialMode = 'terraform';
  }

  exitDiffMode() {
    this.diffMode = false;
    this.diffTitle = '';
    this.diffBefore = null;
    this.diffAfter = null;
    this.diffResult = null;
    this.diffFileBeforeText = '';
    this.diffFileAfterText = '';
    this.diffFileName = '';
    this.diffInitialMode = 'diagram';
  }

  reset() {
    this.isRepo = false;
    this.branch = '';
    this.ahead = 0;
    this.behind = 0;
    this.hasRemote = false;
    this.changes = null;
    this.fileStatuses = [];
    this.history = [];
    this.loading = false;
    this.error = null;
    this.diffMode = false;
    this.diffTitle = '';
    this.diffBefore = null;
    this.diffAfter = null;
    this.diffResult = null;
  }
}

export const git = new GitStore();
