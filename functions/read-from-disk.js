// Read contents of a file from disk
// Usage: node read-from-disk.js --file "<file_path>"
// Prints file contents to stdout. Exits 1 on failure.

let filePath = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--file' && i + 1 < process.argv.length) {
    filePath = process.argv[i + 1];
    i++;
  }
}

if (!filePath) {
  console.error('Missing --file argument');
  process.exit(1);
}

async function readFile() {
  const { readFileSync } = await import('fs');

  try {
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) {
      console.error('File is empty');
      process.exit(1);
    }
    console.log(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('(no previous models — first run)');
    } else {
      console.error(`Failed to read file: ${err.message}`);
      process.exit(1);
    }
  }
}

readFile();
