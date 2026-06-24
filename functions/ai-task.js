// AI task — sends instructions + content to an LLM via OpenAI-compatible API
// Usage: node ai-task.js --instructions "<prompt>" --content "<content>"
// Prints the LLM response to stdout.

let instructions = null;
let content = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--instructions' && i + 1 < process.argv.length) {
    instructions = process.argv[i + 1];
    i++;
  } else if (process.argv[i] === '--content' && i + 1 < process.argv.length) {
    content = process.argv[i + 1];
    i++;
  }
}

if (!instructions) {
  process.exit(1);
}

const API_URL = process.env.LLM_API_URL || 'http://192.168.1.33:7838/v1/chat/completions';
const API_KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || 'default';
async function aiTask() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Act based on the instructions given by the user.' },
        { role: 'user', content: `Instructions: ${instructions}\n\nContent: ${content || '(none provided)'}` },
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
}

aiTask().catch(err => {
  console.error('AI task failed:', err.message);
  process.exit(1);
});
