// AI task — sends instructions + content to an LLM via OpenAI-compatible API
// Usage: node ai-task.js --instructions-file "<path>" --content-file "<path>"
// Prints the LLM response to stdout.

const { Agent, setGlobalDispatcher } = await import('undici');

setGlobalDispatcher(
  new Agent({
    headersTimeout: 0, // disable
    bodyTimeout: 0,    // disable
  })
);

let instructionsFile = null;
let contentFile = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--instructions-file' && i + 1 < process.argv.length) {
    instructionsFile = process.argv[i + 1];
    i++;
  } else if (process.argv[i] === '--content-file' && i + 1 < process.argv.length) {
    contentFile = process.argv[i + 1];
    i++;
  }
}

if (!instructionsFile) {
  console.error('Missing --instructions-file');
  process.exit(1);
}

const fs = await import('fs');
try {
  instructionsFile = fs.readFileSync(instructionsFile, 'utf-8');
} catch (err) {
  console.error(`Failed to read instructions file: ${instructionsFile}`);
  process.exit(1);
}

let contentFileContent = '(none provided)';
if (contentFile) {
  try {
    contentFileContent = fs.readFileSync(contentFile, 'utf-8');
  } catch (err) {
    console.error(`Failed to read content file: ${contentFile}`);
    process.exit(1);
  }
}

const API_URL = process.env.LLM_API_URL || 'http://192.168.1.33:7838/v1/chat/completions';
const API_KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || 'default';
async function aiTask() {
 try {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        //{ role: 'system', content: '${instructionsFile}' },
        { role: 'user', content: `#Instructions:\n${instructionsFile} \n#Content: \n${contentFileContent}` },
      ],
    }),
    signal: AbortSignal.timeout(3 * 60 * 60 * 1000), // 3 hours
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`HTTP ${res.status}: ${errBody}`);
    process.exit(1);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content || '';

  if (!reply.trim()) {
    process.exit(1);
  }

  console.log(reply.trim());
  } catch (err) {
     console.error(err);
     console.error(err.name);
     console.error(err.code);
     console.error(err.cause);
 }
}

aiTask().catch(err => {
  console.error('AI task failed:', err.message);
  process.exit(1);
});
