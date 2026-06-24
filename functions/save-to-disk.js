// Save content to a file on disk
// Usage: node save-to-disk.js --file "<file_path>" --content "<content>"
// Prints the saved content to stdout for chaining.

let filepath = null;
let content = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--file' && i + 1 < process.argv.length) {
    filepath = process.argv[i + 1];
    i++;
  } else if (process.argv[i] === '--content' && i + 1 < process.argv.length) {
    content = process.argv[i + 1];
    i++;
  }
}

if (!filepath) {
  console.error('Usage: node save-to-disk.js --file "<path>" --content "<content>"');
  process.exit(1);
}

const fs = await import('fs');
const path = await import('path');

async function saveToFile() {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`Saved ${content.length} bytes to ${filepath}`);
  console.log(content);
}

saveToFile().catch(err => {
  console.error('Save failed:', err.message);
  process.exit(1);
});
