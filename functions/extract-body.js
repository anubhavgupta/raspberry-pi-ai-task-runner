// Extract visible text from <body> of an HTML page using jsdom
// Strips <script> and <style> blocks, uses textContent for full text
// Usage: node extract-body.js --url <url>

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
  console.error('Usage: node extract-body.js --url <url>');
  process.exit(1);
}

async function extractBody() {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    process.exit(1);
  }
  const html = await res.text();

  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html);
  // Remove script and style elements before extracting text
  const body = dom.window.document.body;
  body?.querySelectorAll('script, style, noscript, link, meta, svg, iframe, img, video, audio, canvas, object, embed, map, area, source, button, input, select, textarea, form').forEach(el => el.remove());
  const bodyText = body?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  console.log(bodyText);
}

extractBody().catch(err => {
  console.error('Extraction failed:', err.message);
  process.exit(1);
});
