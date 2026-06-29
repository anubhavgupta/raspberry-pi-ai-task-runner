import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { TaskConfig } from './types';
import { runTask } from './task-runner';
import { startScheduler } from './scheduler';
import { logger } from './logger';

const DEFAULT_TASKS_DIR = resolve(process.cwd(), 'tasks');

/**
 * Recursively find all .json task config paths in a directory.
 */
function findTaskFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      results.push(...findTaskFiles(fullPath));
    } else if (entry.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

function listTasks(tasksDir: string): void {
  const dirStat = statSync(tasksDir);
  if (!dirStat.isDirectory()) {
    logger.error(`Tasks directory not found: ${tasksDir}`);
    process.exit(1);
  }

  const files = findTaskFiles(tasksDir);

  if (!files.length) {
    logger.info('No task configs found. Add .json files to the tasks/ directory.');
    return;
  }

  console.log('\nConfigured tasks:');
  console.log('─'.repeat(60));

  for (const filePath of files) {
    try {
      const config = JSON.parse(require('fs').readFileSync(filePath, 'utf-8')) as TaskConfig;
      const funcCount = config.functions?.length ?? 0;
      const lastFn = config.functions?.[config.functions.length - 1]?.id ?? 'N/A';

      console.log(`  ${config.name}`);
      console.log(`    Cron:    ${config.cron}`);
      console.log(`    Steps:   ${funcCount} (terminal: ${lastFn})`);
      if (config.description) {
        console.log(`    Desc:    ${config.description}`);
      }
      console.log();
    } catch {
      const basename = filePath.split(/[/\\]/).pop();
      console.log(`  ${basename} (parse error)`);
    }
  }

  console.log('─'.repeat(60));
}

async function runTaskByName(taskName: string, tasksDir: string): Promise<void> {
  const files = findTaskFiles(tasksDir);

  const match = files.find(f => f.replace(/\.json$/, '').split(/[/\\]/).pop() === taskName);

  if (!match) {
    logger.error(`Task "${taskName}" not found`, { taskName, filePath: `${tasksDir}/${taskName}.json` });
    process.exit(1);
  }

  try {
    const config = JSON.parse(require('fs').readFileSync(match, 'utf-8')) as TaskConfig;
    await runTask(config, { ...process.env, ...config.env });
  } catch (err) {
    logger.error(`Failed to run task "${taskName}"`, {
      taskName,
      error: String(err),
      filePath: match,
    });
    process.exit(1);
  }
}

export function parseArgs(argv: string[]): { command: string; args: string[] } {
  const args = argv.slice(2); // skip node and script path

  const commands = ['serve', 'run', 'list', '--help', '-h', 'help'];
  const command = args.find(a => commands.includes(a)) ?? 'serve';
  const positional = args.filter(a => !commands.includes(a) && !a.startsWith('-'));

  return { command, args: positional };
}

export async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv);

  switch (command) {
    case 'serve':
      startScheduler(DEFAULT_TASKS_DIR);
      break;

    case 'list':
      listTasks(DEFAULT_TASKS_DIR);
      break;

    case 'run': {
      const taskName = args[0];
      if (!taskName) {
        logger.error('Usage: pi-ai-tools run <task-name>');
        process.exit(1);
      }
      await runTaskByName(taskName, DEFAULT_TASKS_DIR);
      break;
    }

    case 'help':
    case '-h':
    default:
      console.log(`
AI Task Runner — Execute predefined function chains on cron schedules

Usage:
  pi-ai-tools serve      Start the cron scheduler (default)
  pi-ai-tools run <name> Run a specific task immediately
  pi-ai-tools list       List all configured tasks
`);
      break;
  }
}
