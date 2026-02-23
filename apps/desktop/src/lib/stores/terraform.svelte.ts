import type { TerraformVariable } from '@terrastudio/types';

export type TerraformCommand = 'init' | 'validate' | 'plan' | 'apply' | 'destroy';
export type TerraformStatusType = 'idle' | 'generating' | 'writing' | 'running' | 'success' | 'error';

export interface TerraformOutputLine {
  stream: 'stdout' | 'stderr';
  line: string;
}

/** Terraform diagnostic from JSON output */
export interface TerraformDiagnostic {
  severity: 'error' | 'warning';
  summary: string;
  detail: string;
  address?: string;
  range?: {
    filename: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

/** Resource change info from terraform JSON output */
export interface ResourceChangeInfo {
  address: string;
  action: string;
  success: boolean;
  error?: string;
}

/** Result from terraform plan/apply/destroy with JSON output */
export interface TerraformJsonResult {
  success: boolean;
  code: number;
  diagnostics: TerraformDiagnostic[];
  resource_changes: ResourceChangeInfo[];
}

/** Terraform JSON message emitted via events */
export interface TerraformJsonMessage {
  level: string;
  message: string;
  module: string;
  timestamp: string;
  msg_type: string;
  diagnostic?: TerraformDiagnostic;
}

class TerraformStore {
  status = $state<TerraformStatusType>('idle');
  currentCommand = $state<TerraformCommand | null>(null);
  outputLines = $state<TerraformOutputLine[]>([]);
  terraformVersion = $state<string | null>(null);
  terraformInstalled = $state<boolean | null>(null);
  collectedVariables = $state<TerraformVariable[]>([]);

  /** Whether terraform files are out of sync with diagram */
  filesStale = $state(true);
  /** Hash of diagram state when files were last generated */
  private lastGenerationHash = $state<string | null>(null);

  /** Auto-regenerate terraform files when diagram changes */
  autoRegenerate = $state(
    typeof localStorage !== 'undefined' &&
      localStorage.getItem('terrastudio-auto-regen') === 'true'
  );

  /** Flag to suppress stale marking during status refresh (prevents loop) */
  private suppressStaleMarking = false;

  /**
   * Blocks auto-regen after a failed attempt so it doesn't loop.
   * Cleared by markFilesStale() when the diagram actually changes.
   */
  autoRegenBlocked = $state(false);

  /** Last command result with diagnostics and resource changes */
  lastResult = $state<TerraformJsonResult | null>(null);
  /** Resource addresses that had errors in last run */
  errorAddresses = $state<Map<string, string>>(new Map());

  isRunning = $derived(
    this.status === 'running' ||
    this.status === 'generating' ||
    this.status === 'writing',
  );

  canRun = $derived(!this.isRunning);

  /** Check if all required variables have values */
  hasAllRequiredVariables(variableValues: Record<string, string>): boolean {
    const missingVars = this.getMissingVariables(variableValues);
    return missingVars.length === 0;
  }

  /** Get list of required variables without values */
  getMissingVariables(variableValues: Record<string, string>): TerraformVariable[] {
    return this.collectedVariables.filter(v => {
      // Variables with defaults are not required
      if (v.defaultValue !== undefined && v.defaultValue !== null) return false;
      // Check if value is provided
      const value = variableValues[v.name];
      return !value || value.trim() === '';
    });
  }

  /** Mark terraform files as needing regeneration */
  markFilesStale() {
    if (this.suppressStaleMarking) return;
    this.filesStale = true;
    this.autoRegenBlocked = false; // Diagram changed — allow auto-regen to try again
  }

  /** Set auto-regenerate preference and persist */
  setAutoRegenerate(enabled: boolean) {
    this.autoRegenerate = enabled;
    localStorage.setItem('terrastudio-auto-regen', String(enabled));
  }

  /** Begin suppressing stale marking (for status refresh) */
  beginStatusRefresh() {
    this.suppressStaleMarking = true;
  }

  /** End suppressing stale marking */
  endStatusRefresh() {
    this.suppressStaleMarking = false;
  }

  /** Mark terraform files as up-to-date with given diagram hash */
  markFilesGenerated(diagramHash: string) {
    this.filesStale = false;
    this.lastGenerationHash = diagramHash;
  }

  /** Check if diagram has changed since last generation */
  checkStale(currentHash: string): boolean {
    return this.lastGenerationHash !== currentHash;
  }

  /** Store result from terraform command and extract error info */
  setLastResult(result: TerraformJsonResult) {
    this.lastResult = result;

    // Build map of resource addresses that had errors
    const errors = new Map<string, string>();

    // From diagnostics with addresses
    for (const diag of result.diagnostics) {
      if (diag.severity === 'error' && diag.address) {
        errors.set(diag.address, diag.summary + (diag.detail ? `: ${diag.detail}` : ''));
      }
    }

    // From resource changes that failed
    for (const change of result.resource_changes) {
      if (!change.success && change.error) {
        errors.set(change.address, change.error);
      }
    }

    this.errorAddresses = errors;
  }

  /** Clear error state */
  clearErrors() {
    this.lastResult = null;
    this.errorAddresses = new Map();
  }

  appendOutput(line: TerraformOutputLine) {
    this.outputLines = [...this.outputLines, line];
  }

  appendInfo(message: string) {
    this.outputLines = [
      ...this.outputLines,
      { stream: 'stdout', line: message },
    ];
  }

  appendError(message: string) {
    this.outputLines = [
      ...this.outputLines,
      { stream: 'stderr', line: message },
    ];
  }

  clearOutput() {
    this.outputLines = [];
  }

  setStatus(status: TerraformStatusType, command?: TerraformCommand | null) {
    this.status = status;
    this.currentCommand = command ?? null;
  }
}

export const terraform = new TerraformStore();
