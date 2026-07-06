import { execFile } from 'child_process';
import { ChildProcessResult } from './types';
import { logger } from './logger';

/**
 * Resolve variable substitutions in a string:
 * - {{result}} → lastResult (previous step's stdout)
 * - {{$VAR_NAME}} → runtime saved variable from an earlier step
 * - ${VAR} or $VAR → env value
 */
function resolveVariables(
  input: string,
  env: NodeJS.ProcessEnv,
  runtimeVars: Map<string, string>,
  lastResult?: string,
): string {
  let result = input;

  // Replace {{$VAR_NAME}} with runtime saved variables
  result = result.replace(/\{\{\$([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_match, varName) => {
    return runtimeVars.get(varName) ?? '';
  });

  // Replace {{result}} with the previous function's stdout
  // Use a function to avoid $1, $& etc. being treated as special replacement patterns
  if (lastResult !== undefined) {
    result = result.replace(/\{\{result\}\}/g, () => lastResult);
  }

  // Replace ${VAR} and $VAR patterns with env values
  result = result.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
    return env[varName] || '';
  });
  // Also handle bare $VAR (word characters after $)
  result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName) => {
    return env[varName] || '';
  });

  return result;
}

export async function runChildProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  lastResult?: string,
  runtimeVars?: Map<string, string>,
): Promise<ChildProcessResult> {
  const startTime = Date.now();

  // Resolve variables in command and args
  const resolvedCommand = resolveVariables(command, env, runtimeVars ?? new Map(), lastResult);
  const resolvedArgs = args.map(arg => resolveVariables(arg, env, runtimeVars ?? new Map(), lastResult));

  logger.debug(`Running: ${resolvedCommand} ${resolvedArgs.join(' ')}`);

  return new Promise((resolve) => {
    execFile(resolvedCommand, resolvedArgs, {
      env: { ...process.env, ...env },
      timeout: 3 * 60 * 60 * 1000, // 3 hour timeout per function
    }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;

      const exitCode = (error && typeof error.code === 'number') ? error.code : 0;
      const stdoutStr = stdout.toString();
      const stderrStr = stderr.toString();

      logger.debug(
        `Function completed in ${durationMs}ms, exitCode=${exitCode}`,
        { durationMs: String(durationMs), exitCode: String(exitCode) },
      );

      resolve({ exitCode, stdout: stdoutStr, stderr: stderrStr });
    });
  });
}
