import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const hacs = JSON.parse(readFileSync('hacs.json', 'utf8'));
assert.equal(hacs.filename, `${pkg.name}.js`);
assert.deepEqual(readdirSync('dist'), ['flame-connect-card.js']);
const source = readFileSync(`dist/${hacs.filename}`, 'utf8');
assert(
  source.includes('data:image/png;base64,'),
  'The four supplied fireplace states must be bundled.',
);
assert(
  !/\b(?:from\s*|import\s*(?:\(\s*)?)["'](?:lit|\.\/)/.test(source),
  'No external or missing module dependencies.',
);
assert(statSync(`dist/${hacs.filename}`).size < 2_500_000, 'Distribution must stay below 2.5 MB.');
console.log(`Verified self-contained ${hacs.filename} (${pkg.version}).`);
