'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.idea', '.vscode', 'tmp', 'temp']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let failed = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const isEsm = rel.startsWith(`public${path.sep}`);
  let result;
  if (isEsm) {
    const source = fs.readFileSync(file, 'utf8');
    result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8' });
  } else {
    result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  }
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAIL ${rel}`);
    console.error((result.stderr || '').trim());
  } else {
    console.log(`ok   ${rel}`);
  }
}

console.log(`\nchecked ${files.length} file(s), ${failed} failed`);
process.exit(failed ? 1 : 0);
