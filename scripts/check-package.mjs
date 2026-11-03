import assert from 'node:assert/strict';
import ts from 'typescript';
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
const syntax = ts.createSourceFile(
  'bundle.js',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
function visit(node) {
  assert(
    !(
      ts.isImportDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ),
    'No external or missing module dependencies.',
  );
  ts.forEachChild(node, visit);
}
visit(syntax);
assert(statSync(`dist/${hacs.filename}`).size < 2_500_000, 'Distribution must stay below 2.5 MB.');
console.log(`Verified self-contained ${hacs.filename} (${pkg.version}).`);
