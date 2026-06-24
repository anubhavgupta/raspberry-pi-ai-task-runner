export interface FunctionStep {
  id: string;
  type: 'shell' | 'terminal';
  command: string;
  args?: string[];
  saveResultToVariable?: string;
}

export interface TaskConfig {
  name: string;
  description?: string;
  cron: string;
  env?: Record<string, string>;
  functions: FunctionStep[];
}

export interface ChildProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface StepResult {
  stepId: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  success: boolean;
}

export interface TaskResult {
  taskName: string;
  overallSuccess: boolean;
  terminalResult: 'OK' | '!OK' | 'incomplete';
  steps: StepResult[];
  totalDurationMs: number;
}

export interface ScheduledTask {
  name: string;
  config: TaskConfig;
  cronExpression: string;
}
