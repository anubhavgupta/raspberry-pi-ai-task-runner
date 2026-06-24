// Analyze the output from the previous function
// Usage: node analyze-output.js "<previous-output>"

const input = process.argv[process.argv.length - 1];

if (!input) {
  console.error('Usage: node analyze-output.js "<input>"');
  process.exit(1);
}

try {
  const parsed = JSON.parse(input);
  const keys = Object.keys(parsed.data || parsed);
  console.log(`Analyzed: ${keys.length} keys found — ${keys.join(', ')}`);
} catch {
  console.log(`Raw analysis: ${input.length} characters, ${input.split(/\s+/).length} words`);
}
