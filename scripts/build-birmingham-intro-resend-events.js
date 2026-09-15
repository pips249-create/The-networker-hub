#!/usr/bin/env node
/** @deprecated Use: node scripts/build-city-intro-resend-events.js birmingham */
require('child_process').execFileSync(process.execPath, [__dirname + '/build-city-intro-resend-events.js', 'birmingham', ...process.argv.slice(2)], { stdio: 'inherit' });
