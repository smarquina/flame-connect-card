import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}
for (const directory of ['src/domain', 'src/application']) {
  for (const file of files(directory)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
      const dependency = match[1];
      if (
        !dependency.startsWith('.') ||
        /adapters|presentation|composition|configuration|localization/.test(dependency) ||
        (directory.endsWith('domain') && dependency.includes('application'))
      )
        throw new Error(`${relative('.', file)}: forbidden inward dependency ${dependency}`);
    }
    if (/\b(?:window|document|localStorage|fetch)\b/.test(source))
      throw new Error(`${file}: browser dependency in core`);
  }
}
console.log('Architecture boundaries verified.');
