import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  TaskConfig,
  TaskResult,
  StepResult,
  ChildProcessResult,
} from './types';
import { runChildProcess } from './child-process';
import { logger } from './logger';

function loadTaskConfig(taskPath: string): TaskConfig {
  const raw = readFileSync(taskPath, 'utf-8');
  const config = JSON.parse(raw) as TaskConfig;

  // Validate required fields
  if (!config.name) throw new Error('Task config missing "name"');
  if (!config.cron) throw new Error(`Task "${config.name}" missing "cron"`);
  if (!config.functions?.length) throw new Error(`Task "${config.name}" has no functions`);

  // Validate last function is terminal
  const lastFn = config.functions[config.functions.length - 1];
  if (lastFn.type !== 'terminal') {
    throw new Error(`Task "${config.name}" last function must have type "terminal"`);
  }

  return config;
}

async function executeStep(
  step: TaskConfig['functions'][0],
  env: NodeJS.ProcessEnv,
  lastResult: string | undefined,
  runtimeVars: Map<string, string>,
): Promise<StepResult> {
  const startTime = Date.now();
  const args = step.args ?? [];

  const result: ChildProcessResult = await runChildProcess(step.command, args, env, lastResult, runtimeVars);

  const success = result.exitCode === 0;
  const durationMs = Date.now() - startTime;

  logger.info(
    `Step "${step.id}" ${success ? 'succeeded' : 'failed'} in ${durationMs}ms`,
    { stepId: step.id, exitCode: String(result.exitCode), durationMs: String(durationMs) },
  );

  if (result.stderr && !success) {
    logger.warn(`Step "${step.id}" stderr: ${result.stderr.trim().slice(0, 500)}`);
  }

  return {
    stepId: step.id,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs,
    success,
  };
}

export function discoverTaskConfig(configPath: string): TaskConfig {
  return loadTaskConfig(configPath);
}

export async function runTask(config: TaskConfig, env: NodeJS.ProcessEnv): Promise<TaskResult> {
  const taskStart = Date.now();
  const steps: StepResult[] = [];
  let lastResult: string | undefined;
  const runtimeVars = new Map<string, string>();

  for (let i = 0; i < config.functions.length; i++) {
    const step = config.functions[i];
    const stepResult = await executeStep(step, env, lastResult, runtimeVars);
    steps.push(stepResult);

    // Pass stdout to next step as {{result}}
    if (stepResult.success) {
      lastResult = stepResult.stdout.trim();
    }

    // Save result to a named runtime variable for later steps
    if (stepResult.success && step.saveResultToVariable) {
      runtimeVars.set(step.saveResultToVariable, stepResult.stdout.trim());
    }

    // Stop on first failure (unless it's the terminal step).
    // Don't save runtime variables when a step fails.
    if (!stepResult.success && step.type !== 'terminal') {
      logger.warn(`Task "${config.name}" aborting at step "${step.id}"`);
      break;
    }
  }

  const totalDurationMs = Date.now() - taskStart;

  // Determine terminal result
  const lastStep = steps[steps.length - 1];
  let terminalResult: TaskResult['terminalResult'] = 'incomplete';

  if (lastStep?.stepId) {
    const terminalStep = config.functions.find(f => f.id === lastStep.stepId);
    if (terminalStep?.type === 'terminal') {
      const output = lastStep.stdout.trim();
      terminalResult = output === 'OK' ? 'OK' : output === '!OK' ? '!OK' : 'incomplete';
    }
  }

  const overallSuccess = terminalResult === 'OK';

  logger.info(
    `Task "${config.name}" ${overallSuccess ? 'completed OK' : 'completed !OK'} in ${totalDurationMs}ms`,
    { taskName: config.name, terminalResult, totalDurationMs: String(totalDurationMs) },
  );

  return {
    taskName: config.name,
    overallSuccess,
    terminalResult,
    steps,
    totalDurationMs,
  };
}
