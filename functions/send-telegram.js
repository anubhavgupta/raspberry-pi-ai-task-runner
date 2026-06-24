// Send message to Telegram
// Usage: node send-telegram.js --chat-id "<chat_id>" --file "<file_path>"
// Reads text from the specified file and sends it via Telegram.
// Prints the API response to stdout. Exits 0 on success, 1 on failure.

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let chatId = null;
let filePath = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--chat-id' && i + 1 < process.argv.length) {
    chatId = process.argv[i + 1];
    i++;
  } else if (process.argv[i] === '--file' && i + 1 < process.argv.length) {
    filePath = process.argv[i + 1];
    i++;
  }
}

if (!chatId) {
  console.error('Missing --chat-id');
  process.exit(1);
}

if (!filePath) {
  console.error('Missing --file argument');
  process.exit(1);
}

import { readFileSync } from 'fs';

let text;
try {
  text = readFileSync(filePath, 'utf-8').trim();
} catch (err) {
  console.error(`Failed to read file: ${err.message}`);
  process.exit(1);
}

if (!text) {
  console.error('File is empty');
  process.exit(1);
}

// Escape special characters for Telegram MarkdownV2
function escapeMarkdownV2(str) {
  return str.replace(
    /[_*[\]()~`>#+\-=|{}.!\\]/g,
    '\\$&'
  );
}

async function sendTelegram() {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const safeText = escapeMarkdownV2(text);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: safeText,
      parse_mode: 'MarkdownV2',
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    const errMsg = data.description || `HTTP ${res.status}`;
    console.error(`Telegram error: ${errMsg}`);
    process.exit(1);
  }

  console.log(`Message sent: ${data.result.message_id}`);
}

sendTelegram().catch(err => {
  console.error('Telegram send failed:', err.message);
  process.exit(1);
});
