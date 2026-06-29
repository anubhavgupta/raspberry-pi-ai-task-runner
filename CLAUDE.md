# pi-ai-tools — AI Task Runner

A Node.js CLI tool that runs predefined function chains (tasks) on cron schedules. Each task is a sequence of functions that pass string data between steps, ending with a terminal function that returns `'OK'` or `'!OK'`.

## Project Structure

```
pi-ai-tools/
├── src/                    # TypeScript source
│   ├── index.ts            # CLI entry point (#!/usr/bin/env node)
│   ├── cli.ts              # CLI argument parsing (serve/run/list)
│   ├── scheduler.ts        # Cron-based task scheduler (node-cron)
│   ├── task-runner.ts      # Loads config, chains function execution
│   ├── child-process.ts    # Spawns child processes, resolves $VAR/{{result}}
│   ├── logger.ts           # Structured colored logging
│   └── types.ts            # TypeScript interfaces
├── tasks/                  # Task config directory (JSON files)
│   └── example-task.json   # Sample task
├── functions/              # Function implementations (Node.js scripts)
│   ├── fetch-data.js       # Fetch JSON from URL
│   ├── fetch-page.js       # Fetch page + extract visible text using jsdom
│   ├── analyze-output.js   # Analyze JSON/string input (deprecated, use ai-task.js)
│   ├── health-check.js     # Terminal validator (returns OK/!OK)
│   └── ai-task.js          # LLM call via OpenAI-compatible API
├── package.json
├── tsconfig.json
├── .env.example
└── CLAUDE.md
```

## Core Concepts

### Task Configuration

Tasks are JSON files in `tasks/`. Each defines a cron schedule and a chain of functions:

```json
{
  "name": "my-task",
  "description": "What this task does",
  "cron": "0 2 * * *",
  "env": {
    "MY_VAR": "value",
    "LLM_API_URL": "http://192.168.1.33:7838/v1/chat/completions"
  },
  "functions": [
    {
      "id": "step-1",
      "type": "shell",
      "command": "node",
      "args": ["functions/my-script.js", "--url", "$MY_VAR"]
    },
    {
      "id": "step-2",
      "type": "terminal",
      "command": "node",
      "args": ["functions/my-check.js", "{{result}}"]
    }
  ]
}
```

**Key rules:**
- **`type: "shell"`** — intermediate step. Its stdout becomes `{{result}}` for the next step.
- **`type: "terminal"`** — final step. Must print `'OK'` (success) or `'!OK'` (failure) to stdout.
- The **last** function must have `type: "terminal"`.
- If any non-terminal step exits non-zero, the task aborts.
- Variable substitution:
  - `$VAR` or `${VAR}` — replaced with env var from config or system environment
  - `{{result}}` — replaced with stdout of the previous function
  - `{{$VAR_NAME}}` — replaced with a runtime saved variable from an earlier step (see below)
- **`saveResultToVariable`** — optional field on any step. If set, the step's stdout is stored as a named runtime variable accessible by later steps via `{{$VAR_NAME}}`.

### Runtime Saved Variables

Add `saveResultToVariable` to any step to make its stdout available to later steps:

```json
{
  "functions": [
    {
      "id": "fetch",
      "type": "shell",
      "command": "node",
      "args": ["functions/fetch.js"],
      "saveResultToVariable": "RAW_HTML"
    },
    {
      "id": "process",
      "type": "shell",
      "command": "node",
      "args": ["functions/process.js", "--content", "{{$RAW_HTML}}"]
    }
  ]
}
```

`{{$RAW_HTML}}` in step 2 resolves to the stdout of step 1. Saved variables persist for the lifetime of the task and can be referenced by any later step (not just the immediate next one). This is the key difference from `{{result}}`, which only refers to the immediately preceding step's output.

Multiple saved variables and `{{result}}` can be used together in a single arg. All are resolved in the same pass:

```json
{
  "id": "combined",
  "type": "shell",
  "command": "node",
  "args": ["functions/combine.js", "--raw", "{{$RAW_HTML}}", "--extracted", "{{$EXTRACTED_LIST}}", "--context", "{{result}}"]
}
```

This step receives data from three sources: `{{$RAW_HTML}}` from an earlier step, `{{$EXTRACTED_LIST}}` from another earlier step, and `{{result}}` from the immediately preceding step.

### Function Structure

Functions are Node.js scripts in `functions/`. Each function:

- Accepts arguments via `--flag value` or `--flag=value` CLI args
- Receives env vars from the task config's `env` block
- Receives the previous function's stdout as `{{result}}` (in the config, not in the script)
- Prints to stdout — this output becomes the next function's `{{result}}`
- Prints errors to stderr and exits with code 0 (success) or non-zero (failure)

## CLI Commands

```bash
npm run dev serve       # Start the cron scheduler (default)
npm run dev run <name>  # Run a specific task immediately
npm run dev list        # List all configured tasks
```

Or after building:
```bash
node dist/index.js serve
node dist/index.js run <name>
node dist/index.js list
```

## Function Development

### Argument Parsing Pattern

```js
let myArg = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--my-flag' && i + 1 < process.argv.length) {
    myArg = process.argv[i + 1];
    i++;
  }
}
```

### Error Handling Pattern

```js
async function run() {
  // ... work ...
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ success: true, data: result }));
}

run().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
```

### HTML Parsing with jsdom

```js
const { JSDOM } = await import('jsdom');
const dom = new JSDOM(html);
const text = dom.window.document.body?.innerText?.trim() ?? '';
console.log(text);
```

### LLM Call via OpenAI-compatible API

```js
const API_URL = process.env.LLM_API_URL || 'http://192.168.1.33:7838/v1/chat/completions';
const API_KEY = process.env.LLM_API_KEY || '';

const res = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
  },
  body: JSON.stringify({
    model: process.env.LLM_MODEL || 'default',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: `Instructions: ${instructions}\n\nContent: ${content}` },
    ],
    max_tokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : 4096,
  }),
});

const data = await res.json();
const reply = data?.choices?.[0]?.message?.content || '(no response)';
console.log(reply);
```

## Dependencies

- **`node-cron`** — Cron expression parsing and scheduling
- **`jsdom`** — HTML parsing for web scraping functions
- **`@ai-sdk/openai`** — Vercel AI SDK for LLM calls

## Runtime Variable System

The `saveResultToVariable` feature allows steps to save their stdout as named variables for later reference:

- `{{$VAR_NAME}}` — resolved from a saved variable (must be set via `saveResultToVariable` on an earlier step)
- `{{result}}` — always resolves to the stdout of the immediately preceding step (never empty if that step succeeded)
- Both can be mixed in the same arg: `"--content", "{{$A}} and {{$B}} and {{result}}"`
- Variables persist for the lifetime of the task and are available to any later step
- If a saved variable is referenced but was never set, it resolves to an empty string
- `{{result}}` uses function-based replacement to safely handle stdout containing `$1`, `$&`, etc.

## Function Conventions

All functions in `functions/` follow these patterns:

- **Dynamic imports**: Use `await import('fs')` or `await import('jsdom')` (top-level `import` causes ESM/CJS issues)
- **Argument parsing**: `for (let i = 2; i < process.argv.length; i++)` — skip node and script path
- **Async wrapper**: Wrap logic in `async function run()` and call `run().catch(...)` for error handling
- **Exit codes**: 0 = success, non-zero = failure
- **Output**: stdout for data/`{{result}}`, stderr for errors
- **Telegram function**: `send-telegram.js` only accepts `--file`, not `--content`
- **Read function**: `read-from-disk.js` accepts `--file` (same as `send-telegram.js`), outputs `(no previous models — first run)` on ENOENT instead of failing
- **Save function**: `save-to-disk.js` accepts `--filename` and `--content`

## Architecture

- `scheduler.ts` scans `tasks/` for `.json` files, validates cron expressions, registers jobs
- `task-runner.ts` loads a config, iterates functions, chains child process execution
- `child-process.ts` spawns via `child_process.execFile`, injects env vars, captures stdout/stderr
- `logger.ts` provides structured colored logging with timestamps
- Graceful shutdown on SIGINT/SIGTERM stops all cron jobs
