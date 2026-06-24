// Fetch a page and extract visible text content
// Usage: node fetch-page.js --url "<url>"
// Logs raw HTML path and extracted text to stdout.

let url = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--url' && i + 1 < process.argv.length) {
    url = process.argv[i + 1];
    i++;
  }
}

if (!url) {
  console.error('Usage: node fetch-page.js --url "<url>"');
  process.exit(1);
}

async function fetchAndExtract() {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    process.exit(1);
  }

  const html = await res.text();

  // Extract visible text using jsdom
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  body?.querySelectorAll(
    'script, style, noscript, link, meta, svg, iframe, img, video, audio, canvas, object, embed, map, area, source, button, input, select, textarea, form'
  ).forEach(el => el.remove());
  const bodyText = body?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  console.log(bodyText);
}

fetchAndExtract().catch(err => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
