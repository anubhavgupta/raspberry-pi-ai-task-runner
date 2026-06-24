#!/usr/bin/env node
import { main } from './cli';

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
