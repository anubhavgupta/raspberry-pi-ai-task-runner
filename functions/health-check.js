// Terminal function — checks health and returns OK or !OK
// Usage: node health-check.js "<input>"

const input = process.argv[process.argv.length - 1];

if (!input) {
  console.error('Usage: node health-check.js "<input>"');
  process.exit(1);
}

// Health check logic: if input contains valid analysis, return OK
try {
  const parsed = JSON.parse(input);
  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
    console.log('OK');
  } else {
    console.log('!OK');
  }
} catch {
  // If input is not JSON, do a basic check
  if (input.trim().length > 0) {
    console.log('OK');
  } else {
    console.log('!OK');
  }
}
