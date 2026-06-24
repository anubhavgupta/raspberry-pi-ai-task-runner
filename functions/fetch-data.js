// Fetch data from a URL using the fetch API
// Usage: node fetch-data.js --url <url>

let url = null;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--url' && i + 1 < process.argv.length) {
    url = process.argv[i + 1];
    break;
  }
  if (process.argv[i].startsWith('--url=')) {
    url = process.argv[i].split('=').slice(1).join('=');
    break;
  }
}

if (!url) {
  console.error('Usage: node fetch-data.js --url <url>');
  process.exit(1);
}

async function fetchData() {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  console.log(JSON.stringify({ url, status: res.status, data: JSON.stringify(data).slice(0, 500) }));
}

fetchData().catch(err => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
