import * as cron from 'node-cron';
import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { TaskConfig, ScheduledTask, TaskResult } from './types';
import { runTask } from './task-runner';
import { logger } from './logger';

let envOverrides: Record<string, string> = {};

try {
  const dotenv = require('dotenv');
  const result = dotenv.config();
  if (result.parsed) {
    envOverrides = result.parsed;
  }
} catch {
  // dotenv not installed or .env not found — skip silently
}

/**
 * Recursively scan a directory for .json task config files.
 */
function scanTaskDirectory(dir: string): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];

  if (!statSync(dir)?.isDirectory()) {
    logger.warn(`Tasks directory not found: ${dir}`);
    return tasks;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      const subtasks = scanTaskDirectory(fullPath);
      tasks.push(...subtasks);
      continue;
    }

    if (!entry.endsWith('.json')) continue;

    try {
      const config = JSON.parse(require('fs').readFileSync(fullPath, 'utf-8')) as TaskConfig;

      // Validate cron expression
      if (!cron.validate(config.cron)) {
        logger.warn(`Invalid cron expression in "${config.name}": ${config.cron}`);
        continue;
      }

      tasks.push({
        name: config.name,
        config,
        cronExpression: config.cron,
      });

      logger.info(`Loaded task: ${config.name} [${config.cron}]`);
    } catch (err) {
      logger.error(`Failed to load task config: ${fullPath}`, { error: String(err) });
    }
  }

  return tasks;
}

/**
 * Execute a task with merged environment variables.
 */
async function executeScheduledTask(task: ScheduledTask): Promise<TaskResult> {
  const mergedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...envOverrides,
    ...task.config.env,
  };

  logger.info(`Running scheduled task: ${task.config.name}`);

  try {
    return await runTask(task.config, mergedEnv);
  } catch (err) {
    logger.error(`Task "${task.config.name}" threw error`, {
      taskName: task.config.name,
      error: String(err),
    });
    return {
      taskName: task.config.name,
      overallSuccess: false,
      terminalResult: '!OK',
      steps: [],
      totalDurationMs: 0,
    };
  }
}

let schedulerInstance: cron.ScheduledTask[] = [];

/**
 * Start the scheduler: scan tasks directory, register cron jobs.
 */
export function startScheduler(tasksDir: string): void {
  const tasks = scanTaskDirectory(tasksDir);

  if (!tasks.length) {
    logger.warn('No valid tasks found. Place .json configs in the tasks/ directory.');
    return;
  }

  logger.info(`Starting scheduler with ${tasks.length} task(s)`);

  for (const task of tasks) {
    const cronTask = cron.schedule(task.cronExpression, () => {
      executeScheduledTask(task).catch(err => {
        logger.error(`Unhandled error in task "${task.name}"`, { error: String(err) });
      });
    });

    cronTask.start();
    schedulerInstance.push(cronTask);
    logger.info(`Scheduled: ${task.config.name} → ${task.cronExpression}`);
  }

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down scheduler...`);
    for (const ct of schedulerInstance) {
      ct.stop();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export { executeScheduledTask };
