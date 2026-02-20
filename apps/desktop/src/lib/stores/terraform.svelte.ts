import type { TerraformVariable } from '@terrastudio/types';

export type TerraformCommand = 'init' | 'validate' | 'plan' | 'apply' | 'destroy';
export type TerraformStatusType = 'idle' | 'generating' | 'writing' | 'running' | 'success' | 'error';

export interface TerraformOutputLine {
  stream: 'stdout' | 'stderr';
  line: string;
}

class TerraformStore {
  status = $state<TerraformStatusType>('idle');
  currentCommand = $state<TerraformCommand | null>(null);
  outputLines = $state<TerraformOutputLine[]>([]);
  terraformVersion = $state<string | null>(null);
  terraformInstalled = $state<boolean | null>(null);
  collectedVariables = $state<TerraformVariable[]>([]);

  isRunning = $derived(
    this.status === 'running' ||
    this.status === 'generating' ||
    this.status === 'writing',
  );

  canRun = $derived(!this.isRunning);

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
